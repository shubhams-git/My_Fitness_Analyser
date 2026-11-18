import {CloudGoals} from './goals.mjs';
import {PRIMARY_GEMINI_MODEL,ANALYSIS_ROUTE,structuredGeminiRequest,geminiAttempt,geminiKeyIds,personalGeminiKeys} from './gemini-router.mjs';
import { createHash } from 'node:crypto';
import { CloudError } from './supabase.mjs';
import { CloudJournal } from './journal.mjs';
import { weightEvidence } from '../analysis/weight-evidence.mjs';
import { evidenceHash } from '../analysis/coaching-evidence.mjs';
import { WEIGHT_SCHEMA,WEIGHT_PROMPT,WEIGHT_DISCLOSURE,WEIGHT_SYSTEM,weightSchema,validateWeightReport } from '../analysis/weight-contract.mjs';
import { providerSchema } from '../analysis/gemini-schema.mjs';
const WEIGHT_MODEL_POLICY='weight-fallback-v2';
const weightRoute=ANALYSIS_ROUTE.map((entry,index)=>({...entry,timeout:[120000,50000,35000,25000][index]}));

export function weightRequest(pack){
 return structuredGeminiRequest({
  instruction:WEIGHT_SYSTEM,
  input:{schemaVersion:WEIGHT_SCHEMA,evidenceHash:pack.hash,...pack.content},
  schema:providerSchema(weightSchema(pack,{includeNote:true}))
 });
}
export function extractWeight(result,pack){
 const outputs=result.steps?.filter(s=>s.type==='model_output')||[];
 if(result.status!=='completed'||outputs.length!==1||!outputs[0].content?.length||outputs[0].content.some(c=>c.type!=='text'))throw new CloudError(502,'Gemini did not return a complete weight insight.');
 try{return validateWeightReport(JSON.parse(outputs[0].content.map(c=>c.text).join('')),pack);}catch(e){console.warn('Weight insight rejected:',e.weightCode||'format');throw new CloudError(502,'The weight insight did not pass its evidence checks. Your readings are unchanged.');}
}
export class WeightIntelligence {
 constructor(api,{env=process.env,fetcher=fetch,journal=new CloudJournal(api),goals=new CloudGoals(api)}={}){this.api=api;this.env=env;this.fetcher=fetcher;this.journal=journal;this.goals=goals;}
 async preference(){const rows=await this.api.json(`/rest/v1/weight_ai_preferences?owner_id=eq.${this.api.config.owner}&select=enabled,disclosure_version,revision,updated_at`),r=rows[0];return {enabled:r?.disclosure_version===WEIGHT_DISCLOSURE?r.enabled:null,revision:r?Number(r.revision):0,disclosureVersion:WEIGHT_DISCLOSURE};}
 async setPreference(enabled){if(typeof enabled!=='boolean')throw new CloudError(400,'Choose whether to allow weight analysis.');return this.api.json('/rest/v1/rpc/set_weight_ai_preference',{method:'POST',body:{allow_analysis:enabled,disclosure:WEIGHT_DISCLOSURE}});}
 configured(){return personalGeminiKeys(this.env).length>=2;}
 async providerReady(){
  if(!this.configured())return false;
  const response=await this.api.request('/rest/v1/rpc/training_worker_ready',{method:'POST',body:{}});
  return response.ok&&await response.json()===true;
 }
 async context(){const [data,goals]=await Promise.all([this.journal.dataset({window:'all'}),this.goals.snapshot()]),pack=weightEvidence(data,{goalVersions:goals.versions}),model=PRIMARY_GEMINI_MODEL.model;return {pack,model,key:createHash('sha256').update(JSON.stringify([this.api.config.owner,pack.hash,WEIGHT_MODEL_POLICY,WEIGHT_PROMPT,WEIGHT_SCHEMA])).digest('hex')};}
 async saved(context){const rows=await this.api.json(`/rest/v1/weight_analysis_reports?owner_id=eq.${this.api.config.owner}&status=eq.complete&order=created_at.desc&limit=5`);return rows.flatMap(row=>{
  try{
   if(row.schema_version!==WEIGHT_SCHEMA||![WEIGHT_PROMPT,'weight-coach-v5','weight-coach-v4','weight-coach-v3'].includes(row.prompt_version)||evidenceHash(row.evidence.content)!==row.evidence.hash)return [];
   const report=validateWeightReport(row.report,row.evidence);
   if(row.prompt_version!==WEIGHT_PROMPT)delete report.worthKnowing;
   return [{...row,report}];
  }catch{return [];}
 }).sort((a,b)=>(b.evidence_key===context.key)-(a.evidence_key===context.key))[0]||null;}
 item(row,key){return row?{id:row.id,report:row.report,evidence:row.evidence.content,generatedAt:row.finished_at,model:row.model_id,modelPolicy:row.evidence_key===key?WEIGHT_MODEL_POLICY:row.model_policy||null,attempts:row.provider_attempts||[],stale:row.evidence_key!==key}:null;}
 async status(){const consent=await this.preference(),base={consent,configured:this.configured()};if(consent.enabled!==true)return {...base,review:null};const [context,configured]=await Promise.all([this.context(),this.providerReady()]);return {...base,configured,eligible:context.pack.content.observations.length>=4&&(context.pack.content.facts.find(f=>f.id==='period.span')?.value||0)>=14,recordedDays:context.pack.content.observations.length,review:this.item(await this.saved(context),context.key)};}
 async generate(){
  const deadline=Date.now()+260000;
  const pref=await this.preference();if(pref.enabled!==true)throw new CloudError(403,'Allow weight analysis before generating an insight.');
  if(!await this.providerReady())throw new CloudError(409,'Gemini is not configured for this app.');
  const context=await this.context(),facts=context.pack.content.facts,span=facts.find(f=>f.id==='period.span')?.value||0;
  if(context.pack.content.observations.length<4||span<14)throw new CloudError(409,'Record at least four days spanning two weeks before asking for a weight insight.');
  const saved=await this.saved(context);if(saved?.evidence_key===context.key)return this.item(saved,context.key);
  const claim=await this.api.request('/rest/v1/rpc/begin_weight_review',{method:'POST',body:{evidence_key:context.key,model_id:context.model,prompt_version:WEIGHT_PROMPT,schema_version:WEIGHT_SCHEMA}});
  if(!claim.ok)throw new CloudError(claim.status===403?403:claim.status===409?409:503,
   claim.status===403?'Your weight sharing choice changed. Check your AI settings.':
   claim.status===409?'A weight insight is already running. Try again shortly.':'Couldn’t start the weight insight. Try again shortly.');
  const id=await claim.json(),keys=personalGeminiKeys(this.env);
  let trace=[];try{
   for(const entry of weightRoute){
    if(Date.now()>=deadline)break;
    if((await this.context()).key!==context.key)throw new CloudError(409,'Your readings changed during analysis. Generate again for the updated history.');
    const budget=await this.api.json('/rest/v1/rpc/reserve_weight_gemini',{method:'POST',body:{target_id:id,key_ids:geminiKeyIds(keys),target_model:entry.model}});
    if(budget.retryAt)continue;
    if(!keys[budget.slot-1])throw new CloudError(503,'The Gemini request could not start.');
    const {attempt,report,retrySeconds}=await geminiAttempt({entry,deadline,apiKey:keys[budget.slot-1],body:weightRequest(context.pack),
     beforeInput:async()=>{const current=await this.preference();return current.enabled===true&&current.revision===pref.revision;},
     validate:json=>extractWeight(json,context.pack),fetcher:this.fetcher});
    if(attempt.outcome==='consent-changed')throw new CloudError(403,'Your weight sharing choice changed. This insight stopped.');
    console.info('Weight Gemini attempt',JSON.stringify(attempt));
    if(retrySeconds)await this.api.json('/rest/v1/rpc/backoff_weight_gemini',{method:'POST',body:{target_id:id,target_model:entry.model,retry_seconds:retrySeconds}});
    trace.push({model:attempt.model,thinking:attempt.thinking,httpStatus:attempt.httpStatus,outcome:['complete','invalid','network'].includes(attempt.outcome)?attempt.outcome:attempt.httpStatus===null?'network':'http'});
    if(!report)continue;
    const latest=await this.context();if(latest.key!==context.key)throw new CloudError(409,'Your readings changed during analysis. Generate again for the updated history.');
    const stored=await this.api.json('/rest/v1/rpc/finish_weight_review_v2',{method:'POST',body:{target_id:id,result_status:'complete',result_report:report,result_evidence:context.pack,result_model:entry.model,attempt_log:trace}});
    if(!stored)throw new CloudError(409,'Your weight sharing choice changed. This insight was not published.');
    return this.item({id,report,evidence:context.pack,finished_at:new Date().toISOString(),model_id:entry.model,model_policy:WEIGHT_MODEL_POLICY,provider_attempts:trace,evidence_key:context.key},context.key);
   }
   throw new CloudError(503,'Gemini could not complete the weight insight after its model fallbacks. Your readings are unchanged. Try again later.');
  }catch(e){await this.api.json('/rest/v1/rpc/finish_weight_review_v2',{method:'POST',body:{target_id:id,result_status:'failed',result_report:null,result_evidence:null,result_model:null,attempt_log:e.attempts||trace}}).catch(()=>{});throw e;}
 }
}
