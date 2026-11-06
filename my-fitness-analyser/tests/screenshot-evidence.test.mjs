import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { validateReview,buildManifest,buildPublication,publicationSQL,sha256,md5 } from '../imports/screenshot-evidence.mjs';

const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
function fixture(){
  const runs=[{key:'synthetic-am',date:'2026-08-03',title:'Synthetic morning',start:'07:21',end:'07:35',distance:2100,pace:400,fastest:320,running:840,elapsed:842,calories:200,cadence:160,gain:10,loss:9,summary:0,splitsImage:1,overview:[2],splits:[[1,1,390,null,1],[2,1,405,15,-2],[3,.1,440,35,0]],issues:[],hr:null,maxHr:null},
    {key:'synthetic-pm',date:'2026-08-03',title:'Synthetic evening',distance:500,pace:420,running:210,overview:[2],splits:[],issues:['Overview only'],hr:null,maxHr:null}];
  const files=[{group:'synthetic',path:'summary.jpg'},{group:'synthetic',path:'splits.jpg'},{group:'overview',path:'overview.jpg'}];
  return {version:1,cutoff:'2026-07-01',reviewedAt:'2026-11-06',yearEvidence:'Synthetic fixture, year explicit',files,runs,monthlyAssertions:[{month:'2026-08',runs:2,distanceM:2610,paceSecondsPerKm:404,assets:[2]}]};
}
function prepare(input=fixture()){
  const assets=input.files.map((f,index)=>{const b=Buffer.from(f.path);return {index,group:f.group,originalName:f.path,sha256:sha256(b),md5:md5(b),bytes:b.length,extension:'jpg',mediaType:'image/jpeg'};});
  const manifest=buildManifest(input,assets),bytes=JSON.stringify(manifest,null,2)+'\n';
  return {manifest,bundle:buildPublication(manifest,bytes,owner)};
}
async function database(){
  const db=new PGlite();await db.exec(`create role authenticated;create role anon;create schema auth;create schema storage;
    create table auth.users(id uuid primary key);create table public.fitness_owners(owner_id uuid primary key references auth.users(id));
    alter table public.fitness_owners enable row level security;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create policy membership on public.fitness_owners for select to authenticated using(owner_id=auth.uid());`);
  await db.exec(`grant usage on schema auth to authenticated,anon;grant select on fitness_owners to authenticated;
    create table storage.objects(bucket_id text,name text,metadata jsonb);
    insert into auth.users values('${owner}'),('${other}');insert into fitness_owners values('${owner}'),('${other}');`);
  await db.exec(await readFile(new URL('../supabase/migrations/20261106_activity_evidence.sql',import.meta.url),'utf8'));
  return db;
}
async function seedObjects(db,bundle){for(const a of bundle.tables.raw_assets)await db.query('insert into storage.objects values($1,$2,$3)',[a.bucket_id,a.object_key,{size:a.byte_length,eTag:'"'+a.md5+'"'}]);}

test('review rejects missing images, duplicate identity, pre-July dates and unsupported invented measurements',()=>{
  for(const change of [x=>x.runs.push({...x.runs[0]}),x=>x.runs[0].date='2026-06-30',x=>x.runs[0].splitsImage=99,x=>x.runs[0].hr=0,x=>x.runs[0].start='07:21:04',x=>x.monthlyAssertions[0].runs=3,x=>x.files.push({path:'unassigned.jpg'}),x=>x.runs[0].elapsed=100]){const input=fixture();change(input);assert.throws(()=>validateReview(input));}
});
test('rounded screenshot assertions remain distinct from measured streams and monthly aggregate claims',()=>{
  const {manifest,bundle}=prepare();assert.equal(manifest.reconciliation[0].differenceM,10);
  assert.notEqual(bundle.tables.activities[0].id,bundle.tables.activities[1].id);
  const a=bundle.tables.activities[0],b=bundle.tables.activities[1];assert.equal(a.start_instant,null);assert.equal(a.timezone_name,null);assert.equal(a.time_precision,'minute');assert.equal(b.time_precision,'date');assert.equal(b.elapsed_s,null);assert.equal(b.average_hr_bpm,null);
  assert.equal(bundle.tables.activity_segments.at(-1).duration_s,null);assert.equal(bundle.tables.activity_segments.at(-1).distance_m,100);
  assert.equal(bundle.tables.activity_sources[0].field_evidence.elevation_loss_m.display,'-9 m');
  const quoted=fixture();quoted.runs[0].title="Runner's $guard$ loop";assert.match(publicationSQL(prepare(quoted).bundle),/Runner''s \$guard\$ loop/);
});
test('PostgreSQL publishes atomically, replays without duplicates and preserves immutable accepted revisions',async()=>{
  const db=await database();try{
    const input=fixture();input.runs[0].title="Runner's $guard$ loop \\ private";const {bundle}=prepare(input);await assert.rejects(db.exec(publicationSQL(bundle)),/upload missing/);await db.exec('rollback');
    assert.equal((await db.query('select count(*)::int as n from activities')).rows[0].n,0);
    await seedObjects(db,bundle);
    // Real dashboard resumable uploads can have a composite one-part ETag.
    await db.exec(`update storage.objects set metadata=jsonb_set(metadata,'{eTag}',to_jsonb(md5(decode(trim(both '"' from metadata->>'eTag'),'hex'))||'-1'))`);
    await db.exec(publicationSQL(bundle));await db.exec(publicationSQL(bundle));
    assert.equal((await db.query('select count(*)::int as n from activities')).rows[0].n,2);
    assert.equal((await db.query('select count(*)::int as n from activity_sources')).rows[0].n,2);
    assert.equal((await db.query('select count(*)::int as n from activity_segments')).rows[0].n,3);
    assert.equal((await db.query('select title from activities where local_start is not null')).rows[0].title,input.runs[0].title);
    const corrected=structuredClone(input);corrected.runs[0].pace=399;const next=prepare(corrected).bundle;
    await db.query('insert into storage.objects values($1,$2,$3)',[next.tables.raw_assets.at(-1).bucket_id,next.tables.raw_assets.at(-1).object_key,{size:next.tables.raw_assets.at(-1).byte_length,eTag:next.tables.raw_assets.at(-1).md5}]);
    await assert.rejects(db.exec(publicationSQL(next)),/another accepted revision/);await db.exec('rollback');
    assert.equal((await db.query('select average_pace_s_per_km::int as pace from activities where local_start is not null')).rows[0].pace,400);
    await db.query(`update storage.objects set metadata=jsonb_set(metadata,'{eTag}','"wrong"') where name=$1`,[bundle.tables.raw_assets[0].object_key]);
    await assert.rejects(db.exec(publicationSQL(bundle)),/ETag mismatch/);await db.exec('rollback');
  }finally{await db.close();}
});
test('owner read boundaries, anonymous denial and cross-owner foreign keys execute in PostgreSQL',async()=>{
  const db=await database();try{
    const {bundle}=prepare();await seedObjects(db,bundle);await db.exec(publicationSQL(bundle));
    await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${other}',false);`);
    for(const table of Object.keys(bundle.tables))assert.equal((await db.query('select * from public.'+table)).rows.length,0);
    await db.exec(`select set_config('request.jwt.claim.sub','${owner}',false);`);
    assert.equal((await db.query('select * from activities')).rows.length,2);
    await assert.rejects(db.query('update activities set title=\'Tampered\''),e=>e.code==='42501');
    await db.exec('reset role;set role anon;');await assert.rejects(db.query('select * from activities'),e=>e.code==='42501');
    await db.exec('reset role;');
    await assert.rejects(db.query(`insert into activity_source_assets(owner_id,source_id,asset_id,evidence_role) values($1,$2,$3,'attack')`,[other,bundle.tables.activity_sources[0].id,bundle.tables.raw_assets[0].id]),e=>e.code==='23503');
  }finally{await db.close();}
});
