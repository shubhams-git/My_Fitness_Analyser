// Optional, loopback-only UI fixture. Never calls Garmin or Gemini.
// node tests/preview-training.mjs [report|empty|invalid|mixed|coaching] [port]
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve,relative,extname,isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { trainingDataset,syntheticHistory } from '../prototypes/training-data.mjs';
import { demoEvidence } from '../analysis/gemini.mjs';
import { REVIEW_VERSION,validateReview } from '../analysis/contract.mjs';
import { COACH_SCHEMA,validateCoaching } from '../analysis/coaching-contract.mjs';
const mode=process.argv[2]||'report',port=Number(process.argv[3]||4189),root=fileURLToPath(new URL('../prototypes/',import.meta.url)),pack=demoEvidence();
const synthetic=syntheticHistory(),base=synthetic[0],mixed=['mixed','coaching'].includes(mode);
const fixture=mixed?[...synthetic,
 {id:'fixture-history',synthetic:true,title:'Historical run summary',date:'2026-10-30',sport:'Run',source:'Nike Run Club',sourceFile:'Owner-supplied screenshots',distance:6200,records:[]},
 ...[['cycling','Ride'],['strength_training','Strength training'],['indoor_rowing','Rowing']].map(([typeKey,sport],i)=>({
  ...base,id:'fixture-'+typeKey,title:sport,date:'2026-10-'+(31-i),sport,source:'Synthetic workout',provider:{id:typeKey,detail:{activityTypeDTO:{typeKey}}},
  distance:i===0?24000:null,timer:1800,records:[]}))
 ]:synthetic;
const report=validateReview({schemaVersion:REVIEW_VERSION,evidenceHash:pack.hash,dataset:'synthetic',summary:'UI test fixture: a review of generated training records.',findings:[{kind:'coverage_gap',title:'Heart rate is missing in part of the record.',explanation:'Inspect the available sessions without filling the gaps.',confidence:'direct_evidence',factIds:['history.hrSessions','history.sessions']},{kind:'pace_pattern',title:'The eligible sessions have different recorded paces.',explanation:'This is a descriptive comparison of generated records; conditions and effort are not controlled.',confidence:'limited_evidence',factIds:['comparison.paceChangePercent']}],visualizations:[{type:'session_distance',sessionIds:['s03','s02','s01']}],nextChecks:[{question:'Was heart rate recorded for the missing sessions?',reason:'The answer would help distinguish unavailable sensors from incomplete imports.',factIds:['history.hrSessions']}]},pack);
const item={report,requestedModel:'mock-ui-fixture',returnedModel:'mock-ui-fixture · no Gemini request',generatedAt:'2026-11-05T00:00:00Z',evidenceHash:pack.hash,validated:true,cached:false};
function coachingFixture(){
 const facts=[
  {id:'s01.effort',label:'Reported effort',value:7,unit:'/10',sessionIds:['s01']},
  {id:'s01.splitChange',label:'Closing minus opening pace',value:25,unit:'s/km',sessionIds:['s01']},
  {id:'week.recent.activeDays',label:'Days with a recorded run',value:3,unit:'days',sessionIds:[]},
  {id:'workouts.strength.duration',label:'Recorded strength time',value:2100,unit:'s',sessionIds:[]}
 ];
 const evidence={facts,sessions:[{ref:'s01'}],comparisons:[]},hash='a'.repeat(64);
 const signal=(factId,direction='none')=>({factIds:[factId],signal:{factId,direction}});
 const generated=validateCoaching({
  schemaVersion:COACH_SCHEMA,evidenceHash:hash,
  verdict:{text:'Give yourself an easier opening on your next familiar route.',
   explanation:'You reported {s01.effort} effort. The closing kilometre also slowed by {s01.splitChange}. That combination makes a steadier opening worth testing, although terrain or a deliberate change of pace could also explain the closing split.',
   nextAction:'Start conversationally and compare how the final kilometre feels. Use the same route if practical so the comparison has fewer moving parts.',
   factIds:['s01.effort','s01.splitChange'],signal:{factId:'s01.splitChange',direction:'slower'}},
  findings:[
   {kind:'consistency',headline:'You logged runs on {week.recent.activeDays}.',assessment:'measured',
    explanation:'The recorded runs were spread across several days, so you have several opportunities to compare similar efforts when you repeat a familiar route.',
    nextAction:'Use a repeat route to check whether a steadier opening holds across more than one run.',...signal('week.recent.activeDays')},
   {kind:'cross_training',headline:'Your strength session is relevant context.',assessment:'interpretation',
    explanation:'You recorded {workouts.strength.duration} of strength work. That gives you a useful piece of context if an easy pace feels different on your next run.',
    nextAction:'Note whether your legs feel different from normal before drawing conclusions about pace.',...signal('workouts.strength.duration')}
  ],charts:[]
 },{content:evidence,hash});
 return {report:generated,evidence,mapping:{s01:'synthetic-9'},generatedAt:'2026-11-01T00:00:00Z',model:'Synthetic UI fixture',stale:false};
}
const coaching=mode==='coaching'?coachingFixture():null;
http.createServer(async(req,res)=>{const url=new URL(req.url,`http://127.0.0.1:${port}`),json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 if(!['127.0.0.1:'+port,'localhost:'+port].includes(req.headers.host)){json(403,{});return;}
 if(url.pathname==='/api/training'){json(200,{...trainingDataset(mode==='empty'?[]:fixture,Object.fromEntries(synthetic.filter((a,i)=>i%2===0).map(a=>[a.id,{answers:{effort:5}}])), {window:url.searchParams.get('window')==='all'?'all':'90',anchor:'2026-11-01',synthetic:true}),local:false,...(mixed?{cloud:true,journalStrength:{sessions:2,days:2}}:{})});return;}
 if(mixed&&url.pathname==='/api/private'&&url.searchParams.get('route')==='ai-review'){
  if(coaching&&req.method==='POST'){json(200,coaching);return;}
  json(200,{consent:{enabled:Boolean(coaching)},configured:Boolean(coaching),review:coaching&&{...coaching,stale:true}});return;
 }
 if(url.pathname==='/api/analysis/status'){json(200,{configured:true,model:'UI test fixture · no API call',dataMode:'synthetic-only',review:null,evidence:pack.content,evidenceHash:pack.hash});return;}
 if(url.pathname==='/api/analysis/demo'){json(mode==='invalid'?400:200,mode==='invalid'?{error:'UI test fixture: the response did not match the review schema.'}:item);return;}
 if(url.pathname.startsWith('/api/')){json(404,{});return;}
 try{let file;if(url.pathname==='/design/tokens.css')file=fileURLToPath(new URL('../design/tokens.css',import.meta.url));else{file=resolve(root,'.'+(url.pathname==='/training'?'/training.html':decodeURIComponent(url.pathname)));const rel=relative(root,file);if(rel.startsWith('..')||isAbsolute(rel)||!['.html','.css','.js','.ttf','.svg'].includes(extname(file)))throw new Error();}res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.ttf':'font/ttf','.svg':'image/svg+xml'})[extname(file)]);res.end(await readFile(file));}catch{res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`UI fixture (${mode}), no provider requests: http://127.0.0.1:${port}/training`));
