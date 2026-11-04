import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, resolve, relative, isAbsolute } from 'node:path';
import { loadPrototypeData } from './data.mjs';

const root=fileURLToPath(new URL('./',import.meta.url));
const port=Number(process.env.PROTOTYPE_PORT||4173);
const data=await loadPrototypeData();
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8','.png':'image/png'};
const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; object-src 'none'; base-uri 'none'");
  if(req.method!=='GET'||!['127.0.0.1:'+port,'localhost:'+port].includes(req.headers.host)){res.writeHead(403);res.end('Local preview only');return;}
  const pathname=new URL(req.url,`http://127.0.0.1:${port}`).pathname;
  if(pathname==='/api/data'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));return;}
  try {
    let file;
    const evidence=pathname.match(/^\/api\/evidence\/([1-6])$/);
    if(evidence)file=fileURLToPath(new URL(`../private-data/historical/screenshots/image-${evidence[1]}.png`,import.meta.url));
    else if(pathname==='/design/tokens.css')file=fileURLToPath(new URL('../design/tokens.css',import.meta.url));
    else {
      file=resolve(root,'.'+decodeURIComponent(pathname==='/'?'/index.html':pathname));
      const rel=relative(root,file);
      if(rel.startsWith('..')||isAbsolute(rel)||!/\.(html|css|js|svg|ttf|txt)$/.test(file))throw new Error('Not served');
    }
    const body=await readFile(file);res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');res.end(body);
  } catch {res.writeHead(404);res.end('Not found');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port} (${data.activities.length} preview activities)`));
