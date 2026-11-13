import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { extname, resolve, relative, isAbsolute } from 'node:path';
import { loadPrototypeData } from './data.mjs';
import { LocalLibrary } from './library.mjs';
import { GarminSync } from './garmin.mjs';
import { privateHandler } from '../cloud/handler.mjs';
import { trainingDataset,mergeTrainingActivities } from './training-data.mjs';
import { GeminiReviews } from '../analysis/gemini.mjs';
import { randomUUID } from 'node:crypto';
import { parseMass,importPreview,journalDataset } from './mass.mjs';

const root=fileURLToPath(new URL('./',import.meta.url));
try{process.loadEnvFile(fileURLToPath(new URL('../.env',import.meta.url)));}catch(error){if(error.code!=='ENOENT')throw error;}
const port=Number(process.env.PROTOTYPE_PORT||4173);
const data=await loadPrototypeData();
const library=new LocalLibrary(process.env.FITNESS_LIBRARY_DIR?pathToFileURL(resolve(process.env.FITNESS_LIBRARY_DIR)+'/'):new URL('../private-data/library/',import.meta.url));
const garmin=new GarminSync(library);
const reviews=new GeminiReviews();
const massPreviews=new Map();
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8','.png':'image/png'};
const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob: https://tiles.openfreemap.org https://tiles.maps.eox.at https://tiles.mapterhorn.com; connect-src 'self' https://tiles.openfreemap.org https://tiles.maps.eox.at https://tiles.mapterhorn.com; worker-src 'self'; frame-ancestors 'self'; object-src 'none'; base-uri 'none'");
  if(!['127.0.0.1:'+port,'localhost:'+port].includes(req.headers.host)){res.writeHead(403);res.end('Local access only');return;}
  const pathname=new URL(req.url,`http://127.0.0.1:${port}`).pathname;
  const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
  if(pathname==='/api/private'){await privateHandler(req,res,new URL(req.url,'http://localhost').searchParams.get('route'));return;}
  if(process.env.FITNESS_CLOUD_ENABLED!=='1'&&pathname==='/api/journal'&&req.method==='GET'){try{const saved=await library.read();json(200,{...journalDataset(saved.mass,{window:['30','all'].includes(new URL(req.url,'http://localhost').searchParams.get('window'))?new URL(req.url,'http://localhost').searchParams.get('window'):'90'}),local:true});}catch{json(500,{error:'Your saved journal could not be read.'});}return;}
  if(process.env.FITNESS_CLOUD_ENABLED!=='1'&&['/api/mass/preview','/api/mass/commit'].includes(pathname)&&req.method==='POST'){
    if(req.headers.origin!==`http://${req.headers.host}`){json(403,{error:'Open the local app to import MASS.'});return;}
    try{let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>(pathname.endsWith('preview')?10*1024*1024:4096))throw new Error('The import request is too large.');chunks.push(chunk);}const bytes=Buffer.concat(chunks);
      for(const [id,item]of massPreviews)if(Date.now()-item.created>600000)massPreviews.delete(id);
      if(pathname.endsWith('preview')){const incoming=parseMass(bytes),saved=await library.read(),preview=importPreview(saved.mass,incoming),token=randomUUID();while(massPreviews.size>=4)massPreviews.delete(massPreviews.keys().next().value);massPreviews.set(token,{incoming,baseDigest:preview.baseDigest,created:Date.now()});json(200,{...preview,token});}
      else{const {token}=JSON.parse(bytes.toString()),pending=massPreviews.get(token);if(!pending)throw new Error('This import preview expired. Choose the file again.');pending.promise??=library.importMass(pending.incoming,pending.baseDigest).catch(e=>{pending.promise=null;throw e;});json(200,await pending.promise);}
    }catch(e){json(400,{error:e.message});}return;
  }
  if(process.env.FITNESS_CLOUD_ENABLED==='1'&&pathname.startsWith('/api/')){const routes={'/api/mass/preview':'mass-preview','/api/mass/commit':'mass-commit','/api/data':'data','/api/training':'training','/api/journal':'journal','/api/import':'import','/api/feedback':'feedback','/api/restore':'restore','/api/export':'export','/api/garmin/sync':'sync'};if(routes[pathname])await privateHandler(req,res,routes[pathname]);else json(404,{error:'Not available'});return;}
  if(pathname==='/api/training'&&req.method==='GET'){try{const saved=await library.read(),window=new URL(req.url,'http://localhost').searchParams.get('window')==='all'?'all':'90';json(200,{...trainingDataset(mergeTrainingActivities(data.activities,Object.values(saved.activities)),saved.feedback,{window}),lastSync:saved.garminSync?.lastSuccessAt||null,local:true});}catch{json(500,{error:'Your saved training record could not be read.'});}return;}
  if(pathname==='/api/analysis/status'&&req.method==='GET'){try{json(200,await reviews.status());}catch{json(500,{error:'Analysis configuration could not be read.'});}return;}
  if(pathname==='/api/analysis/demo'&&req.method==='POST'){
    if(req.headers.origin!==`http://${req.headers.host}`){json(403,{error:'Open the local app to request a review.'});return;}
    try{let size=0;const parts=[];for await(const chunk of req){size+=chunk.length;if(size>4096)throw new Error('Unsupported review request.');parts.push(chunk);}const body=JSON.parse(Buffer.concat(parts).toString()||'{}');if(body.dataset!=='synthetic')throw new Error('Only synthetic Gemini reviews are enabled.');json(200,await reviews.generate());}catch(e){json(400,{error:e.message});}return;
  }
  if(req.method==='GET'&&pathname==='/api/garmin/status'){try{json(200,await garmin.status());}catch{json(500,{error:'Garmin sync status is unavailable.'});}return;}
  if(req.method==='POST'&&pathname==='/api/garmin/sync'){
    if(req.headers.origin!==`http://${req.headers.host}`){json(403,{error:'Open the local app to sync Garmin.'});return;}
    if(garmin.running){json(409,{error:'A Garmin sync is already running.'});return;}
    try{const result=await garmin.run();json(result.complete?200:502,result);}catch{json(500,{error:'Sync could not finish saving. Existing activities are preserved.'});}return;
  }
  if(req.method==='POST'&&['/api/import','/api/feedback','/api/restore'].includes(pathname)){
    if(req.headers.origin!==`http://${req.headers.host}`){json(403,{error:'Open this app on its local address to save.'});return;}
    try{const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>(pathname==='/api/restore'?50:10)*1024*1024)throw new Error('This file is too large for this release.');chunks.push(chunk);}const body=Buffer.concat(chunks);
      if(pathname==='/api/import')json(200,await library.import(body,data.activities));
      else if(pathname==='/api/restore')json(200,await library.restore(JSON.parse(body.toString()),data.activities.map(a=>a.id)));
      else {const {id,draft}=JSON.parse(body.toString());const saved=await library.read();json(200,await library.save(id,draft,Object.keys(saved.activities)));}
    }catch(e){json(400,{error:e.message});}return;
  }
  if(req.method!=='GET'){json(403,{error:'Unsupported action'});return;}
  if(pathname==='/api/data'||pathname==='/api/export'){
    try{const saved=await library.read();if(pathname==='/api/export'){res.setHeader('Content-Disposition','attachment; filename="fitness-library.json"');json(200,{...saved,exportedAt:new Date().toISOString()});}
      else{const merged=new Map(data.activities.map(a=>[a.id,a]));Object.values(saved.activities).forEach(a=>{for(const [id,seed]of merged)if(id!==a.id&&(seed.sourceHash===a.sourceHash||a.provider&&seed.garminActivityId===a.provider.id))merged.delete(id);merged.set(a.id,a);});const latest=Object.values(saved.activities).filter(a=>a.provider).sort((a,b)=>b.startInstant.localeCompare(a.startInstant))[0];json(200,{...data,defaultId:latest?.id||data.defaultId,activities:[...merged.values()],feedback:saved.feedback,localLibrary:true,garmin:await garmin.status()});}
    }catch{json(500,{error:'The saved library could not be read. Restore its backup before continuing.'});}return;
  }
  try {
    let file;
    const evidence=pathname.match(/^\/api\/evidence\/([1-6])$/);
    if(evidence)file=fileURLToPath(new URL(`../private-data/historical/screenshots/image-${evidence[1]}.png`,import.meta.url));
    else if(pathname==='/design/tokens.css')file=fileURLToPath(new URL('../design/tokens.css',import.meta.url));
    else {
      const decoded=decodeURIComponent(pathname);
      const shellPaths=['/','/index.html','/app.html','/training','/training.html','/journal','/journal.html','/account','/account.html'];
      const page=shellPaths.includes(decoded)?'/shell.html':({'/studio':'/studio.html','/sign-in':'/sign-in.html'})[decoded]||decoded;
      file=resolve(root,'.'+page);
      const rel=relative(root,file);
      if(extname(file)==='.mjs'&&!rel.replaceAll('\\','/').startsWith('assets/vendor/'))throw new Error('Not served');
      if(rel.startsWith('..')||isAbsolute(rel)||!/\.(html|css|js|mjs|svg|ttf|txt)$/.test(file))throw new Error('Not served');
    }
    const body=await readFile(file);res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');res.end(body);
  } catch {res.writeHead(404);res.end('Not found');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port} (${data.activities.length} preview activities)`));
