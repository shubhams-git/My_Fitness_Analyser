import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { authorize,signOut } from '../cloud/auth.mjs';
import { projectActivities } from '../cloud/activities.mjs';
import { privateHandler } from '../cloud/handler.mjs';
import { CloudLibrary } from '../cloud/supabase.mjs';
import { createHash } from 'node:crypto';
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',activity='33333333-3333-4333-8333-333333333333';
const config={url:'https://example.supabase.co',key:'publishable-test',owner,origin:'https://fitness.example'};
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},end(body){this.body=body;}});
test('an invited second member receives their own request namespace, never the bootstrap owner',async()=>{
  const api=await authorize({headers:{cookie:'fitness_access=member-token'}},response(),config,{fetcher:async(url)=>url.endsWith('/user')?Response.json({id:other,email:'second@example.test'}):Response.json([{owner_id:other}])});
  assert.equal(api.config.owner,other);assert.equal(config.owner,owner);assert.equal(api.user.email,'second@example.test');
  await assert.rejects(authorize({headers:{cookie:'fitness_access=uninvited'}},response(),config,{fetcher:async url=>url.endsWith('/user')?Response.json({id:other}):Response.json([])}),e=>e.status===403);
});
test('a transient refresh failure preserves the session and logout with an expired session still clears cookies',async()=>{
  const out=response();await assert.rejects(authorize({headers:{cookie:'fitness_refresh=valid-refresh'}},out,config,{fetcher:async()=>new Response('{}',{status:503})}),e=>e.status===503);assert.equal(out.headers['Set-Cookie'],undefined);
  await signOut({headers:{origin:config.origin}},out,config);assert.ok(out.headers['Set-Cookie'].every(c=>c.includes('Max-Age=0')));
});
test('NRC projection preserves minute precision, distinct time bases, missing sensors and accepted split revision',()=>{
  const row={id:activity,title:'Synthetic screenshot run',sport:'running',local_date:'2026-08-12',local_start:'17:21:00',start_instant:null,time_precision:'minute',selected_source_id:'accepted',legacy_aliases:['old-import'],coverage:{overviewOnly:false},distance_m:'2200',running_s:'900',elapsed_s:'910',average_pace_s_per_km:'409',average_hr_bpm:null,max_hr_bpm:null,quality_flags:[]};
  const base={activity_id:activity,kind:'provider-kilometre-split',source_id:'accepted'};
  const [result]=projectActivities([row],[{id:'accepted',source_account_id:'nrc',revision_sha256:'abc'}],[{id:'nrc',provider:'nike-run-club'}],[{...base,sequence:1,distance_m:1000,pace_s_per_km:400},{...base,sequence:2,distance_m:1000,pace_s_per_km:410},{...base,source_id:'older',sequence:1,distance_m:1000,pace_s_per_km:500}]);
  assert.equal(result.time,'17:21');assert.equal(result.startInstant,null);assert.equal(result.timer,null);assert.equal(result.running,900);assert.equal(result.hr,null);assert.deepEqual(result.records,[]);assert.equal(result.splits.length,2);assert.match(result.observation.title,/10 seconds/);assert.equal(result.canSaveFeedback,true);
});
test('a second member cannot use the bootstrap Garmin key and hosted requests fail closed instead of returning a demo',async()=>{
  const out=response();let calls=0;
  await privateHandler({method:'POST',url:'/api/garmin/sync',headers:{origin:config.origin}},out,'sync',{env:{VERCEL:'1',GARMIN_PERSONAL_API_KEY:'bootstrap-test'},configReader:()=>config,auth:async()=>({config:{...config,owner:other},user:{id:other}}),libraryFactory:()=>{calls++;return {};}});
  assert.equal(out.statusCode,409);assert.equal(calls,1);assert.match(JSON.parse(out.body).error,/your account/);
  const noSession=response();await privateHandler({method:'GET',headers:{}},noSession,'data',{env:{VERCEL:'1'},configReader:()=>config});assert.equal(noSession.statusCode,401);assert.equal(JSON.parse(noSession.body).activities,undefined);
});

test('screenshot intake uses the signed-in namespace and idempotent evidence queue, never creates a run',async()=>{
  const bytes=Buffer.from([255,216,255,0,1,2]),hash=createHash('sha256').update(bytes).digest('hex'),calls=[];
  const api={config:{...config,owner:other},user:{id:other},request:async(path,options={})=>{calls.push({path,options});if(path.includes('/storage/'))return options.method==='POST'?new Response('{}',{status:409}):new Response(bytes);return new Response(null,{status:201});}};
  const deps={env:{VERCEL:'1'},configReader:()=>config,auth:async()=>api,libraryFactory:()=>({})};
  const headers={origin:config.origin,'x-source-provider':'nike-run-club','x-import-batch':activity,'x-original-name':encodeURIComponent('Run <test>.jpg')},out=response();
  await privateHandler({method:'POST',headers,body:bytes},out,'screenshots',deps);
  assert.equal(out.statusCode,200);assert.ok(calls[0].path.includes(`${other}/submissions/${hash}.jpg`));assert.equal(calls[2].options.body.owner_id,other);assert.equal(calls[2].options.headers.Prefer,'resolution=ignore-duplicates');assert.equal(calls.some(c=>c.path.includes('/activities')),false);
  const invalid=response();await privateHandler({method:'POST',headers,body:Buffer.from('not an image')},invalid,'screenshots',deps);assert.equal(invalid.statusCode,400);assert.equal(calls.length,3);
});

test('private exports include pending evidence and reject a corrupt original rather than emit a partial archive',async()=>{
  const bytes=Buffer.from('synthetic screenshot'),hash=createHash('sha256').update(bytes).digest('hex');let corrupt=false;
  const api={config,json:async path=>path.includes('fitness_libraries')?[]:path.includes('screenshot_submissions')?[{owner_id:owner,sha256:hash,object_key:`${owner}/submissions/${hash}.jpg`}]:[],request:async()=>new Response(corrupt?'corrupt':bytes)};
  const library=new CloudLibrary(api),backup=await library.exportBackup();assert.equal(backup.ownerId,owner);assert.equal(backup.tables.screenshot_submissions.length,1);assert.equal(backup.originals[hash],bytes.toString('base64'));
  corrupt=true;await assert.rejects(library.exportBackup(),/failed verification/);
});
test('profile and feedback SQL isolates members and rejects stale check-in saves without changing measurements',async()=>{
  const db=new PGlite();try{
    await db.exec(`create role authenticated;create role anon;create schema auth;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated;create table fitness_owners(owner_id uuid primary key);
      create table activities(owner_id uuid not null references fitness_owners(owner_id),id uuid not null,primary key(owner_id,id));
      alter table activities enable row level security;create policy own_activity on activities for select to authenticated using(owner_id=auth.uid());
      grant select on fitness_owners,activities to authenticated;
      insert into fitness_owners values('${owner}'),('${other}');insert into activities values('${owner}','${activity}');`);
    await db.exec(await readFile(new URL('../supabase/migrations/20261107_member_profiles_feedback.sql',import.meta.url),'utf8'));
    await db.exec(`insert into fitness_profiles(owner_id,display_name) values('${owner}','First athlete'),('${other}','Second athlete');set role authenticated;select set_config('request.jwt.claim.sub','${owner}',false);`);
    assert.equal((await db.query('select display_name from fitness_profiles')).rows[0].display_name,'First athlete');
    const state={complete:true,answers:{effort:'5',breathing:'sentences',discomfort:'none',finish:'right'}};
    assert.equal((await db.query('select save_activity_feedback($1,0,$2) as revision',[activity,state])).rows[0].revision,1);
    await assert.rejects(db.query('select save_activity_feedback($1,0,$2)',[activity,state]),e=>e.code==='PT409');
    await db.query('select save_activity_feedback($1,1,$2)',[activity,state]);assert.equal((await db.query('select revision from activity_feedback_latest')).rows[0].revision,2);
    await db.exec(`select set_config('request.jwt.claim.sub','${other}',false);`);assert.equal((await db.query('select * from activity_feedback')).rows.length,0);
    await assert.rejects(db.query('select save_activity_feedback($1,0,$2)',[activity,state]),e=>e.code==='42501');
    await db.exec('reset role;set role anon;');await assert.rejects(db.query('select * from fitness_profiles'),e=>e.code==='42501');
  }finally{await db.close();}
});
