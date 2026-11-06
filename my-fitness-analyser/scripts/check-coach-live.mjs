// Explicit provider test using generated records only. Never reads the health library.
import { readFile,mkdir,writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { syntheticHistory } from '../prototypes/training-data.mjs';
import { coachingEvidence } from '../analysis/coaching-evidence.mjs';
import { coachingRequest,extractCoaching } from '../cloud/intelligence.mjs';
const env={...parseEnv(await readFile(new URL('../.env',import.meta.url),'utf8')),...process.env};
if(env.GEMINI_FREE_TIER_CONFIRMED!=='1')throw new Error('Confirm the Free project before this synthetic test.');
const model=process.argv[2]||env.GEMINI_MODEL||'gemini-3.8-flash';
if(!['gemini-3.8-flash','gemini-3.7-flash','gemini-3.6-flash'].includes(model))throw new Error('Use a supported Flash model.');
const activities=syntheticHistory().map(a=>({...a,synthetic:false}));
const pack=coachingEvidence({activities:Object.fromEntries(activities.map(a=>[a.id,a])),feedback:{}},{anchor:'2026-11-07'});
const response=await fetch('https://generativelanguage.googleapis.com/v1beta/interactions',{method:'POST',redirect:'error',signal:AbortSignal.timeout(90000),headers:{'Content-Type':'application/json','x-goog-api-key':env.GEMINI_API_KEY,'Api-Revision':'2026-05-20'},body:JSON.stringify(coachingRequest(pack,model))});
const result=await response.json();
console.log(JSON.stringify({syntheticOnly:true,model,status:response.status,reason:result.error?.status||result.error?.code}));
const directory=new URL('../private-data/ai-qa/',import.meta.url);await mkdir(directory,{recursive:true});await writeFile(new URL('synthetic-'+model+'.json',directory),JSON.stringify({response:result,pack}));
if(!response.ok)process.exit(1);
try{const report=extractCoaching(result,pack);console.log(JSON.stringify({validated:true,findings:report.findings.length,verdict:report.verdict.text}));}catch(error){console.log(JSON.stringify({validated:false,error:error.message}));process.exitCode=1;}
