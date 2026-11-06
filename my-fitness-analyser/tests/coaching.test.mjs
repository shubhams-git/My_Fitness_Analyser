import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { coachingEvidence } from '../analysis/coaching-evidence.mjs';
import { COACH_SCHEMA,validateCoaching } from '../analysis/coaching-contract.mjs';
import { TrainingIntelligence,coachingRequest,extractCoaching } from '../cloud/intelligence.mjs';
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
function library(){return {feedback:{},activities:Object.fromEntries(Array.from({length:8},(_,i)=>['a'+i,{id:'a'+i,title:'PRIVATE title DO NOT SEND',date:'2026-10-'+String(10+i).padStart(2,'0'),sport:'Run',source:'Nike Run Club',sourceFile:'Owner-supplied screenshots',distance:2200,running:900+i*10,timer:null,moving:null,elapsed:920+i*10,displayedPace:400+i*4,hr:null,cadence:160,elevationGain:10,records:[],splits:[{distanceM:1000,paceSecondsPerKm:400},{distanceM:1000,paceSecondsPerKm:410}],sourceNote:'private note',synthetic:false}]))};}
function report(pack){const id='comparison.s01.paceChange';return {schemaVersion:COACH_SCHEMA,evidenceHash:pack.hash,verdict:{text:'Your recorded pace changed by {'+id+'}.',factIds:[id]},findings:[{kind:'pace',headline:'Your latest pace was slower by {'+id+'}.',explanation:'Compared with earlier similar-distance runs from the same source.',assessment:'measured',factIds:[id],nextAction:'Record effort on your next similar run.'}],charts:[{type:'pace',sessionIds:['s01','s02']}]};}
test('coaching evidence includes screenshot comparisons and full splits without transmitting identities, notes or raw streams',()=>{
 const pack=coachingEvidence(library(),{anchor:'2026-11-07'});assert.equal(pack.content.sessions.length,8);assert.ok(pack.content.comparisons.length);assert.ok(pack.content.facts.some(f=>f.id==='s01.splitChange'&&f.value===10));
 const payload=JSON.stringify(coachingRequest(pack,'gemini-3.8-flash'));for(const forbidden of ['PRIVATE','private note','2026-10-17','"a7"','"lat"','"longitude"'])assert.equal(payload.includes(forbidden),false,forbidden);assert.equal(JSON.stringify(pack.content).includes('"a7"'),false);assert.equal(pack.mapping.s01,'a7');assert.equal(coachingRequest(pack,'gemini-3.8-flash').store,false);
});
test('schema and semantic gates reject invented numbers, missing evidence and unavailable charts',()=>{
 const pack=coachingEvidence(library(),{anchor:'2026-11-07'}),good=report(pack);validateCoaching(good,pack);
 for(const mutate of [r=>r.verdict.text='You improved by 20%.',r=>r.findings[0].factIds=['history.runs'],r=>r.charts[0].type='heart_rate',r=>r.extra='unexpected']){const bad=structuredClone(good);mutate(bad);assert.throws(()=>validateCoaching(bad,pack));}
 assert.deepEqual(extractCoaching({status:'completed',steps:[{type:'model_output',content:[{type:'text',text:JSON.stringify(good)}]}]},pack),good);assert.throws(()=>extractCoaching({status:'incomplete'},pack));
});
test('no consent means no library or Google access; quota errors never try another model or expose provider bodies',async()=>{
 let enabled=false,calls=0;const api={config:{owner},json:async(path,options)=>path.includes('ai_preferences')?[{enabled,disclosure_version:'gemini-run-v1',revision:1}]:path.includes('finish_')?true:[],request:async()=>Response.json('review-id')},data={read:async()=>library()};
 let status=429;const engine=new TrainingIntelligence(api,data,{env:{GEMINI_API_KEY:'test-secret',GEMINI_FREE_TIER_CONFIRMED:'1',GEMINI_MODEL:'gemini-3.8-flash'},fetcher:async()=>{calls++;return new Response('private provider body test-secret',{status});}});
 assert.equal((await engine.status()).review,null);await assert.rejects(engine.generate(),e=>e.status===403);assert.equal(calls,0);enabled=true;await assert.rejects(engine.generate(),e=>e.status===429&&!e.message.includes('test-secret'));assert.equal(calls,1);
 status=403;await assert.rejects(engine.generate(),e=>e.status===503&&e.message.includes('HTTP 403')&&!e.message.includes('test-secret'));
});
test('PostgreSQL consent is member-scoped, revocation blocks publication, audit persists and rate claims serialize',async()=>{
 const db=new PGlite();try{
  await db.exec(`create role authenticated;create role anon;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create table fitness_owners(owner_id uuid primary key);insert into fitness_owners values('${owner}'),('${other}');grant usage on schema auth to authenticated;`);
  await db.exec(await readFile(new URL('../supabase/migrations/20261107_training_intelligence.sql',import.meta.url),'utf8'));
  await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${owner}',false);`);
  const args=['a'.repeat(64),'gemini-3.8-flash','test-prompt','test-schema'];await assert.rejects(db.query('select begin_training_review($1,$2,$3,$4)',args),e=>e.code==='42501');
  await db.query("select set_ai_preference(true,'gemini-run-v1')");const id=(await db.query('select begin_training_review($1,$2,$3,$4) as id',args)).rows[0].id;
  await assert.rejects(db.query('select begin_training_review($1,$2,$3,$4)',args),e=>e.code==='PT409');
  await db.query("select set_ai_preference(false,'gemini-run-v1')");assert.equal((await db.query("select finish_training_review($1,'complete','{}','{}') as ok",[id])).rows[0].ok,false);assert.equal((await db.query('select status from analysis_reports')).rows[0].status,'cancelled');assert.equal((await db.query('select * from ai_consent_events')).rows.length,2);
  await db.exec(`select set_config('request.jwt.claim.sub','${other}',false);`);assert.equal((await db.query('select * from ai_preferences')).rows.length,0);assert.equal((await db.query('select * from analysis_reports')).rows.length,0);await assert.rejects(db.query("select finish_training_review($1,'complete','{}','{}')",[id]),e=>e.code==='42501');await assert.rejects(db.query('insert into ai_preferences(owner_id,enabled,disclosure_version) values($1,true,$2)',[owner,'gemini-run-v1']),e=>e.code==='42501');
  await db.exec('reset role;set role anon;');await assert.rejects(db.query('select * from ai_preferences'),e=>e.code==='42501');
 }finally{await db.close();}
});
test('a validated response is persisted once and reused; opting out hides it without deleting history',async()=>{
 let enabled=true,saved=null,providerCalls=0,pack;
 const api={config:{owner},json:async(path,options)=>{
  if(path.includes('ai_preferences'))return [{enabled,disclosure_version:'gemini-run-v1',revision:1}];
  if(path.includes('finish_training_review')){if(options.body.result_status==='complete')saved={id:'saved',report:options.body.result_report,evidence:options.body.result_evidence,evidence_key:(await engine.context()).key,model_id:'gemini-3.8-flash',schema_version:COACH_SCHEMA,prompt_version:'direct-coach-v1',finished_at:new Date().toISOString()};return true;}
  return saved?[saved]:[];
 },request:async()=>Response.json('saved')};
 const engine=new TrainingIntelligence(api,{read:async()=>library()},{env:{GEMINI_API_KEY:'test-secret',GEMINI_FREE_TIER_CONFIRMED:'1'},fetcher:async()=>{providerCalls++;return Response.json({status:'completed',steps:[{type:'model_output',content:[{type:'text',text:JSON.stringify(report(pack))}]}]});}});
 pack=(await engine.context()).pack;assert.equal((await engine.generate()).id,'saved');await engine.generate();assert.equal(providerCalls,1);assert.ok(saved.evidence.mapping.s01);enabled=false;assert.equal((await engine.status()).review,null);assert.ok(saved.report);
});
