import {CloudGoals} from './goals.mjs';
import {MODEL_POLICY,modelRoute,generationConfig,routedGemini,geminiKeys} from './gemini-router.mjs';
import {CloudZones} from './zones.mjs';
import { createHash } from 'node:crypto';
import { CloudError } from './supabase.mjs';
import { coachingEvidence,evidenceHash,legacyEvidenceHash } from '../analysis/coaching-evidence.mjs';
import { COACH_SCHEMA,COACH_PROMPT,COACH_SYSTEM,DISCLOSURE,coachingSchema,discomfortVerdict,validateCoaching } from '../analysis/coaching-contract.mjs';
import { localDay } from './journal.mjs';
import { providerSchema } from '../analysis/gemini-schema.mjs';
export const TRAINING_DISCLOSURE='gemini-training-v2';
export async function aiPreference(api,disclosure=DISCLOSURE){const rows=await api.json(`/rest/v1/ai_preferences?owner_id=eq.${api.config.owner}&select=enabled,disclosure_version,revision,updated_at`),r=rows[0];return {enabled:r?.disclosure_version===disclosure?r.enabled:r?.enabled===false?false:null,revision:r?Number(r.revision):0,disclosureVersion:disclosure,updatedAt:r?.updated_at||null};}
export async function setAiPreference(api,enabled,disclosure=DISCLOSURE){if(typeof enabled!=='boolean')throw new CloudError(400,'Choose whether to allow Gemini analysis.');return api.json('/rest/v1/rpc/set_ai_preference',{method:'POST',body:{allow_analysis:enabled,disclosure}});}
export async function recentStrength(api,anchor){
 const start=new Date(Date.parse(anchor)-13*86400000).toISOString().slice(0,10);
 const filter=`owner_id=eq.${api.config.owner}&deleted=eq.false&date_key=gte.${start}&date_key=lte.${anchor}`;
 const [manual,imported]=await Promise.all([
  api.json(`/rest/v1/strength_entries_latest?${filter}&select=date_key,focus:data->>focus,minutes:data->>mins,discomfort:data->checkin->>discomfort`),
  api.json(`/rest/v1/journal_sessions_latest?${filter}&select=date_key,focus,minutes`)
 ]);
 const manualDays=new Set(manual.map(row=>row.date_key));
 return [...manual,...imported.filter(row=>!manualDays.has(row.date_key))];
}
export function coachingRequest(pack,model,thinking='high'){
 const schema=providerSchema(coachingSchema(pack));
 const chartOptions=schema.properties.charts.items.anyOf;
 if(chartOptions){
  // Use one provider object. The local contract checks measurements for each selected chart type.
  schema.properties.charts.items={
   type:'object',required:['type','sessionIds'],additionalProperties:false,
   properties:{type:{type:'string',enum:chartOptions.flatMap(option=>option.properties.type.enum)},
    sessionIds:{type:'array',minItems:2,maxItems:8,items:{type:'string'}}}
  };
 }
 return {
  model,store:false,system_instruction:COACH_SYSTEM,
  input:JSON.stringify({schemaVersion:COACH_SCHEMA,evidenceHash:pack.hash,...pack.content}),
  response_format:{type:'text',mime_type:'application/json',schema},
  generation_config:generationConfig(model,thinking)
 };
}
export function extractCoaching(result,pack){
 if(result.status!=='completed')throw new CloudError(502,'Gemini did not finish a complete briefing. Your training record is unchanged.');
 const outputs=result.steps?.filter(s=>s.type==='model_output')||[];
 if(outputs.length!==1||outputs[0].content?.some(c=>c.type!=='text'))throw new CloudError(502,'Gemini returned an unexpected briefing format.');
 let report;try{
  report=JSON.parse(outputs[0].content.map(c=>c.text).join(''));
  // Main claim and chart references must pass. An optional weak observation
  // should not discard an otherwise sound brief or trigger another API call.
  validateCoaching({...report,findings:[]},pack);
  if(!Array.isArray(report.findings)||report.findings.length>3)throw new Error('Invalid findings');
  report.findings=report.findings.filter(f=>{try{validateCoaching({...report,findings:[f]},pack);return true;}catch{return false;}});
  validateCoaching(report,pack);
 }catch{throw new CloudError(502,'The briefing did not pass its evidence checks. Your training record is unchanged.');}return report;
}
function recordedBrief(context,reason){
 const {pack}=context;
 const distance=pack.content.facts.find(f=>/^s\d+\.distanceM$/.test(f.id)&&f.value>=1000);
 const factId=distance?.id||'history.runs';
 const paceId=distance?.id.replace('distanceM','paceSPerKm');
 const hasPace=pack.content.facts.some(f=>f.id===paceId);
 const coverage={text:'There is no recent outdoor Garmin run in your record.',
  explanation:'Recent workout summaries can show what you recorded. There is too little running evidence here to judge a change in pace.',
  nextAction:'If you run next, choose a familiar effort and note how it felt.',
  factIds:['volume.28d.recent.runs'],signal:{factId:'volume.28d.recent.runs',direction:'none'}};
 const report={schemaVersion:COACH_SCHEMA,evidenceHash:pack.hash,verdict:discomfortVerdict(pack)||(reason==='coverage'?coverage:{
  text:distance?'You covered {'+factId+'} in your latest recorded run over a kilometre.':'You have {'+factId+'} runs in your log.',
  explanation:hasPace?'Your recorded pace was {'+paceId+'}. This run on its own does not show a trend.':'There is too little comparable detail here to judge a change in performance.',
  nextAction:'If you run next, keep the effort familiar and record how it felt.',
  factIds:hasPace?[factId,paceId]:[factId],signal:{factId,direction:'none'}
 }),findings:[],charts:[]};
 validateCoaching(report,pack);
 return {report,evidence:pack.content,mapping:pack.mapping,generatedAt:new Date().toISOString(),model:null,stale:false,fallback:reason};
}
const recordedReason=context=>discomfortVerdict(context.pack)?'discomfort'
 :context.pack.content.workouts&&context.pack.content.facts.some(f=>f.id==='volume.28d.recent.runs'&&f.value===0)?'coverage':null;
export class TrainingIntelligence {
 constructor(api,library,{env=process.env,fetcher=fetch,goals=new CloudGoals(api),zones=new CloudZones(api),wholeTraining=false}={}){this.api=api;this.library=library;this.env=env;this.fetcher=fetcher;this.goals=goals;this.zones=zones;this.wholeTraining=wholeTraining;this.disclosure=wholeTraining?TRAINING_DISCLOSURE:DISCLOSURE;}
 preference(){return aiPreference(this.api,this.disclosure);}
 configured(){return Boolean(geminiKeys(this.env).length&&this.env.GEMINI_FREE_TIER_CONFIRMED==='1');}
 async context(){const [data,profiles,goals,zones]=await Promise.all([this.library.read(),this.api.json(`/rest/v1/fitness_profiles?owner_id=eq.${this.api.config.owner}&select=timezone`),this.goals.snapshot(),this.zones.snapshot()]);const anchor=localDay(profiles[0]?.timezone||'Australia/Sydney'),strengthEntries=this.wholeTraining?await recentStrength(this.api,anchor):null;const pack=coachingEvidence(data,{anchor,strengthEntries,zoneVersions:zones.versions,goalVersions:goals.versions}),model=modelRoute('run-coaching')[0].model,fingerprint=hash=>createHash('sha256').update(JSON.stringify([this.api.config.owner,hash,MODEL_POLICY,COACH_PROMPT,COACH_SCHEMA])).digest('hex');return {pack,model,key:fingerprint(pack.hash),legacyKey:fingerprint(pack.legacyHash)};}
 async saved(context){
  const path=`/rest/v1/analysis_reports?owner_id=eq.${this.api.config.owner}&status=eq.complete&order=created_at.desc`;
  const exact=await this.api.json(path+`&or=(evidence_key.eq.${context.key},evidence_key.eq.${context.legacyKey})&limit=2`),rows=exact.length?exact:await this.api.json(path+'&limit=5');
  const valid=rows.filter(r=>{try{
   if(r.schema_version!==COACH_SCHEMA||![COACH_PROMPT,'runner-coach-v6','runner-coach-v5','runner-coach-v4'].includes(r.prompt_version)||!r.evidence)return false;
   const canonical=evidenceHash(r.evidence.content),legacy=canonical!==r.evidence.hash&&legacyEvidenceHash(r.evidence.content)===r.evidence.hash;
   if(canonical!==r.evidence.hash&&!legacy)return false;validateCoaching(r.report,r.evidence);if(legacy&&r.evidence_key===context.legacyKey&&canonical===context.pack.hash&&r.model_id===context.model)r.evidence_key=context.key;return true;
  }catch{return false;}});
  return valid.find(r=>r.evidence_key===context.key)||valid[0]||null;
 }
 item(row,key){return row?{id:row.id,report:row.report,evidence:row.evidence.content,mapping:row.evidence.mapping,generatedAt:row.finished_at,model:row.model_id,modelPolicy:row.model_policy||null,attempts:row.provider_attempts||[],stale:row.evidence_key!==key}:null;}
 async status(){const consent=await this.preference(),base={consent,configured:this.configured(),model:modelRoute('run-coaching')[0].model,minRuns:this.wholeTraining?1:2};if(consent.enabled!==true)return {...base,review:null};const context=await this.context(),reason=recordedReason(context);return {...base,runs:context.pack.content.sessions.length,review:reason?recordedBrief(context,reason):this.item(await this.saved(context),context.key)};}
 async generate(){
  const pref=await this.preference();if(pref.enabled!==true)throw new CloudError(403,'Allow Gemini analysis in your AI settings first.');
  const context=await this.context();
  const reason=recordedReason(context);if(reason)return recordedBrief(context,reason);
  if(!this.configured())throw new CloudError(409,'Gemini is unavailable. The server needs a supported Flash model and a confirmed Free-tier project.');
  if(context.pack.content.sessions.length<(this.wholeTraining?1:2))throw new CloudError(409,this.wholeTraining?'Sync an outdoor Garmin run before requesting your brief.':'Import at least two runs before requesting a history briefing.');
  const cached=await this.saved(context);if(cached?.evidence_key===context.key)return this.item(cached,context.key);
  const claim=await this.api.request('/rest/v1/rpc/begin_training_review',{method:'POST',body:{evidence_key:context.key,model_id:context.model,prompt_version:COACH_PROMPT,schema_version:COACH_SCHEMA}});
  if(claim.status===429)return recordedBrief(context,'cooldown');
  if(!claim.ok)throw new CloudError(claim.status===403?403:claim.status===409?409:503,claim.status===403?'Gemini permission changed. Check your AI settings.':claim.status===409?'A review is already running. Try again shortly.':'The review could not start. Please retry.');
  const id=await claim.json();
  let trace=[];try{
   const routed=await routedGemini({task:'run-coaching',keys:geminiKeys(this.env),fetcher:this.fetcher,request:entry=>coachingRequest(context.pack,entry.model,entry.thinking),validate:(json,entry)=>extractCoaching(json,context.pack),beforeAttempt:async()=>{if((await this.context()).key!==context.key)throw new CloudError(409,'Your goals, zones or training changed. Review the updated record.');const latestPref=await this.preference();if(latestPref.enabled!==true||latestPref.revision!==pref.revision)throw new CloudError(403,'Gemini sharing changed. This review stopped.');}});
   trace=routed.attempts;const report=routed.report;
   if((await this.context()).key!==context.key)throw new CloudError(409,'Your training changed during analysis. Review the updated runs.');
   const stored=await this.api.json('/rest/v1/rpc/finish_training_review_v2',{method:'POST',body:{target_id:id,result_status:'complete',result_report:report,result_evidence:context.pack,result_model:routed.model,attempt_log:trace}});
   if(!stored)throw new CloudError(409,'Your AI preference changed. This briefing was not published.');
   return this.item({id,report,evidence:context.pack,finished_at:new Date().toISOString(),model_id:routed.model,model_policy:MODEL_POLICY,provider_attempts:trace,evidence_key:context.key},context.key);
  }catch(error){
   await this.api.json('/rest/v1/rpc/finish_training_review_v2',{method:'POST',body:{target_id:id,result_status:'failed',result_report:null,result_evidence:null,result_model:null,attempt_log:error.attempts||trace}}).catch(()=>{});
   if(!error.attempts)throw error;
   console.warn('Gemini coaching attempts exhausted',JSON.stringify(error.attempts));
   const latestPref=await this.preference();
   if(latestPref.enabled!==true||latestPref.revision!==pref.revision)throw new CloudError(403,'Gemini sharing changed. This review stopped.');
   const latest=await this.context();
   return recordedBrief(latest,recordedReason(latest)||'provider');
  }
 }
}
