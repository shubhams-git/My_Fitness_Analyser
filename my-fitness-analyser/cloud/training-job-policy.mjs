import {createHmac,timingSafeEqual} from 'node:crypto';
import {ANALYSIS_ROUTE} from './gemini-router.mjs';

export const TRAINING_JOB_POLICY='durable-coach-v4';
export const TRAINING_ROUTE=ANALYSIS_ROUTE;

// The worker trusts only evidence built by the app server, even if a member
// bypasses the app and calls the enqueue RPC with their own Supabase JWT.
export function signTrainingJob(key,{owner,evidenceKey,consentRevision,pack}){
 return createHmac('sha256',key).update('training-job:v1:').update(JSON.stringify([owner,evidenceKey,String(consentRevision),pack.hash])).digest('hex');
}

export function validJobSignature(keys,job){
 if(!/^[a-f0-9]{64}$/.test(job.signature||''))return false;
 return keys.some(key=>timingSafeEqual(Buffer.from(job.signature,'hex'),Buffer.from(signTrainingJob(key,job),'hex')));
}
