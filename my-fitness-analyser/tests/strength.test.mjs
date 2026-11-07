import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { validateStrength,journalProjection } from '../cloud/journal.mjs';
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333';
const checkin={completion:'modified',effort:7,legFatigue:'heavy',discomfort:'mild',location:'left knee'};
const value={dateKey:'2026-08-20',focus:'Legs',mins:45,note:'Synthetic session',deleted:false,confirmSeparate:false,checkin};
const input={id,operationId:'44444444-4444-4444-8444-444444444444',revision:0,head:0,...value};
test('strength validation never infers missing check-in answers',()=>{
 assert.equal(validateStrength(input,'2026-11-08').new_value.checkin.effort,7);
 for(const v of [{mins:'45'},{mins:0},{mins:2.5},{dateKey:'2026-02-30'},{dateKey:'2026-12-01'},{checkin:{}},{checkin:{...checkin,effort:0}},{checkin:{...checkin,discomfort:'none'}},{checkin:{...checkin,location:''}}])assert.throws(()=>validateStrength({...input,...v},'2026-11-08'));
 assert.equal(validateStrength({...input,mins:null,checkin:null},'2026-11-08').new_value.checkin,null);
});
test('strength SQL isolates members, preserves revisions and receipts, and keeps source sessions distinct',async()=>{
 const db=new PGlite();let op=10;
 try{
  await db.exec(`create role authenticated;create role anon;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;create table fitness_owners(owner_id uuid primary key);create table fitness_profiles(owner_id uuid primary key,timezone text);insert into fitness_owners values('${owner}'),('${other}');insert into fitness_profiles values('${owner}','Australia/Sydney'),('${other}','Australia/Sydney');grant select on fitness_profiles to authenticated;`);
  for(const f of ['20261107_body_journal.sql','20261108_strength_journal.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));
  await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${owner}',false);`);
  const save=(revision,head,v=value,entry=id,receipt=`aaaaaaaa-aaaa-4aaa-8aaa-${String(op++).padStart(12,'0')}`)=>db.query('select save_strength_entry($1,$2,$3,$4,$5) as value',[entry,revision,head,receipt,v]);
  const firstReceipt='55555555-5555-4555-8555-555555555555';await save(0,0,value,id,firstReceipt);await save(0,0,value,id,firstReceipt);
  await assert.rejects(save(0,0,{...value,mins:50},id,firstReceipt),e=>e.code==='PT409');
  await assert.rejects(save(0,1),e=>e.code==='PT409');
  await assert.rejects(save(0,1,value,'66666666-6666-4666-8666-666666666666'),e=>e.code==='PT409');
  await assert.rejects(save(1,1,{...value,checkin:{...checkin,effort:11}}),e=>e.code==='PT400');
  await assert.rejects(save(1,1,{...value,checkin:null,mins:-1}),e=>e.code==='PT400');
  await save(1,1,{...value,checkin:null,deleted:true});
  let snapshot=(await db.query('select journal_snapshot() as v')).rows[0].v;
  assert.equal(journalProjection(snapshot,{window:'all'}).sessions.length,0);assert.equal(journalProjection(snapshot,{window:'all'}).removedSessions.length,1);
  await save(2,2,{...value,checkin:null});
  snapshot=(await db.query('select journal_snapshot() as v')).rows[0].v;
  const view=journalProjection(snapshot,{window:'all'});assert.equal(view.sessions.length,1);assert.equal(view.sessions[0].kind,'Strength');assert.equal(view.sessions[0].source,'manual');assert.equal(view.sessions[0].checkin,null);assert.equal(view.metrics.recordedSessionMinutes,45);
  await assert.rejects(db.query('delete from strength_entries'),e=>e.code==='42501');
  // Importing source evidence does not overwrite a manual session with the same ID.
  const hash='a'.repeat(64);await assert.rejects(db.query('select commit_mass_journal(3,$1,$2,100,$3,$4)',[hash,owner+'/journal/'+hash+'.json','2026-09-01T00:00:00Z',{weights:[],sessions:[{id,dateKey:'2026-08-20',focus:'Legs',mins:40,updatedAt:100,deletedAt:null}]}]),e=>e.code==='PT409');
  await db.query('select commit_mass_journal(3,$1,$2,100,$3,$4,true)',[hash,owner+'/journal/'+hash+'.json','2026-09-01T00:00:00Z',{weights:[],sessions:[{id,dateKey:'2026-08-20',focus:'Legs',mins:40,updatedAt:100,deletedAt:null}]}]);
  snapshot=(await db.query('select journal_snapshot() as v')).rows[0].v;
  assert.equal(journalProjection(snapshot,{window:'all'}).sessions.length,2);
  assert.equal(snapshot.manualSessions.length,1);assert.equal(snapshot.sessions.length,1);
  await assert.rejects(save(0,4,value,'77777777-7777-4777-8777-777777777777'),e=>e.code==='PT409');
  await save(0,4,{...value,confirmSeparate:true},'77777777-7777-4777-8777-777777777777');
  const rows=(await db.query('select * from strength_entries')).rows;assert.equal(rows.length,4);
  await db.exec(`select set_config('request.jwt.claim.sub','${other}',false);`);assert.equal((await db.query('select * from strength_entries')).rows.length,0);await save(0,0);
  await db.exec(`select set_config('request.jwt.claim.sub','99999999-9999-4999-8999-999999999999',false);`);await assert.rejects(save(0,0),e=>e.code==='42501');
  await db.exec('reset role;set role anon;');await assert.rejects(save(0,0),e=>e.code==='42501');
 }finally{await db.close();}
});
