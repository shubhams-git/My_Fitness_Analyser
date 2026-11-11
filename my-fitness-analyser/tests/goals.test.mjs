import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
import {validateGoal,goalAt,runningGoalProgress,weightGoalProgress,weekStart,parseGoalTime} from '../prototypes/goal-model.js';
const weekly={kind:'weekly-distance',effectiveFrom:'2026-11-09',target:20000,deadline:null,distanceM:null,revision:1};
const weight={kind:'weight',effectiveFrom:'2026-08-01',target:90,deadline:'2026-12-01',distanceM:null,revision:1};
test('goals require explicit values, sensible dates, Monday periods and benchmark units',()=>{
 assert.equal(validateGoal(weekly,'2026-11-10').target,20000);assert.equal(weekStart('2026-11-15'),'2026-11-09');assert.equal(parseGoalTime('1:30:00'),5400);assert.ok(Number.isNaN(parseGoalTime('30:99')));
 for(const p of [{target:0},{effectiveFrom:'2026-11-10'},{effectiveFrom:'2026-02-30'},{target:1},{deadline:'2026-12-01'},{distanceM:5000}])assert.throws(()=>validateGoal({...weekly,...p},'2026-11-10'));
 assert.throws(()=>validateGoal({...weight,target:90.05},'2026-11-10'));assert.throws(()=>validateGoal({...weight,deadline:'2026-07-01'},'2026-11-10'));
 assert.equal(validateGoal({...weekly,target:null},'2026-11-10').target,null);
});
test('weekly distance uses only the current calendar week and real running distances',()=>{
 const runs=[{id:'a',date:'2026-11-09',run:true,distanceM:5000},{id:'b',date:'2026-11-10',run:true,distanceM:8000},{id:'walk',date:'2026-11-10',run:false,distanceM:10000},{id:'old',date:'2026-11-08',run:true,distanceM:10000},{id:'future',date:'2026-11-11',run:true,distanceM:20000}];
 const p=runningGoalProgress(runs,[weekly],'2026-11-10').weekly;assert.equal(p.done,13000);assert.equal(p.remaining,7000);assert.equal(p.percent,65);assert.equal(p.daysLeft,5);assert.deepEqual(p.sessionIds,['a','b']);
 assert.equal(runningGoalProgress(runs,[{...weekly,target:10000}],'2026-11-10').weekly.status,'met');
});
test('goal versions preserve earlier periods, pauses, future plans and late imports',()=>{
 const history=[weekly,{...weekly,revision:2,effectiveFrom:'2026-11-16',target:25000},{...weekly,revision:3,effectiveFrom:'2026-11-02',target:15000},{...weekly,revision:4,effectiveFrom:'2026-11-23',target:null}];
 assert.equal(goalAt(history,'weekly-distance','2026-11-09').revision,1);assert.equal(goalAt(history,'weekly-distance','2026-11-05').revision,3);
 assert.equal(runningGoalProgress([],history,'2026-11-24').weekly.status,'paused');assert.equal(runningGoalProgress([],[history[1]],'2026-11-10').weekly.status,'planned');
});
test('time targets use eligible elapsed segments after their start, never screenshot averages',()=>{
 const g={kind:'run-time',effectiveFrom:'2026-11-01',target:1800,distanceM:5000,deadline:null,revision:1},runs=[{id:'before',date:'2026-10-31',run:true,bestEfforts:[{distanceM:5000,elapsedS:1700}]},{id:'screen',date:'2026-11-02',run:true,durationS:1600,bestEfforts:[]},{id:'gps',date:'2026-11-08',run:true,bestEfforts:[{distanceM:5000,elapsedS:1900}]}];
 const p=runningGoalProgress(runs,[g],'2026-11-10').time;assert.equal(p.done,1900);assert.equal(p.remaining,100);assert.equal(p.status,'active');assert.deepEqual(p.sessionIds,['gps']);
 assert.equal(runningGoalProgress(runs,[{...g,target:2000}],'2026-11-10').time.status,'met');
});
test('weight targets compare the recorded trend without inventing weigh-ins or fat loss',()=>{
 const points=[{date:'2026-08-01',kg:100,readings:1},{date:'2026-08-15',kg:96,readings:1}],original=structuredClone(points),p=weightGoalProgress(points,[weight],'2026-11-10');
 assert.equal(p.baseline,100);assert.equal(p.current,97);assert.equal(p.remaining,7);assert.equal(p.percent,30);assert.equal(p.measuredDate,'2026-08-15');assert.deepEqual(points,original);
 assert.equal(weightGoalProgress([],[weight],'2026-11-10').current,null);assert.equal(weightGoalProgress(points,[{...weight,target:98}],'2026-11-10').status,'met');
});
test('live schema design executes with owner isolation, protected goals and auditable fallback models',async()=>{
 const db=new PGlite(),owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';let n=1;
 try{
  await db.exec(`create role authenticated;create role anon;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;create table fitness_owners(owner_id uuid primary key);create table fitness_profiles(owner_id uuid primary key,timezone text);insert into fitness_owners values('${owner}'),('${other}');insert into fitness_profiles values('${owner}','Australia/Sydney'),('${other}','Australia/Sydney');`);
  for(const file of ['20261107_training_intelligence.sql','20261108_weight_intelligence.sql','20261110_goals_and_model_routes.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${owner}',false);`);
  const save=(head,g=weekly,id=`aaaaaaaa-aaaa-4aaa-8aaa-${String(n++).padStart(12,'0')}`)=>db.query('select save_training_goal($1,$2,$3,$4) as v',[g.kind,head,id,{effectiveFrom:g.effectiveFrom,target:g.target,deadline:g.deadline,distanceM:g.distanceM}]);
  const id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';await save(0,weekly,id);await save(0,weekly,id);await assert.rejects(save(0),e=>e.code==='PT409');await assert.rejects(save(1,{...weekly,target:1}),e=>e.code==='PT400');
  await save(1,{...weekly,effectiveFrom:'2026-11-02',target:15000});await save(2,{...weekly,target:null});assert.equal((await db.query('select * from training_goal_versions')).rows.length,3);await assert.rejects(db.query('delete from training_goal_versions'),e=>e.code==='42501');
  await db.query("select set_ai_preference(true,'gemini-run-v1')");const report=(await db.query("select begin_training_review($1,'gemini-3.6-flash','p','s') as id",['a'.repeat(64)])).rows[0].id;
  const attempts=[{model:'gemini-3.6-flash',thinking:'high',outcome:'http',httpStatus:503},{model:'gemini-3.8-flash',thinking:'default',outcome:'complete',httpStatus:200}];
  assert.equal((await db.query("select finish_training_review_v2($1,'complete','{}','{}','gemini-3.8-flash',$2) as ok",[report,attempts])).rows[0].ok,true);const stored=(await db.query('select * from analysis_reports')).rows[0];assert.equal(stored.model_id,'gemini-3.8-flash');assert.equal(stored.provider_attempts.length,2);
  await db.exec(`select set_config('request.jwt.claim.sub','${other}',false);`);assert.equal((await db.query('select * from training_goal_versions')).rows.length,0);await save(0);await assert.rejects(db.query("select finish_training_review_v2($1,'failed',null,null,null,'[]')",[report]),e=>e.code==='42501');
  await db.exec('reset role;set role anon;');await assert.rejects(save(0),e=>e.code==='42501');
 }finally{await db.close();}
});
