import { createHash } from 'node:crypto';
import { CloudError } from './supabase.mjs';
import { CloudJournal } from './journal.mjs';
import { weightEvidence } from '../analysis/weight-evidence.mjs';
import { evidenceHash } from '../analysis/coaching-evidence.mjs';
import { WEIGHT_SCHEMA,WEIGHT_PROMPT,WEIGHT_DISCLOSURE,WEIGHT_SYSTEM,weightSchema,validateWeightReport } from '../analysis/weight-contract.mjs';
const MODELS=['gemini-3.8-flash','gemini-3.7-flash','gemini-3.6-flash'];
function providerSchema(v){if(Array.isArray(v))return v.map(providerSchema);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).filter(([k])=>!['minLength','maxLength','uniqueItems'].includes(k)).map(([k,x])=>[k,providerSchema(x)]));return v;}
export function weightRequest(pack,model){return {model,store:false,system_instruction:WEIGHT_SYSTEM,input:JSON.stringify({schemaVersion:WEIGHT_SCHEMA,evidenceHash:pack.hash,...pack.content}),response_format:{type:'text',mime_type:'application/json',schema:providerSchema(weightSchema(pack))},generation_config:{thinking_level:'high',max_output_tokens:16384}};}
export function extractWeight(result,pack){
 const outputs=result.steps?.filter(s=>s.type==='model_output')||[];
 if(result.status!=='completed'||outputs.length!==1||!outputs[0].content?.length||outputs[0].content.some(c=>c.type!=='text'))throw new CloudError(502,'Gemini did not return a complete weight insight.');
 try{return validateWeightReport(JSON.parse(outputs[0].content.map(c=>c.text).join('')),pack);}catch{throw new CloudError(502,'The weight insight did not pass its evidence checks. Your readings are unchanged.');}
}
export class WeightIntelligence {
 constructor(api,{env=process.env,fetcher=fetch,journal=new CloudJournal(api)}={}){this.api=api;this.env=env;this.fetcher=fetcher;this.journal=journal;}
 async preference(){const rows=await this.api.json(`/rest/v1/weight_ai_preferences?owner_id=eq.${this.api.config.owner}&select=enabled,disclosure_version,revision,updated_at`),r=rows[0];return {enabled:r?.disclosure_version===WEIGHT_DISCLOSURE?r.enabled:null,revision:r?Number(r.revision):0,disclosureVersion:WEIGHT_DISCLOSURE};}
 async setPreference(enabled){if(typeof enabled!=='boolean')throw new CloudError(400,'Choose whether to allow weight analysis.');return this.api.json('/rest/v1/rpc/set_weight_ai_preference',{method:'POST',body:{allow_analysis:enabled,disclosure:WEIGHT_DISCLOSURE}});}
 configured(){return Boolean(this.env.GEMINI_API_KEY&&this.env.GEMINI_FREE_TIER_CONFIRMED==='1'&&MODELS.includes(this.env.GEMINI_MODEL||'gemini-3.6-flash'));}
 async context(){const pack=weightEvidence(await this.journal.dataset({window:'all'})),model=this.env.GEMINI_MODEL||'gemini-3.6-flash';return {pack,model,key:createHash('sha256').update(JSON.stringify([this.api.config.owner,pack.hash,model,WEIGHT_PROMPT,WEIGHT_SCHEMA])).digest('hex')};}
 async saved(context){const rows=await this.api.json(`/rest/v1/weight_analysis_reports?owner_id=eq.${this.api.config.owner}&status=eq.complete&order=created_at.desc&limit=5`);return rows.filter(r=>{try{if(r.schema_version!==WEIGHT_SCHEMA||r.prompt_version!==WEIGHT_PROMPT||evidenceHash(r.evidence.content)!==r.evidence.hash)return false;validateWeightReport(r.report,r.evidence);return true;}catch{return false;}}).sort((a,b)=>(b.evidence_key===context.key)-(a.evidence_key===context.key))[0]||null;}
 item(row,key){return row?{id:row.id,report:row.report,evidence:row.evidence.content,generatedAt:row.finished_at,model:row.model_id,stale:row.evidence_key!==key}:null;}
 async status(){const consent=await this.preference(),base={consent,configured:this.configured()};if(consent.enabled!==true)return {...base,review:null};const context=await this.context();return {...base,recordedDays:context.pack.content.observations.length,review:this.item(await this.saved(context),context.key)};}
 async generate(){
  if((await this.preference()).enabled!==true)throw new CloudError(403,'Allow weight analysis before generating an insight.');
  if(!this.configured())throw new CloudError(409,'Gemini needs a supported Flash model and a confirmed Free-tier project.');
  const context=await this.context(),facts=context.pack.content.facts,span=facts.find(f=>f.id==='period.span')?.value||0;
  if(context.pack.content.observations.length<4||span<14)throw new CloudError(409,'Record at least four days spanning two weeks before asking for a weight insight.');
  const saved=await this.saved(context);if(saved?.evidence_key===context.key)return this.item(saved,context.key);
  const claim=await this.api.request('/rest/v1/rpc/begin_weight_review',{method:'POST',body:{evidence_key:context.key,model_id:context.model,prompt_version:WEIGHT_PROMPT,schema_version:WEIGHT_SCHEMA}});
  if(!claim.ok)throw new CloudError(claim.status===429?429:409,claim.status===429?'Your weight-insight limit is reached. Try tomorrow.':'A weight insight is already running, or your sharing choice changed. Try again shortly.');
  const id=await claim.json();
  try{
   if((await this.preference()).enabled!==true)throw new CloudError(403,'Weight sharing was switched off.');
   let result;try{result=await this.fetcher('https://generativelanguage.googleapis.com/v1beta/interactions',{method:'POST',redirect:'error',signal:AbortSignal.timeout(90000),headers:{'Content-Type':'application/json','x-goog-api-key':this.env.GEMINI_API_KEY,'Api-Revision':'2026-05-20'},body:JSON.stringify(weightRequest(context.pack,context.model))});}catch{throw new CloudError(503,'Gemini could not be reached. Your readings are unchanged.');}
   if(!result.ok)throw new CloudError(result.status===429?429:503,result.status===429?'Gemini free quota is unavailable. Try later; no paid fallback was used.':`Gemini could not complete this insight (HTTP ${result.status}). Your readings are unchanged.`);
   let size=0;const chunks=[];for await(const c of result.body){size+=c.length;if(size>128000)throw new CloudError(502,'Gemini returned an oversized weight insight.');chunks.push(c);}
   let json;try{json=JSON.parse(Buffer.concat(chunks).toString());}catch{throw new CloudError(502,'Gemini returned an unreadable weight insight.');}
   const report=extractWeight(json,context.pack);
   const latest=await this.context();if(latest.key!==context.key)throw new CloudError(409,'Your readings changed during analysis. Generate again for the updated history.');
   const stored=await this.api.json('/rest/v1/rpc/finish_weight_review',{method:'POST',body:{target_id:id,result_status:'complete',result_report:report,result_evidence:context.pack}});
   if(!stored)throw new CloudError(409,'Your weight sharing choice changed. This insight was not published.');
   return this.item({id,report,evidence:context.pack,finished_at:new Date().toISOString(),model_id:context.model,evidence_key:context.key},context.key);
  }catch(e){await this.api.json('/rest/v1/rpc/finish_weight_review',{method:'POST',body:{target_id:id,result_status:'failed',result_report:null,result_evidence:null}}).catch(()=>{});throw e;}
 }
}
