import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, resolve, relative, isAbsolute } from 'node:path';
import { loadPrototypeData } from './data.mjs';
import { LocalLibrary } from './library.mjs';

const root=fileURLToPath(new URL('./',import.meta.url));
const port=Number(process.env.PROTOTYPE_PORT||4173);
const data=await loadPrototypeData();
const library=new LocalLibrary(new URL('../private-data/library/',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8','.png':'image/png'};
const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; object-src 'none'; base-uri 'none'");
  if(!['127.0.0.1:'+port,'localhost:'+port].includes(req.headers.host)){res.writeHead(403);res.end('Local access only');return;}
  const pathname=new URL(req.url,`http://127.0.0.1:${port}`).pathname;
  const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
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
      else{const merged=new Map(data.activities.map(a=>[a.id,a]));Object.values(saved.activities).forEach(a=>{for(const [id,seed]of merged)if(id!==a.id&&seed.sourceHash===a.sourceHash)merged.delete(id);merged.set(a.id,a);});json(200,{...data,activities:[...merged.values()],feedback:saved.feedback,localLibrary:true});}
    }catch{json(500,{error:'The saved library could not be read. Restore its backup before continuing.'});}return;
  }
  try {
    let file;
    const evidence=pathname.match(/^\/api\/evidence\/([1-6])$/);
    if(evidence)file=fileURLToPath(new URL(`../private-data/historical/screenshots/image-${evidence[1]}.png`,import.meta.url));
    else if(pathname==='/design/tokens.css')file=fileURLToPath(new URL('../design/tokens.css',import.meta.url));
    else {
      file=resolve(root,'.'+decodeURIComponent(pathname==='/'?'/index.html':pathname==='/studio'?'/studio.html':pathname));
      const rel=relative(root,file);
      if(rel.startsWith('..')||isAbsolute(rel)||!/\.(html|css|js|svg|ttf|txt)$/.test(file))throw new Error('Not served');
    }
    const body=await readFile(file);res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');res.end(body);
  } catch {res.writeHead(404);res.end('Not found');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port} (${data.activities.length} preview activities)`));
