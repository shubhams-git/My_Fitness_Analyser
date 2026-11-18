// Explicit provider test using generated records only. Never reads the health library.
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { parseEnv } from 'node:util';
import { syntheticHistory } from '../prototypes/training-data.mjs';
import { coachingEvidence } from '../analysis/coaching-evidence.mjs';
import { coachingGenerationRequest,extractCoaching } from '../cloud/intelligence.mjs';
import { geminiAttempt,geminiKeys } from '../cloud/gemini-router.mjs';
import { TRAINING_ROUTE } from '../cloud/training-job-policy.mjs';
const env={...parseEnv(await readFile(new URL('../.env',import.meta.url),'utf8')),...process.env};
if(env.GEMINI_FREE_TIER_CONFIRMED!=='1')throw new Error('Confirm the Free project before this synthetic test.');
const target=process.argv[2]||TRAINING_ROUTE[0].model;
const entries=target==='--route'?TRAINING_ROUTE:[TRAINING_ROUTE.find(entry=>entry.model===target)].filter(Boolean);
const keys=geminiKeys(env);
if(!entries.length||keys.length<2)throw new Error('Provide a confirmed Free key and a supported training model or --route.');
const activities=syntheticHistory().map(a=>({...a,synthetic:false,source:'Garmin Connect'}));
const pack=coachingEvidence({activities:Object.fromEntries(activities.map(a=>[a.id,a])),feedback:{}},{anchor:'2026-11-07',strengthEntries:[]});
for(const [index,entry] of entries.entries()){
 if(index){await delay(60000);await delay(5000);}
 const {attempt,report}=await geminiAttempt({entry,apiKey:keys[index%keys.length],body:coachingGenerationRequest(pack),validate:json=>extractCoaching(json,pack,{compact:true})});
 console.log(JSON.stringify({syntheticOnly:true,...attempt,findings:report?.findings.length??null}));
 if(!report)process.exitCode=1;
 if(attempt.outcome==='quota')break;
}
