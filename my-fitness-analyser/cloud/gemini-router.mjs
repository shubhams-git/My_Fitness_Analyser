import {randomInt} from 'node:crypto';
import {CloudError} from './supabase.mjs';
export const MODEL_POLICY='flash-routes-v2';
const intensive=new Set(['run-coaching','weight-coaching','goal-analysis','zone-analysis']);
const basic=new Set(['summary-format','activity-label','import-field-normalization']);
export function modelRoute(task){
 if(intensive.has(task))return [{model:'gemini-3.6-flash',thinking:'high',timeout:75000},{model:'gemini-3.8-flash',thinking:null,timeout:65000},{model:'gemini-3.1-flash-lite',thinking:null,timeout:40000}];
 if(basic.has(task))return [{model:'gemini-3.8-flash',thinking:'low',timeout:25000},{model:'gemini-3.6-flash',thinking:'low',timeout:25000},{model:'gemini-3.5-flash-lite',thinking:'low',timeout:20000},{model:'gemini-3.1-flash-lite',thinking:null,timeout:20000}];
 throw new CloudError(400,'Unsupported intelligence task.');
}
export function generationConfig(model,thinking='high',maxOutput=16384){return {max_output_tokens:maxOutput,...(thinking?{thinking_level:thinking}:{})};}
export function geminiKeys(env){const names=['GEMINI_API_KEY',...(env.GEMINI_KEY_POOL_FREE_CONFIRMED==='1'?Array.from({length:4},(_,i)=>'GEMINI_API_KEY_'+(i+2)):[])];return [...new Set(names.map(n=>env[n]?.trim()).filter(Boolean))];}
let cursor;
export async function routedGemini({task,key,keys=key?[key]:[],request,validate,beforeAttempt=async()=>{},fetcher=fetch,totalMs=210000,clock=Date.now}){
 if(!keys.length)throw new CloudError(503,'Gemini credentials are unavailable.');
 cursor??=randomInt(keys.length);
 const attempts=[],deadline=clock()+totalMs;let lastStatus=503;
 for(const entry of modelRoute(task)){
  if(clock()>=deadline)break;
  // Consent and evidence are checked outside the provider-failure catch. They
  // are authorization boundaries, not reasons to try a different model.
  await beforeAttempt(entry);
  const remaining=deadline-clock();if(remaining<=0)break;
  const attempt={model:entry.model,thinking:entry.thinking||'default',outcome:'network',httpStatus:null};attempts.push(attempt);
  try{
   const response=await fetcher('https://generativelanguage.googleapis.com/v1beta/interactions',{method:'POST',redirect:'error',signal:AbortSignal.timeout(Math.max(1,Math.min(entry.timeout,remaining))),headers:{'Content-Type':'application/json','x-goog-api-key':keys[cursor++%keys.length],'Api-Revision':'2026-05-20'},body:JSON.stringify(request(entry))});
   attempt.httpStatus=response.status;
   if(!response.ok){attempt.outcome='http';lastStatus=response.status;await response.body?.cancel().catch(()=>{});continue;}
   let size=0;const chunks=[];for await(const chunk of response.body){size+=chunk.length;if(size>256000)throw new Error('size');chunks.push(chunk);}
   let json;try{json=JSON.parse(Buffer.concat(chunks).toString());}catch{attempt.outcome='invalid';lastStatus=502;continue;}
   let report;try{report=validate(json);}catch{attempt.outcome='invalid';lastStatus=502;continue;}
   attempt.outcome='complete';return {report,model:entry.model,attempts,policy:MODEL_POLICY};
  }catch{attempt.outcome='network';lastStatus=503;}
 }
 const error=new CloudError(lastStatus===429?429:lastStatus===502?502:503,`Gemini could not finish this insight after its available free-model fallbacks${lastStatus&&lastStatus!==502&&lastStatus!==503?' (HTTP '+lastStatus+')':''}. Your goals, charts and saved records are intact. Try later.`);error.attempts=attempts;throw error;
}
