// Loopback-only browser QA. This is not authentication or a live DB integration.
// Supply a PRIVATE publication.json to inspect its projected UI without tokens.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve,relative,extname } from 'node:path';
import { projectActivities } from '../cloud/activities.mjs';
import { trainingDataset } from '../prototypes/training-data.mjs';
import { journalDataset } from '../prototypes/mass.mjs';
import { validateFeedback } from '../prototypes/library.mjs';
import { coachingEvidence } from '../analysis/coaching-evidence.mjs';
import { COACH_SCHEMA } from '../analysis/coaching-contract.mjs';
const publication=JSON.parse(await readFile(process.argv[2],'utf8')),t=publication.tables;
const empty=process.argv.includes('--empty'),activities=empty?[]:projectActivities(t.activities,t.activity_sources,t.source_accounts,t.activity_segments);
const viewer={id:publication.owner,email:'review@example.test',displayName:'UI review athlete'},feedback={};
let consent={enabled:null,revision:0,disclosureVersion:'gemini-run-v1'},review=null;
const root=fileURLToPath(new URL('../prototypes/',import.meta.url)),port=Number(process.env.PROTOTYPE_PORT||4175);
const server=http.createServer(async(req,res)=>{
  if(!['127.0.0.1:'+port,'localhost:'+port].includes(req.headers.host)){res.writeHead(403).end();return;}
  res.setHeader('Cache-Control','no-store');const url=new URL(req.url,'http://localhost');
  const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json'}).end(JSON.stringify(value));};
  try{
    if(url.pathname==='/api/private'&&url.searchParams.get('route')==='ai-consent'){
      if(req.method==='POST'){let raw='';for await(const c of req)raw+=c;consent={...consent,enabled:JSON.parse(raw).enabled,revision:consent.revision+1};if(!consent.enabled)review=null;}
      json(200,consent);return;
    }
    if(url.pathname==='/api/private'&&url.searchParams.get('route')==='ai-review'){
      if(req.method==='POST'){
        const pack=coachingEvidence({activities:Object.fromEntries(activities.map(a=>[a.id,a])),feedback}),id=pack.content.facts.find(f=>f.id.endsWith('.paceChange'))?.id||'history.runs',kind=id.startsWith('comparison.')?'pace':'consistency';
        review={id:'fixture',model:'UI fixture — no Gemini call',generatedAt:new Date().toISOString(),stale:false,evidence:pack.content,mapping:pack.mapping,report:{schemaVersion:COACH_SCHEMA,evidenceHash:pack.hash,verdict:{text:'UI fixture: your recorded history contains {history.runs} runs.',factIds:['history.runs']},findings:[{kind,headline:'A source-backed comparison: {'+id+'}.',explanation:'UI fixture only. This is a layout test and no model has analysed your history.',assessment:'measured',factIds:[id],nextAction:'Open the cited runs and inspect the evidence.'}],charts:pack.content.sessions.length>=2?[{type:'pace',sessionIds:['s01','s02']}]:[]}};
        json(200,review);return;
      }
      json(200,{consent,configured:true,runs:activities.length,review:consent.enabled?review:null});return;
    }
    if(url.pathname==='/api/data'){json(200,{activities,defaultId:activities.at(-1)?.id,viewer,feedback,activityAliases:Object.fromEntries(activities.flatMap(a=>a.legacyAliases.map(alias=>[alias,a.id]))),cloudLibrary:true,localLibrary:true,garmin:{configured:false}});return;}
    if(url.pathname==='/api/training'){json(200,{...trainingDataset(activities,feedback,{window:url.searchParams.get('window')||'90'}),cloud:true,viewer,local:false,garminConfigured:false});return;}
    if(url.pathname==='/api/journal'){json(200,{...journalDataset(undefined),cloud:true,local:false,viewer});return;}
    if(url.pathname==='/api/private'&&url.searchParams.get('route')==='profile'){json(200,{user:viewer,garmin:{configured:false},submissions:[],historyFrom:'2026-07-01'});return;}
    if(url.pathname==='/api/feedback'&&req.method==='POST'){let body='';for await(const chunk of req)body+=chunk;const {id,draft}=JSON.parse(body);if(!activities.some(a=>a.id===id))throw new Error('Unknown fixture activity');const value={...validateFeedback(draft),revision:(feedback[id]?.revision||0)+1};feedback[id]=value;json(200,value);return;}
    if(url.pathname.startsWith('/api/')){json(409,{error:'This is a local UI review fixture. No provider or database write is available.'});return;}
    const path=({'/':'/index.html','/training':'/training.html','/journal':'/journal.html','/account':'/account.html'})[url.pathname]||url.pathname;
    const file=path==='/design/tokens.css'?fileURLToPath(new URL('../design/tokens.css',import.meta.url)):resolve(root,'.'+decodeURIComponent(path));
    if(extname(file)==='.mjs'&&!relative(root,file).replaceAll('\\','/').startsWith('assets/vendor/'))throw new Error('Not served');
    if(path!=='/design/tokens.css'&&(relative(root,file).startsWith('..')||!/^\.(html|css|js|mjs|svg|ttf|txt)$/.test(extname(file))))throw new Error('Not served');
    const bytes=await readFile(file),type={'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.ttf':'font/ttf','.svg':'image/svg+xml','.txt':'text/plain'}[extname(file)];res.setHeader('Content-Type',type);res.end(bytes);
  }catch{res.writeHead(404).end('Not available in the UI fixture.');}
});
server.listen(port,'127.0.0.1',()=>console.log(`UI fixture only: http://127.0.0.1:${port} — no live authentication or writes`));
