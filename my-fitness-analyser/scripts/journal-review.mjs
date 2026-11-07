// Loopback-only synthetic UI/SQL fixture. No live Auth, DB, provider or .env.
import http from 'node:http';
import { readFile,mkdir,writeFile } from 'node:fs/promises';
import { resolve,relative,extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { CloudJournal } from '../cloud/journal.mjs';
import { syntheticMass } from '../prototypes/mass.mjs';
const root=fileURLToPath(new URL('../prototypes/',import.meta.url)),port=4176,owner='11111111-1111-4111-8111-111111111111';
const db=new PGlite(),storage=new Map();
await db.exec(`create role authenticated;create role anon;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;create table fitness_owners(owner_id uuid primary key);create table fitness_profiles(owner_id uuid primary key,timezone text);insert into fitness_owners values('${owner}');insert into fitness_profiles values('${owner}','Australia/Sydney');grant select on fitness_profiles to authenticated;`);
await db.exec(await readFile(new URL('../supabase/migrations/20261107_body_journal.sql',import.meta.url),'utf8'));
await db.exec(await readFile(new URL('../supabase/migrations/20261108_strength_journal.sql',import.meta.url),'utf8'));
await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${owner}',false);`);
const api={config:{owner},async request(path,options={}){
 if(path.includes('/storage/')){if(options.method==='POST'){if(storage.has(path))return new Response('{}',{status:409});storage.set(path,Buffer.from(options.body));return Response.json({});}return storage.has(path)?new Response(storage.get(path)):new Response('{}',{status:404});}
 const functions={journal_snapshot:[],save_strength_entry:['target_id','expected_revision','expected_head','operation_id','new_value'],save_body_measurement:['target_id','expected_revision','expected_head','operation_id','new_value'],commit_mass_journal:['expected_head','source_hash','object_key','byte_length','exported_at','incoming','confirm_same_day']},name=path.split('/').at(-1),args=functions[name];
 if(!args)return new Response('{}',{status:404});
 try{const value=(await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as value`,args.map(k=>options.body[k]))).rows[0].value;return Response.json(value);}
 catch(e){return Response.json({message:e.message},{status:e.code==='PT409'?409:400});}
}};
const journal=new CloudJournal(api),raw=Object.values(syntheticMass().imports)[0].raw;
if(!process.argv.includes('--empty')){const preview=await journal.preview(Buffer.from(raw));await journal.commit(Buffer.from(raw),{head:preview.headRevision,hash:preview.hash});}
const qa=new URL('../private-data/journal-qa/',import.meta.url);await mkdir(qa,{recursive:true});await writeFile(new URL('synthetic-export.json',qa),raw);
const server=http.createServer(async(req,res)=>{
 if(req.headers.host!=='127.0.0.1:'+port){res.writeHead(403).end();return;}res.setHeader('Cache-Control','no-store');const url=new URL(req.url,'http://localhost');
 const json=(status,value)=>res.writeHead(status,{'Content-Type':'application/json'}).end(JSON.stringify(value));
 try{
  if(url.pathname==='/api/journal'){json(200,{...await journal.dataset({window:url.searchParams.get('window')||'90'}),cloud:true,local:false,dataset:'synthetic',scope:'Synthetic loopback SQL fixture; no live account or database writes.',viewer:{id:owner,email:'review@example.test'}});return;}
  if(req.method==='POST'){
   if(req.headers.origin!=='http://127.0.0.1:'+port){json(403,{error:'Fixture origin mismatch'});return;}
   let body='';for await(const c of req)body+=c;
   if(url.searchParams.get('route')==='strength-entry'){json(200,await journal.saveStrength(JSON.parse(body)));return;}
   if(url.searchParams.get('route')==='weigh-in'){json(200,await journal.save(JSON.parse(body)));return;}
   if(url.pathname==='/api/mass/preview'){json(200,await journal.preview(Buffer.from(body)));return;}
   if(url.pathname==='/api/mass/commit'){json(200,await journal.commit(Buffer.from(body),{head:Number(req.headers['x-journal-revision']),hash:req.headers['x-import-hash'],confirmSameDay:req.headers['x-confirm-same-day']==='1'}));return;}
  }
  if(url.pathname.startsWith('/api/')){json(409,{error:'Only synthetic journal QA is enabled.'});return;}
  const path=url.pathname==='/journal'?'/journal.html':url.pathname;
  const file=path==='/design/tokens.css'?fileURLToPath(new URL('../design/tokens.css',import.meta.url)):resolve(root,'.'+decodeURIComponent(path));
  if(path!=='/design/tokens.css'&&(relative(root,file).startsWith('..')||!/\.(js|css|html|ttf|svg)$/.test(file)))throw new Error('Not served');
  const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.ttf':'font/ttf','.svg':'image/svg+xml'};res.setHeader('Content-Type',types[extname(file)]);res.end(await readFile(file));
 }catch(e){json(e.status||400,{error:e.message});}
});server.listen(port,'127.0.0.1',()=>console.log('Synthetic journal fixture: http://127.0.0.1:4176/journal (memory-only PostgreSQL, no live data)'));
