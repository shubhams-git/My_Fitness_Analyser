// Optional, loopback-only UI fixture. Never calls Garmin or Gemini.
// node tests/preview-training.mjs [report|empty|invalid|mixed] [port]
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve,relative,extname,isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { trainingDataset,syntheticHistory } from '../prototypes/training-data.mjs';
import { demoEvidence } from '../analysis/gemini.mjs';
import { REVIEW_VERSION,validateReview } from '../analysis/contract.mjs';
const mode=process.argv[2]||'report',port=Number(process.argv[3]||4189),root=fileURLToPath(new URL('../prototypes/',import.meta.url)),pack=demoEvidence();
const synthetic=syntheticHistory(),base=synthetic[0],mixed=mode==='mixed';
const fixture=mixed?[...synthetic,
 {id:'fixture-history',synthetic:true,title:'Historical run summary',date:'2026-10-30',sport:'Run',source:'Nike Run Club',sourceFile:'Owner-supplied screenshots',distance:6200,records:[]},
 ...[['cycling','Ride'],['strength_training','Strength training'],['indoor_rowing','Rowing']].map(([typeKey,sport],i)=>({
  ...base,id:'fixture-'+typeKey,title:sport,date:'2026-10-'+(31-i),sport,source:'Synthetic workout',provider:{id:typeKey,detail:{activityTypeDTO:{typeKey}}},
  distance:i===0?24000:null,timer:1800,records:[]}))
 ]:synthetic;
const report=validateReview({schemaVersion:REVIEW_VERSION,evidenceHash:pack.hash,dataset:'synthetic',summary:'UI test fixture: a review of generated training records.',findings:[{kind:'coverage_gap',title:'Heart rate is missing in part of the record.',explanation:'Inspect the available sessions without filling the gaps.',confidence:'direct_evidence',factIds:['history.hrSessions','history.sessions']},{kind:'pace_pattern',title:'The eligible sessions have different recorded paces.',explanation:'This is a descriptive comparison of generated records; conditions and effort are not controlled.',confidence:'limited_evidence',factIds:['comparison.paceChangePercent']}],visualizations:[{type:'session_distance',sessionIds:['s03','s02','s01']}],nextChecks:[{question:'Was heart rate recorded for the missing sessions?',reason:'The answer would help distinguish unavailable sensors from incomplete imports.',factIds:['history.hrSessions']}]},pack);
const item={report,requestedModel:'mock-ui-fixture',returnedModel:'mock-ui-fixture · no Gemini request',generatedAt:'2026-11-05T00:00:00Z',evidenceHash:pack.hash,validated:true,cached:false};
http.createServer(async(req,res)=>{const url=new URL(req.url,`http://127.0.0.1:${port}`),json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 if(!['127.0.0.1:'+port,'localhost:'+port].includes(req.headers.host)){json(403,{});return;}
 if(url.pathname==='/api/training'){json(200,{...trainingDataset(mode==='empty'?[]:fixture,Object.fromEntries(synthetic.filter((a,i)=>i%2===0).map(a=>[a.id,{answers:{effort:5}}])), {window:url.searchParams.get('window')==='all'?'all':'90',anchor:'2026-11-01',synthetic:true}),local:false,...(mixed?{cloud:true,journalStrength:{sessions:2,days:2}}:{})});return;}
 if(mixed&&url.pathname==='/api/private'&&url.searchParams.get('route')==='ai-review'){json(200,{consent:{enabled:false},configured:false,review:null});return;}
 if(url.pathname==='/api/analysis/status'){json(200,{configured:true,model:'UI test fixture · no API call',dataMode:'synthetic-only',review:null,evidence:pack.content,evidenceHash:pack.hash});return;}
 if(url.pathname==='/api/analysis/demo'){json(mode==='invalid'?400:200,mode==='invalid'?{error:'UI test fixture: the response did not match the review schema.'}:item);return;}
 if(url.pathname.startsWith('/api/')){json(404,{});return;}
 try{let file;if(url.pathname==='/design/tokens.css')file=fileURLToPath(new URL('../design/tokens.css',import.meta.url));else{file=resolve(root,'.'+(url.pathname==='/training'?'/training.html':decodeURIComponent(url.pathname)));const rel=relative(root,file);if(rel.startsWith('..')||isAbsolute(rel)||!['.html','.css','.js','.ttf','.svg'].includes(extname(file)))throw new Error();}res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.ttf':'font/ttf','.svg':'image/svg+xml'})[extname(file)]);res.end(await readFile(file));}catch{res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`UI fixture (${mode}), no provider requests: http://127.0.0.1:${port}/training`));
