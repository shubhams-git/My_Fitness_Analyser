import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createHash } from 'node:crypto';
import { CloudJournal,journalProjection,localDay,validateWeighIn } from '../cloud/journal.mjs';
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333',op='44444444-4444-4444-8444-444444444444';
const input={id,operationId:op,head:0,revision:0,dateKey:'2026-08-12',kg:80.25,note:'',deleted:false,confirmSameDay:false};
test('journal dates follow the member timezone and manual input never coerces blanks or impossible dates',()=>{
 assert.equal(localDay('Australia/Sydney',new Date('2026-10-03T15:00:00Z')),'2026-10-04');
 assert.equal(validateWeighIn(input,'2026-08-12').new_value.kg,80.25);
 for(const value of [{kg:''},{kg:0},{kg:Infinity},{kg:80.256},{dateKey:'2026-02-30'},{dateKey:'2026-06-30'},{dateKey:'2027-01-01'},{head:-1}])assert.throws(()=>validateWeighIn({...input,...value},'2026-11-07'));
});
test('journal projection preserves source identities, separate readings and missing-day rolling means',()=>{
 const row=(source,key,day,kg,deleted=false)=>({source,entry_key:key,revision:1,deleted,data:{id:key,dateKey:day,t:null,kg,note:'',updatedAt:10,deletedAt:deleted?10:null}});
 const snap={revision:3,timezone:'Australia/Sydney',imports:[],sessions:[],weights:[row('mass','one','2026-08-12',80),row('manual',id,'2026-08-12',82),row('manual','removed','2026-08-13',85,true),row('mass','old','2026-06-01',90)]};
 const view=journalProjection(snap,{window:'all',now:new Date('2026-08-14T00:00Z')});
 assert.equal(view.entries.length,2);assert.equal(view.points.length,1);assert.equal(view.points[0].kg,81);assert.equal(view.points[0].mean7,null);assert.equal(view.removed.length,1);assert.equal(new Set(view.entries.map(r=>r.id)).size,2);
});
test('PostgreSQL journal enforces membership, isolation, immutable revisions, same-day acknowledgement and repeat-safe publication',async()=>{
 const db=new PGlite();try{
  await db.exec(`create role authenticated;create role anon;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;create table fitness_owners(owner_id uuid primary key);create table fitness_profiles(owner_id uuid primary key,timezone text);insert into fitness_owners values('${owner}'),('${other}');insert into fitness_profiles values('${owner}','Australia/Sydney'),('${other}','Australia/Sydney');grant select on fitness_profiles to authenticated;`);
  await db.exec(await readFile(new URL('../supabase/migrations/20261107_body_journal.sql',import.meta.url),'utf8'));
  await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${owner}',false);`);
  const value={dateKey:input.dateKey,kg:input.kg,note:'',deleted:false,confirmSameDay:false};
  const save=async(target,revision,head,operation,v=value)=>(await db.query('select save_body_measurement($1,$2,$3,$4,$5) as value',[target,revision,head,operation,v])).rows[0].value;
  assert.equal((await save(id,0,0,op)).revision,1);assert.equal((await save(id,0,0,op)).revision,1);
  await assert.rejects(save(id,0,0,op,{...value,kg:81}),e=>e.code==='PT409');
  await assert.rejects(save(id,0,1,'55555555-5555-4555-8555-555555555555'),e=>e.code==='PT409');
  assert.equal((await save(id,1,1,'55555555-5555-4555-8555-555555555555',{...value,kg:81})).revision,2);
  await assert.rejects(save('66666666-6666-4666-8666-666666666666',0,2,'77777777-7777-4777-8777-777777777777'),e=>e.code==='PT409');
  await save('66666666-6666-4666-8666-666666666666',0,2,'77777777-7777-4777-8777-777777777777',{...value,confirmSameDay:true});
  await assert.rejects(db.query('update body_measurements set weight_kg=1'),e=>e.code==='42501');
  const hash='a'.repeat(64),mass={weights:[{id:'m1',dateKey:'2026-08-10',t:123,kg:79,note:'',updatedAt:100,deletedAt:null},{id:'old',dateKey:'2026-06-01',kg:90,updatedAt:100,deletedAt:null}],sessions:[{id:'s1',dateKey:'2026-08-12',focus:'Push',mins:45,note:'',updatedAt:100,deletedAt:null}]};
  const commit=async(h,hash,v)=>(await db.query('select commit_mass_journal($1,$2,$3,100,$4,$5) as value',[h,hash,owner+'/journal/'+hash+'.json','2026-08-13T00:00:00Z',v])).rows[0].value;
  await assert.rejects(commit(0,hash,mass),e=>e.code==='PT409');
  const result=await commit(3,hash,mass);assert.equal(result.counts.weights.added,1);assert.equal(result.counts.weights.excluded,1);assert.equal((await commit(3,hash,mass)).duplicate,true);
  const updated={...mass,weights:[{...mass.weights[0],updatedAt:200,deletedAt:200}],sessions:[]};
  await commit(4,'b'.repeat(64),updated);await commit(5,'c'.repeat(64),mass);
  assert.equal((await db.query("select deleted from body_measurements_latest where source='mass'")).rows[0].deleted,true);
  const conflicting={...mass,weights:[{...mass.weights[0],kg:70,updatedAt:200,deletedAt:200}]};
  await assert.rejects(commit(6,'d'.repeat(64),conflicting),e=>e.code==='PT409');
  assert.equal((await db.query('select count(*)::int as n from journal_imports')).rows[0].n,3);
  const snapshot=(await db.query('select journal_snapshot() as value')).rows[0].value;assert.equal(snapshot.revision,6);assert.equal(snapshot.weights.length,3);
  await save(id,2,6,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',{...value,kg:81,deleted:true});
  assert.equal((await db.query("select deleted from body_measurements_latest where source='manual' and entry_key=$1",[id])).rows[0].deleted,true);
  await save(id,3,7,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',{...value,kg:81,confirmSameDay:true});
  assert.equal((await db.query("select revision,deleted from body_measurements_latest where source='manual' and entry_key=$1",[id])).rows[0].revision,4);
  const overlap={...mass,weights:[{...mass.weights[0],id:'same-day',dateKey:'2026-08-12'}],sessions:[]};
  await assert.rejects(commit(8,'e'.repeat(64),overlap),e=>e.code==='PT409');
  // Restore exported JSON rows into an independent database, preserving timestamps
  // and all revisions rather than only the current chart's derived values.
  const tables={};for(const name of ['journal_heads','journal_imports','body_measurements','journal_sessions','journal_mutations'])tables[name]=(await db.query(`select to_jsonb(t) as row from ${name} t`)).rows.map(r=>r.row);
  const copy=new PGlite();try{
   await copy.exec(`create role authenticated;create role anon;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;create table fitness_owners(owner_id uuid primary key);create table fitness_profiles(owner_id uuid primary key,timezone text);insert into fitness_owners values('${owner}');insert into fitness_profiles values('${owner}','Australia/Sydney');grant select on fitness_profiles to authenticated;`);
   await copy.exec(await readFile(new URL('../supabase/migrations/20261107_body_journal.sql',import.meta.url),'utf8'));
   for(const [name,rows]of Object.entries(tables))for(const row of rows){const keys=Object.keys(row);await copy.query(`insert into ${name}(${keys.join(',')}) values(${keys.map((_,i)=>'$'+(i+1)).join(',')})`,keys.map(k=>row[k]));}
   await copy.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${owner}',false);`);
   const restored=(await copy.query('select journal_snapshot() as value')).rows[0].value,current=(await db.query('select journal_snapshot() as value')).rows[0].value;
   assert.deepEqual(journalProjection(restored,{window:'all'}),journalProjection(current,{window:'all'}));
  }finally{await copy.close();}
  await db.exec(`select set_config('request.jwt.claim.sub','${other}',false);`);assert.equal((await db.query('select * from body_measurements')).rows.length,0);
  await save(id,0,0,'88888888-8888-4888-8888-888888888888');assert.equal((await db.query('select count(*)::int as n from body_measurements')).rows[0].n,1);
  await db.exec(`select set_config('request.jwt.claim.sub','99999999-9999-4999-8999-999999999999',false);`);await assert.rejects(save(id,0,0,'99999999-9999-4999-8999-999999999999'),e=>e.code==='42501');
  await db.exec('reset role;set role anon;');await assert.rejects(db.query('select journal_snapshot()'),e=>e.code==='42501');
 }finally{await db.close();}
});
test('cloud MASS commit verifies the archived bytes before any database publication',async()=>{
 const raw=Buffer.from(JSON.stringify({app:'mass',format:2,exportedAt:'2026-08-13T00:00:00Z',weights:[],sessions:[]}));let published=false;
 const api={config:{owner},request:async(path,options)=>{if(path.includes('/rpc/commit')){published=true;return Response.json({});}return options?.method==='POST'?Response.json({}):new Response('corrupt');}};
 const journal=new CloudJournal(api);const parsed=journal.parse(raw);
 await assert.rejects(journal.commit(raw,{head:0,hash:parsed.hash}),/did not verify/);assert.equal(published,false);
});
test('MASS publication archives the exact original formatting and checks the reviewed hash',async()=>{
 const raw=Buffer.from(JSON.stringify({app:'mass',format:2,exportedAt:'2026-08-13T00:00:00Z',weights:[],sessions:[]},null,2)+'\n');let stored,publication;
 const api={config:{owner},request:async(path,options={})=>{if(path.includes('/rpc/commit')){publication=options.body;return Response.json({duplicate:false});}if(options.method==='POST'){stored=Buffer.from(options.body);return Response.json({});}return new Response(stored);}};
 const journal=new CloudJournal(api),hash=createHash('sha256').update(raw).digest('hex');
 await assert.rejects(journal.commit(raw,{head:0,hash:'f'.repeat(64)}),/same MASS file/);assert.equal(stored,undefined);
 await journal.commit(raw,{head:0,hash});assert.ok(stored.equals(raw));assert.equal(publication.source_hash,hash);assert.equal(publication.byte_length,raw.length);
});
