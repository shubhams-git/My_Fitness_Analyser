import {SupabaseApi,cloudConfig} from './supabase.mjs';
import {geminiKeys,geminiConfigured,geminiKeyIds,geminiAttempt} from './gemini-router.mjs';
import {coachingGenerationRequest,extractCoaching} from './intelligence.mjs';
import {COACH_PROMPT,PREVIOUS_COACH_PROMPT,COACH_SCHEMA} from '../analysis/coaching-contract.mjs';
import {evidenceHash} from '../analysis/coaching-evidence.mjs';
import {RECORDED_COACH,recordedTrainingReport} from '../analysis/recorded-coaching.mjs';
import {TRAINING_ROUTE,validJobSignature} from './training-job-policy.mjs';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function runTrainingJob(api,{id,capability},{env=process.env,fetcher=fetch}={}){
 if(!uuid.test(id||'')||!uuid.test(capability||''))return false;
 const identity={job_id:id,job_capability:capability};
 const rpc=(name,body)=>api.json('/rest/v1/rpc/'+name,{method:'POST',body});
 const job=await rpc('claim_training_job',identity);
 if(!job)return false;
 const lease={...identity,job_lease:job.lease};
 const finish=({attempt=null,report=null,retrySeconds=0,failure=null}={})=>rpc('finish_training_job',{
  ...lease,attempt,result_report:report,retry_seconds:retrySeconds,failure_code:failure
 });
 const keys=geminiKeys(env),entry=TRAINING_ROUTE[job.step];
 if(!geminiConfigured(env)||keys.length<2)return finish({failure:'configuration'});
 if(!entry||![COACH_PROMPT,PREVIOUS_COACH_PROMPT].includes(job.promptVersion)||job.schemaVersion!==COACH_SCHEMA||!job.pack?.content||
  !validJobSignature(keys,job)||evidenceHash(job.pack.content)!==job.pack.hash)return finish({failure:'evidence'});
 const body=coachingGenerationRequest(job.pack,{includeNote:job.promptVersion===COACH_PROMPT});
 const saveRecorded=result=>finish({...result,report:recordedTrainingReport(job.pack),failure:RECORDED_COACH});
 const finishAttempt=result=>!result.report&&job.step===TRAINING_ROUTE.length-1?saveRecorded(result):finish(result);
 // Consent is checked inside this reservation, immediately before transmission.
 const budget=await rpc('reserve_training_gemini',{...lease,key_ids:geminiKeyIds(keys),target_model:entry.model});
 if(!budget)return finish({failure:'cancelled'});
 if(budget.dailyLimit)return saveRecorded({attempt:{model:entry.model,thinking:'default',outcome:'quota',httpStatus:null,elapsedMs:0}});
 if(budget.modelBlocked)return finishAttempt({attempt:{model:entry.model,thinking:'default',outcome:'quota',httpStatus:null,elapsedMs:0}});
 if(budget.retryAt)return true; // Database released the lease and scheduled the next eligible time.
 if(!Number.isInteger(budget.slot)||!keys[budget.slot-1])return finish({failure:'configuration'});
 const result=await geminiAttempt({entry,apiKey:keys[budget.slot-1],body,validate:json=>extractCoaching(json,job.pack,{compact:true}),fetcher});
 console.info('Training Gemini attempt',JSON.stringify(result.attempt));
 return finishAttempt(result);
}

export async function trainingWorker(request,response,{env=process.env,apiFactory=config=>new SupabaseApi(config,null)}={}){
 response.setHeader('Cache-Control','no-store');
 if(request.method!=='POST'){response.statusCode=405;response.end();return;}
 try{
  const body=request.body;
  const data=typeof body==='string'||Buffer.isBuffer(body)?JSON.parse(body.toString()):body;
  if(!data||!uuid.test(data.id||'')||!uuid.test(data.capability||'')){response.statusCode=400;response.end();return;}
  await runTrainingJob(apiFactory(cloudConfig(env)),data,{env});
  response.statusCode=204;
 }catch(error){console.warn('Training worker could not complete',error.status||'internal');response.statusCode=503;}
 response.end();
}
