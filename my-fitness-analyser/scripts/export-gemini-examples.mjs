// Reproducible request bodies: generated measurements only, no .env or library reads.
import {mkdir,writeFile} from 'node:fs/promises';
import {syntheticCoaching} from './synthetic-coaching.mjs';
import {weightEvidence} from '../analysis/weight-evidence.mjs';
import {coachingGenerationRequest} from '../cloud/intelligence.mjs';
import {weightRequest} from '../cloud/weight-intelligence.mjs';
const training=syntheticCoaching();
const weight=weightEvidence({anchor:'2026-11-08',today:'2026-11-08',points:Array.from({length:12},(_,i)=>({date:new Date(Date.UTC(2026,8,1+i*3)).toISOString().slice(0,10),kg:80-i*.1+Math.sin(i)*.2,readings:1}))});
const directory=new URL('../docs/gemini-examples/',import.meta.url);
await mkdir(directory,{recursive:true});
for(const [name,body] of [['training',coachingGenerationRequest(training)],['weight',weightRequest(weight)]]){
 await writeFile(new URL(name+'-request.json',directory),JSON.stringify(body,null,2)+'\n');
 await writeFile(new URL(name+'-prompt.txt',directory),body.systemInstruction.parts[0].text+'\n');
 await writeFile(new URL(name+'-evidence.json',directory),JSON.stringify(JSON.parse(body.contents[0].parts[0].text),null,2)+'\n');
}
console.log('Exported synthetic Gemini prompts and complete request bodies.');
