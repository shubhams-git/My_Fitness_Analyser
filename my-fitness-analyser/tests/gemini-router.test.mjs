import test from 'node:test';import assert from 'node:assert/strict';
import {routedGemini,modelRoute,geminiKeys,generationConfig,sharedGeminiKey} from '../cloud/gemini-router.mjs';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
test('free-confirmed pool deduplicates keys and rotates on every attempted request',async()=>{
 const env={GEMINI_API_KEY:'a',GEMINI_API_KEY_2:'b',GEMINI_API_KEY_3:'a',GEMINI_API_KEY_4:'c'};
 assert.deepEqual(geminiKeys(env),['a']);env.GEMINI_KEY_POOL_FREE_CONFIRMED='1';const keys=geminiKeys(env),used=[],requests=[];
 const result=await routedGemini({task:'run-coaching',keys,request:e=>({model:e.model,generation_config:generationConfig(e.model,e.thinking)}),validate:j=>j,fetcher:async(_,o)=>{used.push(o.headers['x-goog-api-key']);requests.push(JSON.parse(o.body));return used.length<3?new Response('private',{status:503}):Response.json({ok:true});}});
 assert.equal(new Set(used).size,3);assert.deepEqual(requests.map(r=>r.generation_config.thinking_level),['high','high','medium']);assert.equal(result.model,'gemini-3.1-flash-lite');assert.deepEqual(requests.map(r=>r.model),['gemini-3.8-flash','gemini-3.6-flash','gemini-3.1-flash-lite']);assert.ok(!JSON.stringify(result.attempts).includes('x-goog-api-key'));
 assert.deepEqual(modelRoute('summary-format').map(e=>e.model),['gemini-3.8-flash','gemini-3.6-flash','gemini-3.5-flash-lite','gemini-3.1-flash-lite']);
});
test('invalid structured output falls back; revoked sharing stops before another transmission',async()=>{
 let calls=0;await assert.rejects(routedGemini({task:'weight-coaching',keys:['a','b'],request:e=>e,validate:()=>{throw Error('invalid');},beforeAttempt:()=>{if(calls)throw Error('revoked');},fetcher:async()=>{calls++;return Response.json({});}}),/revoked/);assert.equal(calls,1);
});
test('quota and credential errors try the whole pool before dropping the primary model',async()=>{
 const used=[];
 const result=await routedGemini({task:'run-coaching',keys:['a','b','c','d','e'],request:entry=>entry,validate:json=>json,
  fetcher:async(_,options)=>{
   used.push(options.headers['x-goog-api-key']);
   return used.length<5?new Response(null,{status:used.length===1?403:429}):Response.json({ok:true});
  }});
 assert.equal(new Set(used).size,5);
 assert.ok(result.attempts.every(attempt=>attempt.model==='gemini-3.8-flash'));
});

test('a missing or duplicate second key prevents any provider call',async()=>{
 let called=false;
 await assert.rejects(routedGemini({task:'run-coaching',keys:['same','same'],fetcher:async()=>{called=true;}}),/two distinct/);
 assert.equal(called,false);
});

test('database rotation continues across reviews and scopes reservations to consented owners',async()=>{
 const db=new PGlite();
 const owner='11111111-1111-4111-8111-111111111111';
 const other='22222222-2222-4222-8222-222222222222';
 try{
  await db.exec(`create role authenticated;create role anon;create schema auth;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create table public.fitness_owners(owner_id uuid primary key);
   insert into public.fitness_owners values('${owner}'),('${other}');
   grant usage on schema auth to authenticated;`);
  for(const file of ['20261107_training_intelligence.sql','20261108_weight_intelligence.sql','20261112120000_gemini_key_rotation.sql']){
   await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  }
  await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${owner}',false);`);
  await db.query("select set_ai_preference(true,'gemini-run-v1'),set_weight_ai_preference(true,'gemini-weight-v1')");
  const reviewArgs=['a'.repeat(64),'gemini-3.8-flash','test-prompt','test-schema'];
  const {rows:[run]}=await db.query('select begin_training_review($1,$2,$3,$4) as id',reviewArgs);
  const {rows:[weight]}=await db.query('select begin_weight_review($1,$2,$3,$4) as id',reviewArgs);
  const api={json:async(_,options)=>{
   const {review_kind,review_id,key_ids}=options.body;
   assert.ok(key_ids.every(id=>/^[a-f0-9]{64}$/.test(id)));
   return (await db.query('select reserve_gemini_key_slot($1,$2,$3) as slot',[review_kind,review_id,key_ids])).rows[0].slot;
  }};
  const keys=['synthetic-key-a','synthetic-key-b','synthetic-key-c'];
  const nextRun=sharedGeminiKey(api,'run-coaching',run.id,keys);
  const nextWeight=sharedGeminiKey(api,'weight-coaching',weight.id,keys);
  assert.deepEqual([await nextRun(),await nextWeight(),await nextRun(),await nextWeight()],[...keys,keys[0]]);
  await assert.rejects(db.query('select * from public.gemini_key_rotation'),error=>error.code==='42501');
  await db.exec(`select set_config('request.jwt.claim.sub','${other}',false);`);
  await assert.rejects(nextRun(),/rotation is unavailable/);
  await db.exec(`select set_config('request.jwt.claim.sub','${owner}',false);`);
  await db.query("select set_ai_preference(false,'gemini-run-v1')");
  await assert.rejects(nextRun(),/rotation is unavailable/);
  assert.equal(await nextWeight(),keys[1]);
 }finally{await db.close();}
});
