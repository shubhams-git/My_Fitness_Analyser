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
const publication=JSON.parse(await readFile(process.argv[2],'utf8')),t=publication.tables;
const empty=process.argv.includes('--empty'),activities=empty?[]:projectActivities(t.activities,t.activity_sources,t.source_accounts,t.activity_segments);
const viewer={id:publication.owner,email:'review@example.test',displayName:'UI review athlete'},feedback={};
const root=fileURLToPath(new URL('../prototypes/',import.meta.url)),port=Number(process.env.PROTOTYPE_PORT||4175);
const server=http.createServer(async(req,res)=>{
  if(!['127.0.0.1:'+port,'localhost:'+port].includes(req.headers.host)){res.writeHead(403).end();return;}
  res.setHeader('Cache-Control','no-store');const url=new URL(req.url,'http://localhost');
  const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json'}).end(JSON.stringify(value));};
  try{
    if(url.pathname==='/api/data'){json(200,{activities,defaultId:activities.at(-1)?.id,viewer,feedback,activityAliases:Object.fromEntries(activities.flatMap(a=>a.legacyAliases.map(alias=>[alias,a.id]))),cloudLibrary:true,localLibrary:true,garmin:{configured:false}});return;}
    if(url.pathname==='/api/training'){json(200,{...trainingDataset(activities,feedback,{window:url.searchParams.get('window')||'90'}),cloud:true,viewer,local:false,garminConfigured:false});return;}
    if(url.pathname==='/api/journal'){json(200,{...journalDataset(undefined),cloud:true,local:false,viewer});return;}
    if(url.pathname==='/api/private'&&url.searchParams.get('route')==='profile'){json(200,{user:viewer,garmin:{configured:false},submissions:[],historyFrom:'2026-07-01'});return;}
    if(url.pathname==='/api/feedback'&&req.method==='POST'){let body='';for await(const chunk of req)body+=chunk;const {id,draft}=JSON.parse(body);if(!activities.some(a=>a.id===id))throw new Error('Unknown fixture activity');const value={...validateFeedback(draft),revision:(feedback[id]?.revision||0)+1};feedback[id]=value;json(200,value);return;}
    if(url.pathname.startsWith('/api/')){json(409,{error:'This is a local UI review fixture. No provider or database write is available.'});return;}
    const path=({'/':'/index.html','/training':'/training.html','/journal':'/journal.html','/account':'/account.html'})[url.pathname]||url.pathname;
    const file=path==='/design/tokens.css'?fileURLToPath(new URL('../design/tokens.css',import.meta.url)):resolve(root,'.'+decodeURIComponent(path));
    if(path!=='/design/tokens.css'&&(relative(root,file).startsWith('..')||!/^\.(html|css|js|svg|ttf|txt)$/.test(extname(file))))throw new Error('Not served');
    const bytes=await readFile(file),type={'.html':'text/html','.css':'text/css','.js':'text/javascript','.ttf':'font/ttf','.svg':'image/svg+xml','.txt':'text/plain'}[extname(file)];res.setHeader('Content-Type',type);res.end(bytes);
  }catch{res.writeHead(404).end('Not available in the UI fixture.');}
});
server.listen(port,'127.0.0.1',()=>console.log(`UI fixture only: http://127.0.0.1:${port} — no live authentication or writes`));
