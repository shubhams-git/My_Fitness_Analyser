import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { cloudConfig,CloudLibrary,CloudError } from '../cloud/supabase.mjs';
import { authorize,signIn } from '../cloud/auth.mjs';
import { privateHandler } from '../cloud/handler.mjs';

const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const config={url:'https://example.supabase.co',key:'publishable-test',owner,origin:'https://fitness.example'};
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},end(body){this.body=body;}});

test('cloud configuration and data routes fail closed before any provider request',async()=>{assert.throws(()=>cloudConfig({}));const out=response();let accessed=false;await privateHandler({method:'GET',headers:{}},out,'data',{env:{FITNESS_CLOUD_ENABLED:'1'},configReader:()=>config,auth:async()=>{throw new CloudError(401,'Sign in');},libraryFactory:()=>{accessed=true;}});assert.equal(accessed,false);assert.equal(out.statusCode,401);assert.equal(out.headers['Cache-Control'],'private, no-store');const disabled=response();await privateHandler({headers:{}},disabled,'data',{env:{}});assert.equal(disabled.statusCode,503);});
test('authentication rejects a forged session and another owner; verified login uses HttpOnly cookies',async()=>{
  await assert.rejects(authorize({headers:{cookie:'fitness_access=forged'}},response(),config,{fetcher:async()=>new Response('{}',{status:401})}),e=>e.status===401);
  await assert.rejects(authorize({headers:{cookie:'fitness_access=valid-other-user'}},response(),config,{fetcher:async()=>Response.json({id:other})}),e=>e.status===403);
  const out=response(),request={headers:{origin:config.origin}};let call=0;
  await signIn(request,out,config,{email:'owner@example.test',password:'synthetic-password'},{fetcher:async()=>++call===1?Response.json({access_token:'access',refresh_token:'refresh'}):Response.json({id:owner})});
  assert.equal(out.headers['Set-Cookie'].length,2);assert.ok(out.headers['Set-Cookie'].every(c=>c.includes('HttpOnly; Secure; SameSite=Lax')));
  await assert.rejects(signIn({headers:{origin:'https://evil.example'}},response(),config,{},{}),e=>e.status===403);
});
test('expired sessions renew server-side and verify the renewed owner before issuing cookies',async()=>{let calls=0;const out=response();const api=await authorize({headers:{cookie:'fitness_access=expired; fitness_refresh=refresh'}},out,config,{fetcher:async()=>{calls++;return calls===1?new Response('{}',{status:401}):calls===2?Response.json({access_token:'renewed',refresh_token:'rotated'}):Response.json({id:owner});}});assert.equal(api.token,'renewed');assert.ok(out.headers['Set-Cookie'][1].includes('rotated'));});
test('cloud save retries a version conflict using fresh data without losing another device change',async()=>{let state={schemaVersion:1,activities:{},originals:{},feedback:{}},revision=1,conflicts=0;const api={config,json:async()=>[{revision,state:structuredClone(state)}],request:async(_,{body})=>{if(!conflicts++){state.feedback.other={note:'Other device'};revision++;return new Response('{}',{status:409});}assert.equal(body.expected_revision,2);state=body.new_state;revision++;return Response.json(revision);}};const library=new CloudLibrary(api);await library.mutate(data=>{data.feedback.here={note:'This device'};});assert.equal(state.feedback.other.note,'Other device');assert.equal(state.feedback.here.note,'This device');});
test('private originals are uploaded before state commit and recovered in exports; failed uploads cannot commit',async()=>{
  const bytes=Buffer.from('synthetic-original'),hash=createHash('sha256').update(bytes).digest('hex');let state={schemaVersion:1,activities:{},originals:{},feedback:{}},commits=0;
  const api={config,json:async()=>[{revision:commits,state:structuredClone(state)}],request:async(path,options={})=>{if(path.includes('/object/')&&options.method==='POST'){assert.deepEqual(options.body,bytes);assert.equal(options.headers['Content-Type'],'application/octet-stream');return Response.json({});}if(path.includes('/object/'))return new Response(bytes);commits++;state=options.body.new_state;assert.deepEqual(state.originals[hash],{key:`${owner}/originals/${hash}.fit`});return Response.json(commits);}};
  const library=new CloudLibrary(api);await library.mutate(data=>{data.originals[hash]=bytes.toString('base64');});assert.equal((await library.exportBackup()).originals[hash],bytes.toString('base64'));
  const failed=new CloudLibrary({...api,request:async()=>new Response('{}',{status:503})}),next=Buffer.from('next-original'),nextHash=createHash('sha256').update(next).digest('hex');await assert.rejects(failed.mutate(data=>{data.originals[nextHash]=next.toString('base64');}));assert.equal(commits,1);assert.equal(state.originals[nextHash],undefined);
});

test('PostgreSQL migration enforces owner isolation, private storage, version checks and sync leases',async()=>{
  const db=new PGlite();try{
    // Supabase provides these schemas/roles. Synthetic stand-ins let PostgreSQL
    // execute the real migration and RLS rules without an external account.
    await db.exec(`create role authenticated;create role anon;create schema auth;create schema storage;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth,storage to authenticated,anon;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);
      create table storage.objects(bucket_id text,name text);
      alter table storage.objects enable row level security;
      grant select,insert on storage.objects to authenticated;
      create function storage.foldername(name text) returns text[] language sql immutable as $$select string_to_array(name,'/')$$;`);
    await db.exec(await readFile(new URL('../supabase/migrations/20261105_private_library.sql',import.meta.url),'utf8'));
    await db.exec(`insert into auth.users values('${owner}'),('${other}');insert into public.fitness_owners values('${owner}'),('${other}');insert into storage.objects values('fitness-private','${owner}/originals/a.fit'),('fitness-private','${other}/originals/b.fit');set role authenticated;select set_config('request.jwt.claim.sub','${owner}',false);`);
    await db.query(`select public.commit_fitness_library(0,'{"schemaVersion":1,"activities":{},"feedback":{},"originals":{}}')`);
    await assert.rejects(db.query(`select public.commit_fitness_library(0,'{"schemaVersion":1,"activities":{},"feedback":{},"originals":{}}')`),e=>e.code==='PT409');
    assert.equal((await db.query('select revision from fitness_libraries')).rows[0].revision,1);
    assert.equal((await db.query('select * from storage.objects')).rows.length,1);
    await assert.rejects(db.query(`insert into storage.objects values('fitness-private','${other}/originals/attack.fit')`));
    const claim=(await db.query('select claim_fitness_sync() as id')).rows[0].id;assert.ok(claim);assert.equal((await db.query('select claim_fitness_sync() as id')).rows[0].id,null);await db.query('select release_fitness_sync($1)',[claim]);assert.ok((await db.query('select claim_fitness_sync() as id')).rows[0].id);
    await db.query(`select set_config('request.jwt.claim.sub',$1,false)`,[other]);assert.equal((await db.query('select * from fitness_libraries')).rows.length,0);await assert.rejects(db.query(`insert into fitness_libraries(owner_id,state) values('${owner}','{"schemaVersion":1}')`));
    await db.exec('reset role;set role anon;');await assert.rejects(db.query('select * from fitness_libraries'));
  }finally{await db.close();}
});
