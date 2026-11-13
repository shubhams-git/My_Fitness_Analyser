import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { weightTrend } from '../prototypes/weight-trend.js';
import { weightEvidence } from '../analysis/weight-evidence.mjs';
import { validateWeightReport,WEIGHT_SCHEMA,WEIGHT_PROMPT } from '../analysis/weight-contract.mjs';
import { WeightIntelligence,weightRequest } from '../cloud/weight-intelligence.mjs';
const keyEnv={GEMINI_API_KEY:'test-secret',GEMINI_API_KEY_2:'second-secret',GEMINI_FREE_TIER_CONFIRMED:'1',GEMINI_KEY_POOL_FREE_CONFIRMED:'1'};
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const data={anchor:'2026-11-08',today:'2026-11-08',points:Array.from({length:12},(_,i)=>({date:new Date(Date.UTC(2026,8,1+i*3)).toISOString().slice(0,10),kg:80-i*.1+Math.sin(i)*.2,readings:1})),note:'secret note',viewer:{id:owner,email:'private@example.test'}};
function report(p){return {schemaVersion:WEIGHT_SCHEMA,evidenceHash:p.hash,headline:'Your recorded trend moved by {period.trendDifference}.',explanation:'Across {history.days} recorded days, the trend changed. Your latest reading is {latest.age} old.',advice:'Keep your usual routine and compare the next few readings.',signal:{factId:'period.trendChange',direction:'down'},factIds:['period.trendChange','period.trendDifference','history.days','latest.age'],focus:'trend',nextStep:'refresh-readings',supportingFactIds:['period.trendChange','history.days']};}
test('weight trend spans missing calendar days without inventing readings or changing its seed by viewport',()=>{
 const a=[{date:'2026-08-01',kg:100,readings:1},{date:'2026-08-15',kg:96,readings:1}],t=weightTrend(a);
 assert.equal(t.points.length,15);assert.equal(t.observed.length,2);assert.equal(t.latest.trendKg,97);
 assert.equal(t.points[7].kg,null);assert.equal(t.points[7].readings,0);assert.equal(t.points[7].estimated,true);
 assert.ok(t.points.every(p=>p.trendKg>=97&&p.trendKg<=100));assert.equal(t.points.at(-1).date,'2026-08-15');
 const all=weightTrend(data.points),narrow=weightTrend(data.points,{window:'30',anchor:'2026-10-04'});assert.equal(narrow.latest.trendKg,all.latest.trendKg);
 const held=weightTrend(a,{anchor:'2026-09-01',window:'30'});assert.equal(held.latest.date,'2026-09-01');assert.equal(held.latest.trendKg,97);assert.equal(held.latest.held,true);assert.equal(held.latest.kg,null);
 assert.equal(weightTrend([]).latest,null);assert.equal(weightTrend([a[0]]).points.length,1);
 assert.equal(weightTrend([...a,{date:'2026-12-01',kg:500,readings:1}],{anchor:'2026-09-01'}).latest.trendKg,97);
});
test('weight evidence excludes identities, notes and dates; schema rejects invented quantities and body-composition claims',()=>{
 const p=weightEvidence(data),payload=JSON.stringify(weightRequest(p,'gemini-3.6-flash'));
 for(const value of [owner,'private@example.test','secret note','2026-09-01'])assert.ok(!payload.includes(value));
 assert.ok(p.content.facts.some(f=>f.id==='recent.weeklyRate'));assert.equal(p.content.observations.length,12);validateWeightReport(report(p),p);
 // Legitimate count and magnitude citations must not require redundant facts.
 validateWeightReport({...report(p),focus:'coverage',signal:{factId:'period.span',direction:'none'},explanation:'Across {history.readings}, the trend changed. The latest reading is {latest.age} old.',factIds:['period.span','latest.age','period.trendDifference','history.readings']},p);
 validateWeightReport({...report(p),focus:'trend',signal:{factId:'period.trendDifference',direction:'none'},factIds:['period.trendDifference','history.days','latest.age']},p);
 for(const v of [{headline:'You lost 3 kg.'},{headline:'Your fat loss is ideal.'},{factIds:['latest.scale']},{supportingFactIds:['invented']},{nextStep:'eat-less'},{extra:1}])assert.throws(()=>validateWeightReport({...report(p),...v},p));
 assert.equal(weightRequest(p,'gemini-3.6-flash').generation_config.thinking_level,'high');assert.equal(weightRequest(p,'gemini-3.6-flash').store,false);
});
test('weight AI is explicit and consent-scoped, caches valid reports and never retries quota on a paid fallback',async()=>{
 let enabled=false,calls=0,reads=0,saved=null,status=200;
 const api={config:{owner},json:async(path,options)=>{if(path.includes('weight_ai_preferences'))return [{enabled,disclosure_version:'gemini-weight-v1',revision:1}];if(path.includes('reserve_weight_gemini'))return {slot:1};if(path.includes('finish_weight_review')){if(options.body.result_status==='complete')saved={id:'saved',report:options.body.result_report,evidence:options.body.result_evidence,evidence_key:(await engine.context()).key,model_id:'gemini-3.6-flash',schema_version:WEIGHT_SCHEMA,prompt_version:WEIGHT_PROMPT,finished_at:new Date().toISOString()};return true;}return saved?[saved]:[];},request:async path=>Response.json(path.includes('training_worker_ready')?true:'saved')};
 const engine=new WeightIntelligence(api,{journal:{dataset:async()=>{reads++;return data;}},env:keyEnv,fetcher:async()=>{calls++;return status===200?Response.json({status:'completed',steps:[{type:'model_output',content:[{type:'text',text:JSON.stringify(report((await engine.context()).pack))}]}]}):new Response('private body test-secret',{status});}});
 assert.equal((await engine.status()).review,null);await assert.rejects(engine.generate(),e=>e.status===403);assert.equal(reads,0);assert.equal(calls,0);
 enabled=true;await engine.generate();await engine.generate();assert.equal(calls,1);assert.equal((await engine.status()).review.stale,false);
 saved=null;status=429;await assert.rejects(engine.generate(),e=>e.status===429&&!e.message.includes('test-secret'));assert.equal(calls,2);
 enabled=false;assert.equal((await engine.status()).review,null);
});
test('weight consent SQL isolates owners, audits choices and rejects publication after revocation',async()=>{
 const db=new PGlite();try{
  await db.exec(`create role authenticated;create role anon;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create table fitness_owners(owner_id uuid primary key);insert into fitness_owners values('${owner}'),('${other}');grant usage on schema auth to authenticated;`);
  await db.exec(await readFile(new URL('../supabase/migrations/20261108_weight_intelligence.sql',import.meta.url),'utf8'));
  await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${owner}',false);`);
  const args=['a'.repeat(64),'gemini-3.6-flash','weight-coach-v1',WEIGHT_SCHEMA];await assert.rejects(db.query('select begin_weight_review($1,$2,$3,$4)',args),e=>e.code==='42501');
  await db.query("select set_weight_ai_preference(true,'gemini-weight-v1')");const id=(await db.query('select begin_weight_review($1,$2,$3,$4) as id',args)).rows[0].id;
  await assert.rejects(db.query('select begin_weight_review($1,$2,$3,$4)',args),e=>e.code==='PT409');
  await db.query("select set_weight_ai_preference(false,'gemini-weight-v1')");assert.equal((await db.query("select finish_weight_review($1,'complete','{}','{}') as ok",[id])).rows[0].ok,false);
  assert.equal((await db.query('select count(*)::int n from weight_ai_consent_events')).rows[0].n,2);
  await db.exec(`select set_config('request.jwt.claim.sub','${other}',false);`);assert.equal((await db.query('select * from weight_analysis_reports')).rows.length,0);
  await assert.rejects(db.query("select finish_weight_review($1,'complete','{}','{}')",[id]),e=>e.code==='42501');
  await db.exec('reset role;set role anon;');await assert.rejects(db.query('select * from weight_ai_preferences'),e=>e.code==='42501');
 }finally{await db.close();}
});
test('weight changes during a provider request prevent publication against old evidence',async()=>{
 const changed=structuredClone(data);let published=false,failed=false,engine;
 const api={config:{owner},json:async(path,options)=>{
  if(path.includes('weight_ai_preferences'))return [{enabled:true,disclosure_version:'gemini-weight-v1',revision:1}];
  if(path.includes('reserve_weight_gemini'))return {slot:1};if(path.includes('finish_weight_review')){published=options.body.result_status==='complete';failed=options.body.result_status==='failed';return true;}return [];
 },request:async path=>Response.json(path.includes('training_worker_ready')?true:'pending')};
 engine=new WeightIntelligence(api,{journal:{dataset:async()=>changed},env:keyEnv,fetcher:async()=>{const p=(await engine.context()).pack;changed.points.at(-1).kg+=1;return Response.json({status:'completed',steps:[{type:'model_output',content:[{type:'text',text:JSON.stringify(report(p))}]}]});}});
 await assert.rejects(engine.generate(),e=>e.status===409);assert.equal(published,false);assert.equal(failed,true);
});

 test('weight advice can explain ordinary fluctuation without forcing a historical disclaimer or a canned action',()=>{
  const p=weightEvidence(data),r=report(p);r.explanation='A single jump is usually water or food weight, not an instant reversal of your trend.';r.advice='Keep your usual routine. Compare the next few readings before making changes.';r.factIds=['period.trendChange','period.trendDifference','history.days'];
  validateWeightReport(r,p);
  assert.throws(()=>validateWeightReport({...r,signal:{factId:'period.trendChange',direction:'up'}},p),/direction/);
  assert.throws(()=>validateWeightReport({...r,headline:'You have gained fat.'},p),/unsupported/);
 });

test('weight coaching receives only the explicit weight target and measured progress',()=>{
 const p=weightEvidence(data,{goalVersions:[{kind:'weight',revision:1,effectiveFrom:'2026-08-01',target:75,deadline:null},{kind:'weekly-distance',revision:1,effectiveFrom:'2026-08-03',target:99999}]});
 assert.equal(p.content.facts.find(f=>f.id==='goal.weight.target').value,75);assert.ok(!JSON.stringify(p.content).includes('99999'));
 const r=report(p);r.focus='goal';r.headline='You are {goal.weight.remaining} from your target.';r.explanation='Your recorded trend is {goal.weight.current}.';r.factIds=['goal.weight.remaining','goal.weight.current'];r.signal={factId:'goal.weight.remaining',direction:'none'};r.supportingFactIds=['goal.weight.current'];validateWeightReport(r,p);
});
