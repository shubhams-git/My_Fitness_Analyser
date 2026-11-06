import { createHash } from 'node:crypto';
import { CloudError } from './supabase.mjs';
import { coachingEvidence } from '../analysis/coaching-evidence.mjs';
import { COACH_SCHEMA,COACH_PROMPT,COACH_SYSTEM,DISCLOSURE,coachingSchema,validateCoaching } from '../analysis/coaching-contract.mjs';
const MODELS=['gemini-3.8-flash','gemini-3.7-flash','gemini-3.6-flash'];
export async function aiPreference(api){const rows=await api.json(`/rest/v1/ai_preferences?owner_id=eq.${api.config.owner}&select=enabled,disclosure_version,revision,updated_at`),r=rows[0];return {enabled:r?.disclosure_version===DISCLOSURE?r.enabled:null,revision:r?Number(r.revision):0,disclosureVersion:DISCLOSURE,updatedAt:r?.updated_at||null};}
export async function setAiPreference(api,enabled){if(typeof enabled!=='boolean')throw new CloudError(400,'Choose whether to allow Gemini analysis.');return api.json('/rest/v1/rpc/set_ai_preference',{method:'POST',body:{allow_analysis:enabled,disclosure:DISCLOSURE}});}
// Provider supports a schema subset; application validation keeps all constraints.
function providerSchema(value){if(Array.isArray(value))return value.map(providerSchema);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!['minLength','maxLength','uniqueItems'].includes(k)).map(([k,v])=>[k,providerSchema(v)]));return value;}
export function coachingRequest(pack,model){return {model,store:false,system_instruction:COACH_SYSTEM,input:JSON.stringify({schemaVersion:COACH_SCHEMA,evidenceHash:pack.hash,...pack.content}),response_format:{type:'text',mime_type:'application/json',schema:providerSchema(coachingSchema(pack))},generation_config:{thinking_level:'high',max_output_tokens:16384}};}
export function extractCoaching(result,pack){
 if(result.status!=='completed')throw new CloudError(502,'Gemini did not finish a complete briefing. Your training record is unchanged.');
 const outputs=result.steps?.filter(s=>s.type==='model_output')||[];
 if(outputs.length!==1||outputs[0].content?.some(c=>c.type!=='text'))throw new CloudError(502,'Gemini returned an unexpected briefing format.');
 let report;try{report=JSON.parse(outputs[0].content.map(c=>c.text).join(''));validateCoaching(report,pack);}catch{throw new CloudError(502,'The briefing did not pass its evidence checks. Your training record is unchanged.');}return report;
}
export class TrainingIntelligence {
 constructor(api,library,{env=process.env,fetcher=fetch}={}){this.api=api;this.library=library;this.env=env;this.fetcher=fetcher;}
 configured(){return Boolean(this.env.GEMINI_API_KEY&&this.env.GEMINI_FREE_TIER_CONFIRMED==='1'&&MODELS.includes(this.env.GEMINI_MODEL||'gemini-3.6-flash'));}
 async context(){const pack=coachingEvidence(await this.library.read()),model=this.env.GEMINI_MODEL||'gemini-3.6-flash',key=createHash('sha256').update(JSON.stringify([this.api.config.owner,pack.hash,model,COACH_PROMPT,COACH_SCHEMA])).digest('hex');return {pack,model,key};}
 async saved(context){
  const path=`/rest/v1/analysis_reports?owner_id=eq.${this.api.config.owner}&status=eq.complete&order=created_at.desc`;
  const exact=await this.api.json(path+`&evidence_key=eq.${context.key}&limit=1`),rows=exact.length?exact:await this.api.json(path+'&limit=5');
  const valid=rows.filter(r=>{try{if(r.schema_version!==COACH_SCHEMA||r.prompt_version!==COACH_PROMPT||!r.evidence||createHash('sha256').update(JSON.stringify(r.evidence.content)).digest('hex')!==r.evidence.hash)return false;validateCoaching(r.report,r.evidence);return true;}catch{return false;}});
  return valid.find(r=>r.evidence_key===context.key)||valid[0]||null;
 }
 item(row,key){return row?{id:row.id,report:row.report,evidence:row.evidence.content,mapping:row.evidence.mapping,generatedAt:row.finished_at,model:row.model_id,stale:row.evidence_key!==key}:null;}
 async status(){const consent=await aiPreference(this.api),base={consent,configured:this.configured(),model:this.env.GEMINI_MODEL||'gemini-3.6-flash'};if(consent.enabled!==true)return {...base,review:null};const context=await this.context();return {...base,runs:context.pack.content.sessions.length,review:this.item(await this.saved(context),context.key)};}
 async generate(){
  let pref=await aiPreference(this.api);if(pref.enabled!==true)throw new CloudError(403,'Allow Gemini analysis in your AI settings first.');
  if(!this.configured())throw new CloudError(409,'Gemini is unavailable. The server needs a supported Flash model and a confirmed Free-tier project.');
  const context=await this.context();if(context.pack.content.sessions.length<2)throw new CloudError(409,'Import at least two runs before requesting a history briefing.');
  const cached=await this.saved(context);if(cached?.evidence_key===context.key)return this.item(cached,context.key);
  const claim=await this.api.request('/rest/v1/rpc/begin_training_review',{method:'POST',body:{evidence_key:context.key,model_id:context.model,prompt_version:COACH_PROMPT,schema_version:COACH_SCHEMA}});
  if(!claim.ok)throw new CloudError(claim.status===429?429:claim.status===403?403:409,claim.status===429?'Your review limit is reached. Try tomorrow.':claim.status===403?'Gemini permission changed. Check your AI settings.':'A review is already running or was just requested. Try again shortly.');
  const id=await claim.json();
  try{
   // Recheck just before transmission. Revocation after this point cannot recall a request.
   pref=await aiPreference(this.api);if(pref.enabled!==true)throw new CloudError(403,'Gemini analysis was switched off.');
   let result;try{result=await this.fetcher('https://generativelanguage.googleapis.com/v1beta/interactions',{method:'POST',redirect:'error',signal:AbortSignal.timeout(90000),headers:{'Content-Type':'application/json','x-goog-api-key':this.env.GEMINI_API_KEY,'Api-Revision':'2026-05-20'},body:JSON.stringify(coachingRequest(context.pack,context.model))});}catch{throw new CloudError(503,'Gemini could not be reached. Your saved record is unchanged.');}
   if(!result.ok)throw new CloudError(result.status===429?429:503,result.status===429?'Gemini’s free quota is unavailable. Try later; no paid fallback was used.':'Gemini could not complete this briefing. Your saved record is unchanged.');
   let size=0;const chunks=[];for await(const c of result.body){size+=c.length;if(size>256000)throw new CloudError(502,'Gemini returned an oversized briefing.');chunks.push(c);}
   let json;try{json=JSON.parse(Buffer.concat(chunks).toString());}catch{throw new CloudError(502,'Gemini returned an unreadable briefing.');}
   const report=extractCoaching(json,context.pack);
   const stored=await this.api.json('/rest/v1/rpc/finish_training_review',{method:'POST',body:{target_id:id,result_status:'complete',result_report:report,result_evidence:context.pack}});
   if(!stored)throw new CloudError(409,'Your AI preference changed. This briefing was not published.');
   return this.item({id,report,evidence:context.pack,finished_at:new Date().toISOString(),model_id:context.model,evidence_key:context.key},context.key);
  }catch(error){await this.api.json('/rest/v1/rpc/finish_training_review',{method:'POST',body:{target_id:id,result_status:'failed',result_report:null,result_evidence:null}}).catch(()=>{});throw error;}
 }
}
