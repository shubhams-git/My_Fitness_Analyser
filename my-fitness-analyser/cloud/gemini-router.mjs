import {createHash} from 'node:crypto';
import {CloudError} from './supabase.mjs';
export const MODEL_POLICY='flash-routes-v2';
const intensive=new Set(['run-coaching','weight-coaching','goal-analysis','zone-analysis']);
const basic=new Set(['summary-format','activity-label','import-field-normalization']);
export function modelRoute(task){
 if(task==='run-coaching')return [
  {model:'gemini-3.8-flash',thinking:'high',timeout:50000},
  {model:'gemini-3.6-flash',thinking:'high',timeout:55000},
  {model:'gemini-3.1-flash-lite',thinking:'medium',timeout:40000}
 ];
 if(intensive.has(task))return [{model:'gemini-3.6-flash',thinking:'high',timeout:75000},{model:'gemini-3.8-flash',thinking:null,timeout:65000},{model:'gemini-3.1-flash-lite',thinking:null,timeout:40000}];
 if(basic.has(task))return [{model:'gemini-3.8-flash',thinking:'low',timeout:25000},{model:'gemini-3.6-flash',thinking:'low',timeout:25000},{model:'gemini-3.5-flash-lite',thinking:'low',timeout:20000},{model:'gemini-3.1-flash-lite',thinking:null,timeout:20000}];
 throw new CloudError(400,'Unsupported intelligence task.');
}
export function generationConfig(model,thinking='high',maxOutput=16384){return {max_output_tokens:maxOutput,...(thinking?{thinking_level:thinking}:{})};}
export function geminiKeys(env){const names=['GEMINI_API_KEY',...(env.GEMINI_KEY_POOL_FREE_CONFIRMED==='1'?Array.from({length:4},(_,i)=>'GEMINI_API_KEY_'+(i+2)):[])];return [...new Set(names.map(n=>env[n]?.trim()).filter(Boolean))];}
export function geminiConfigured(env){
 return env.GEMINI_FREE_TIER_CONFIRMED==='1'&&geminiKeys(env).length>=2;
}
export function sharedGeminiKey(api,task,reviewId,keys){
 const keyIds=keys.map(key=>createHash('sha256').update('gemini-key-slot:'+key).digest('hex'));
 return async()=>{
  let slot;
  try{
   slot=await api.json('/rest/v1/rpc/reserve_gemini_key_slot',{method:'POST',body:{review_kind:task,review_id:reviewId,key_ids:keyIds}});
  }catch{
   throw new CloudError(503,'Gemini key rotation is unavailable. Try again later.');
  }
  if(!Number.isInteger(slot)||!keys[slot-1])throw new CloudError(503,'Gemini key rotation is unavailable. Try again later.');
  return keys[slot-1];
 };
}
let lastLocalKey;
export async function routedGemini({task,keys,request,validate,reserveKey,beforeAttempt=async()=>{},fetcher=fetch,totalMs=210000,clock=Date.now}){
 keys=[...new Set(keys||[])];
 if(keys.length<2)throw new CloudError(503,'Gemini needs at least two distinct confirmed Free-tier keys for rotation.');
 const nextKey=reserveKey||(()=>{
  lastLocalKey=keys[(keys.indexOf(lastLocalKey)+1)%keys.length];
  return lastLocalKey;
 });
 const attempts=[],deadline=clock()+totalMs;let lastStatus=503;
 const route=modelRoute(task);
 const attemptLimit=task==='weight-coaching'?4:7;
 for(const [modelIndex,entry] of route.entries()){
  for(let keyOffset=0;keyOffset<keys.length;keyOffset++){
  // Reserve one attempt for each remaining model.
  if(clock()>=deadline||attempts.length>=attemptLimit-(route.length-modelIndex-1))break;
  // Consent and evidence are checked outside the provider-failure catch. They
  // are authorization boundaries, not reasons to try a different model.
  await beforeAttempt(entry);
  if(clock()>=deadline)break;
  const body=JSON.stringify(request(entry));
  const apiKey=await nextKey();
  const remaining=deadline-clock();
  if(!keys.includes(apiKey))throw new CloudError(503,'Gemini key rotation returned an invalid slot.');
  const attempt={model:entry.model,thinking:entry.thinking||'default',outcome:'network',httpStatus:null};attempts.push(attempt);
  try{
   const response=await fetcher('https://generativelanguage.googleapis.com/v1beta/interactions',{method:'POST',redirect:'error',signal:AbortSignal.timeout(Math.max(1,Math.min(entry.timeout,remaining))),headers:{'Content-Type':'application/json','x-goog-api-key':apiKey,'Api-Revision':'2026-05-20'},body});
   attempt.httpStatus=response.status;
   if(!response.ok){
    attempt.outcome='http';lastStatus=response.status;
    let rejectedKey=false;
    if(response.status===400){
     const body=await response.json().catch(()=>null);
     rejectedKey=body?.error?.details?.some?.(detail=>detail?.reason==='API_KEY_INVALID')===true;
     const message=typeof body?.error?.message==='string'?body.error.message:'';
     const reason=rejectedKey?'key rejected':/schema|response_format/i.test(message)?'schema rejected':'invalid request';
     console.warn('Gemini request rejected',entry.model,reason);
    }else await response.body?.cancel().catch(()=>{});
    if(rejectedKey||[401,403,429].includes(response.status))continue;
    break;
   }
   let size=0;const chunks=[];for await(const chunk of response.body){size+=chunk.length;if(size>256000)throw new Error('size');chunks.push(chunk);}
   let json;try{json=JSON.parse(Buffer.concat(chunks).toString());}catch{attempt.outcome='invalid';lastStatus=502;break;}
   let report;try{report=validate(json,entry);}catch{attempt.outcome='invalid';lastStatus=502;break;}
   attempt.outcome='complete';return {report,model:entry.model,attempts,policy:MODEL_POLICY};
  }catch{attempt.outcome='network';lastStatus=503;break;}
  }
 }
 const error=new CloudError(lastStatus===429?429:lastStatus===502?502:503,`Gemini could not finish this insight after its available free-model fallbacks${lastStatus&&lastStatus!==502&&lastStatus!==503?' (HTTP '+lastStatus+')':''}. Your goals, charts and saved records are intact. Try later.`);error.attempts=attempts;throw error;
}
