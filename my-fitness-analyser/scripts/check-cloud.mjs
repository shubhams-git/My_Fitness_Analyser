import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { cloudConfig } from '../cloud/supabase.mjs';
let file={};try{file=parseEnv(await readFile(new URL('../.env',import.meta.url),'utf8'));}catch{}
const env={...file,...process.env},required=['SUPABASE_URL','SUPABASE_ANON_KEY','FITNESS_OWNER_ID','APP_ORIGIN','GARMIN_PERSONAL_API_KEY'];
const missing=required.filter(key=>!env[key]);
if(missing.length){console.log('Private deployment configuration is incomplete. Missing variable names: '+missing.join(', '));process.exitCode=1;}
else{try{cloudConfig({...env,VERCEL:'1'});console.log('Private configuration format checks passed. Live owner authentication, migration and storage checks are still required before release.');}catch(error){console.log(error.message);process.exitCode=1;}}
console.log('No credentials, personal records or FIT files were uploaded by this check.');
