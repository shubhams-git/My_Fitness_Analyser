import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {runTrainingJob} from '../cloud/training-worker.mjs';
import {geminiAttempt} from '../cloud/gemini-router.mjs';
import {signTrainingJob,TRAINING_ROUTE} from '../cloud/training-job-policy.mjs';
import {coachingEvidence} from '../analysis/coaching-evidence.mjs';
import {COACH_PROMPT,COACH_SCHEMA} from '../analysis/coaching-contract.mjs';
import {syntheticHistory} from '../prototypes/training-data.mjs';

const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const key='synthetic-key',env={GEMINI_API_KEY:key,GEMINI_FREE_TIER_CONFIRMED:'1'};
const pack=coachingEvidence({activities:Object.fromEntries(syntheticHistory().map(a=>[a.id,{...a,synthetic:false}])),feedback:{}},{anchor:'2026-11-07'});
const evidenceKey='a'.repeat(64);
const report={schemaVersion:COACH_SCHEMA,evidenceHash:pack.hash,verdict:{text:'Your log contains {history.runs} recorded runs.',explanation:'Your log gives you a baseline for comparing familiar efforts.',nextAction:'Keep your next run at a familiar effort.',factIds:['history.runs'],signal:{factId:'history.runs',direction:'none'}},findings:[],charts:[]};
const migrations=['20261107_training_intelligence.sql','20261108_weight_intelligence.sql','20261110_goals_and_model_routes.sql','20261111_coaching_recovery.sql','20261112_whole_training_disclosure.sql','20261112120000_gemini_key_rotation.sql','20261113190000_durable_training_jobs.sql','20261113190100_training_job_dispatch.sql'];

test('the worker classifies timeout, quota and incomplete output without leaking provider bodies',async()=>{
 const request={entry:TRAINING_ROUTE[0],apiKey:key,body:{},validate:()=>{throw new Error('should not validate');}};
 const timeout=await geminiAttempt({...request,fetcher:async()=>{throw new DOMException('secret','TimeoutError');}});
 assert.equal(timeout.attempt.outcome,'timeout');
 const quota=await geminiAttempt({...request,fetcher:async()=>Response.json({error:{message:'secret',details:[{retryDelay:'87.2s'}]}},{status:429})});
 assert.equal(quota.attempt.outcome,'quota');assert.equal(quota.retrySeconds,88);assert.doesNotMatch(JSON.stringify(quota),/secret|synthetic-key/);
 const incomplete=await geminiAttempt({...request,fetcher:async()=>Response.json({status:'incomplete',usage:{total_thought_tokens:1100}})});
 assert.equal(incomplete.attempt.outcome,'incomplete');assert.equal(incomplete.attempt.thoughtTokens,1100);
});

test('Postgres dispatches a private job, recovers its lease, paces fallbacks and retains the report independently of the browser',async()=>{
 const db=new PGlite();
 const as=async(role,who='')=>db.exec(`reset role;set role ${role};select set_config('request.jwt.claim.sub','${who}',false);`);
 const admin=()=>db.exec('reset role');
 const sql=async(query,args=[])=>Object.values((await db.query(query,args)).rows[0]||{})[0];
 const rpc={claim_training_job:['job_id','job_capability'],reserve_training_gemini:['job_id','job_capability','job_lease','key_ids','target_model'],finish_training_job:['job_id','job_capability','job_lease','attempt','result_report','retry_seconds','failure_code']};
 const api={json:async(path,{body})=>{const name=path.split('/').at(-1),args=rpc[name].map(field=>body[field]);return sql(`select ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')})`,args);}};
 let calls=0;
 const fetcher=async(_,options)=>{calls++;const body=JSON.parse(options.body);assert.equal(body.store,false);assert.equal(body.model,TRAINING_ROUTE[calls-1].model);assert.equal(body.generation_config.thinking_level,TRAINING_ROUTE[calls-1].thinking);
  if(calls===1)return Response.json({error:{message:'unavailable'}},{status:503});
  return Response.json({status:'completed',usage:{total_input_tokens:600,total_thought_tokens:500,total_output_tokens:350},steps:[{type:'model_output',content:[{type:'text',text:JSON.stringify(report)}]}]});};
 try{
  await db.exec(`create role authenticated;create role anon;create schema auth;create schema cron;create schema net;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create table fitness_owners(owner_id uuid primary key);insert into fitness_owners values('${owner}'),('${other}');grant usage on schema auth to authenticated,anon;
   create table net.requests(id bigint generated always as identity,url text,body jsonb);
   create function net.http_post(url text,body jsonb,timeout_milliseconds int) returns bigint language sql as $$insert into net.requests(url,body) values($1,$2) returning id$$;
   create function cron.schedule(text,text,text) returns bigint language sql as $$select 1::bigint$$;`);
  for(const file of migrations){const source=await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8');await db.exec(source.replace(/^create extension if not exists pg_(net|cron).*;\r?\n/gm,''));}
  await db.exec("insert into training_worker_config(origin) values('https://fitness.example.test')");
  await as('authenticated',owner);await db.query("select set_ai_preference(true,'gemini-training-v2')");
  const enqueue=(who=owner,rev=1)=>sql('select enqueue_training_job($1,$2,$3,$4,$5,$6)',[evidenceKey,pack,rev,signTrainingJob(key,{owner:who,evidenceKey,consentRevision:rev,pack}),COACH_PROMPT,COACH_SCHEMA]);
  const queued=await enqueue();assert.equal(queued.state,'queued');assert.equal((await enqueue()).id,queued.id);
  await assert.rejects(db.query('select * from training_analysis_jobs'),e=>e.code==='42501');
  await as('authenticated',other);assert.equal(await sql('select training_job_status()'),null);
  await admin();const delivery=await sql('select body from net.requests');assert.equal(delivery.id,queued.id);
  await as('anon');assert.equal(await runTrainingJob(api,{...delivery,capability:other},{env,fetcher}),false);
  assert.ok(await sql('select claim_training_job($1,$2)',[delivery.id,delivery.capability]));
  assert.equal(await runTrainingJob(api,delivery,{env,fetcher}),false);assert.equal(calls,0);
  await admin();await db.query("update training_analysis_jobs set lease_until=now()-interval '1 second'");assert.equal(await sql('select dispatch_training_jobs()'),0);
  await db.query("update training_analysis_jobs set dispatched_at=now()-interval '61 seconds'");assert.equal(await sql('select dispatch_training_jobs()'),1);
  await as('anon');await runTrainingJob(api,delivery,{env,fetcher});assert.equal(calls,1);
  await runTrainingJob(api,delivery,{env,fetcher});assert.equal(calls,1);
  await as('authenticated',owner);assert.ok((await sql('select training_job_status()')).retryAt);
  await admin();await db.exec("update training_analysis_jobs set available_at=now();update gemini_request_budget set next_request_at=now()");
  await as('anon');await runTrainingJob(api,delivery,{env,fetcher});assert.equal(calls,2);
  await as('authenticated',owner);const complete=await sql('select training_job_status()');assert.equal(complete.state,'complete');assert.equal(complete.attempts[0].httpStatus,503);assert.equal(complete.attempts[1].thoughtTokens,500);
  assert.deepEqual(await sql('select report from analysis_reports where id=$1',[queued.id]),report);
  await assert.rejects(db.query("select finish_training_review($1,'failed',null,null)",[queued.id]),e=>e.code==='42501');
  await db.query("select set_weight_ai_preference(true,'gemini-weight-v1')");
  const weight=await sql('select begin_weight_review($1,$2,$3,$4)',[evidenceKey,'gemini-3.6-flash','weight-prompt','weight-schema']);
  const reserveWeight=()=>sql('select reserve_weight_gemini($1,$2,$3)',[weight,[evidenceKey],'gemini-3.6-flash']);
  assert.ok((await reserveWeight()).retryAt,'weight shares the same app-wide minute budget');
  await admin();assert.equal(await sql('select pack from training_analysis_jobs where id=$1',[queued.id]),null);
  await db.query("update analysis_reports set created_at=now()-interval '31 seconds'");
  await as('authenticated',owner);const second=await enqueue();await db.query("select set_ai_preference(false,'gemini-training-v2')");
  await admin();const cancelled=await sql('select body from net.requests where body->>\'id\'=$1',[second.id]);
  assert.equal(await sql('select pack from training_analysis_jobs where id=$1',[second.id]),null);
  await as('anon');assert.equal(await runTrainingJob(api,cancelled,{env,fetcher}),false);assert.equal(calls,2);
 }finally{await db.close();}
});
