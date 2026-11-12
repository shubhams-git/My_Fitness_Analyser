import {CloudGoals} from './goals.mjs';
import {MODEL_POLICY,modelRoute,generationConfig,routedGemini,geminiKeys,geminiConfigured,sharedGeminiKey} from './gemini-router.mjs';
import { createHash } from 'node:crypto';
import { CloudError } from './supabase.mjs';
import { CloudJournal } from './journal.mjs';
import { weightEvidence } from '../analysis/weight-evidence.mjs';
import { evidenceHash } from '../analysis/coaching-evidence.mjs';
import { WEIGHT_SCHEMA,WEIGHT_PROMPT,WEIGHT_DISCLOSURE,WEIGHT_SYSTEM,weightSchema,validateWeightReport } from '../analysis/weight-contract.mjs';
import { providerSchema } from '../analysis/gemini-schema.mjs';
export function weightRequest(pack,model,thinking='high'){return {model,store:false,system_instruction:WEIGHT_SYSTEM,input:JSON.stringify({schemaVersion:WEIGHT_SCHEMA,evidenceHash:pack.hash,...pack.content}),response_format:{type:'text',mime_type:'application/json',schema:providerSchema(weightSchema(pack))},generation_config:generationConfig(model,thinking)};}
export function extractWeight(result,pack){
 const outputs=result.steps?.filter(s=>s.type==='model_output')||[];
 if(result.status!=='completed'||outputs.length!==1||!outputs[0].content?.length||outputs[0].content.some(c=>c.type!=='text'))throw new CloudError(502,'Gemini did not return a complete weight insight.');
 try{return validateWeightReport(JSON.parse(outputs[0].content.map(c=>c.text).join('')),pack);}catch(e){console.warn('Weight insight rejected:',e.weightCode||'format');throw new CloudError(502,'The weight insight did not pass its evidence checks. Your readings are unchanged.');}
}
export class WeightIntelligence {
 constructor(api,{env=process.env,fetcher=fetch,journal=new CloudJournal(api),goals=new CloudGoals(api)}={}){this.api=api;this.env=env;this.fetcher=fetcher;this.journal=journal;this.goals=goals;}
 async preference(){const rows=await this.api.json(`/rest/v1/weight_ai_preferences?owner_id=eq.${this.api.config.owner}&select=enabled,disclosure_version,revision,updated_at`),r=rows[0];return {enabled:r?.disclosure_version===WEIGHT_DISCLOSURE?r.enabled:null,revision:r?Number(r.revision):0,disclosureVersion:WEIGHT_DISCLOSURE};}
 async setPreference(enabled){if(typeof enabled!=='boolean')throw new CloudError(400,'Choose whether to allow weight analysis.');return this.api.json('/rest/v1/rpc/set_weight_ai_preference',{method:'POST',body:{allow_analysis:enabled,disclosure:WEIGHT_DISCLOSURE}});}
 configured(){return geminiConfigured(this.env);}
 async context(){const [data,goals]=await Promise.all([this.journal.dataset({window:'all'}),this.goals.snapshot()]),pack=weightEvidence(data,{goalVersions:goals.versions}),model=modelRoute('weight-coaching')[0].model;return {pack,model,key:createHash('sha256').update(JSON.stringify([this.api.config.owner,pack.hash,MODEL_POLICY,WEIGHT_PROMPT,WEIGHT_SCHEMA])).digest('hex')};}
 async saved(context){const rows=await this.api.json(`/rest/v1/weight_analysis_reports?owner_id=eq.${this.api.config.owner}&status=eq.complete&order=created_at.desc&limit=5`);return rows.filter(r=>{try{if(r.schema_version!==WEIGHT_SCHEMA||![WEIGHT_PROMPT,'weight-coach-v3'].includes(r.prompt_version)||evidenceHash(r.evidence.content)!==r.evidence.hash)return false;validateWeightReport(r.report,r.evidence);return true;}catch{return false;}}).sort((a,b)=>(b.evidence_key===context.key)-(a.evidence_key===context.key))[0]||null;}
 item(row,key){return row?{id:row.id,report:row.report,evidence:row.evidence.content,generatedAt:row.finished_at,model:row.model_id,modelPolicy:row.model_policy||null,attempts:row.provider_attempts||[],stale:row.evidence_key!==key}:null;}
 async status(){const consent=await this.preference(),base={consent,configured:this.configured()};if(consent.enabled!==true)return {...base,review:null};const context=await this.context();return {...base,eligible:context.pack.content.observations.length>=4&&(context.pack.content.facts.find(f=>f.id==='period.span')?.value||0)>=14,recordedDays:context.pack.content.observations.length,review:this.item(await this.saved(context),context.key)};}
 async generate(){
  const pref=await this.preference();if(pref.enabled!==true)throw new CloudError(403,'Allow weight analysis before generating an insight.');
  if(!this.configured())throw new CloudError(409,'Gemini needs at least two distinct confirmed Free-tier keys for rotation.');
  const context=await this.context(),facts=context.pack.content.facts,span=facts.find(f=>f.id==='period.span')?.value||0;
  if(context.pack.content.observations.length<4||span<14)throw new CloudError(409,'Record at least four days spanning two weeks before asking for a weight insight.');
  const saved=await this.saved(context);if(saved?.evidence_key===context.key)return this.item(saved,context.key);
  const claim=await this.api.request('/rest/v1/rpc/begin_weight_review',{method:'POST',body:{evidence_key:context.key,model_id:context.model,prompt_version:WEIGHT_PROMPT,schema_version:WEIGHT_SCHEMA}});
  if(!claim.ok)throw new CloudError(claim.status===429?429:409,claim.status===429?'Your weight-insight limit is reached. Try tomorrow.':'A weight insight is already running, or your sharing choice changed. Try again shortly.');
  const id=await claim.json(),keys=geminiKeys(this.env);
  let trace=[];try{
   const routed=await routedGemini({task:'weight-coaching',keys,reserveKey:sharedGeminiKey(this.api,'weight-coaching',id,keys),fetcher:this.fetcher,request:entry=>weightRequest(context.pack,entry.model,entry.thinking),validate:json=>extractWeight(json,context.pack),beforeAttempt:async()=>{if((await this.context()).key!==context.key)throw new CloudError(409,'Your readings or goal changed. Review the updated trend.');const latestPref=await this.preference();if(latestPref.enabled!==true||latestPref.revision!==pref.revision)throw new CloudError(403,'Weight sharing changed. This insight stopped.');}});
   trace=routed.attempts;const report=routed.report;
   const latest=await this.context();if(latest.key!==context.key)throw new CloudError(409,'Your readings changed during analysis. Generate again for the updated history.');
   const stored=await this.api.json('/rest/v1/rpc/finish_weight_review_v2',{method:'POST',body:{target_id:id,result_status:'complete',result_report:report,result_evidence:context.pack,result_model:routed.model,attempt_log:trace}});
   if(!stored)throw new CloudError(409,'Your weight sharing choice changed. This insight was not published.');
   return this.item({id,report,evidence:context.pack,finished_at:new Date().toISOString(),model_id:routed.model,model_policy:MODEL_POLICY,provider_attempts:trace,evidence_key:context.key},context.key);
  }catch(e){await this.api.json('/rest/v1/rpc/finish_weight_review_v2',{method:'POST',body:{target_id:id,result_status:'failed',result_report:null,result_evidence:null,result_model:null,attempt_log:e.attempts||trace}}).catch(()=>{});throw e;}
 }
}
