import {createHmac,timingSafeEqual} from 'node:crypto';

export const TRAINING_JOB_POLICY='durable-coach-v2';
export const TRAINING_ROUTE=Object.freeze([
 {model:'gemini-3.5-flash-lite',thinking:'medium',timeout:90000,maxOutput:16384,endpoint:'generateContent'},
 {model:'gemini-3.6-flash',thinking:'medium',timeout:100000,maxOutput:24576,endpoint:'generateContent'},
 {model:'gemini-3.1-flash-lite',thinking:'low',timeout:75000,maxOutput:16384,endpoint:'generateContent'}
]);

// The worker trusts only evidence built by the app server, even if a member
// bypasses the app and calls the enqueue RPC with their own Supabase JWT.
export function signTrainingJob(key,{owner,evidenceKey,consentRevision,pack}){
 return createHmac('sha256',key).update('training-job:v1:').update(JSON.stringify([owner,evidenceKey,String(consentRevision),pack.hash])).digest('hex');
}

export function validJobSignature(keys,job){
 if(!/^[a-f0-9]{64}$/.test(job.signature||''))return false;
 return keys.some(key=>timingSafeEqual(Buffer.from(job.signature,'hex'),Buffer.from(signTrainingJob(key,job),'hex')));
}
