import {privateHandler} from '../cloud/handler.mjs';
import {CloudZones} from '../cloud/zones.mjs';
import {zoneChart,progressZonesMarkup,zoneDuration} from '../prototypes/zone-view.js';
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
import {validateZone,zoneAt,zoneDistribution,activityZones,aggregateZones,parseZonePace,zoneShares} from '../prototypes/zone-model.js';
const heart={kind:'heart',effectiveFrom:'2026-08-20',boundaries:[126,150,172,188],source:'garmin',revision:1};
const pace={kind:'pace',effectiveFrom:'2026-08-20',boundaries:[480,420,375,350,330],source:'manual',revision:1};
test('zone settings require deliberate ordered boundaries and a real effective date',()=>{
 assert.equal(validateZone(heart,'2026-11-10').source,'garmin');assert.equal(validateZone({...heart,boundaries:null},'2026-11-10').boundaries,null);
 for(const patch of [{boundaries:[]},{boundaries:[126,126,172,188]},{boundaries:[126,150.5,172,188]},{boundaries:[0,150,172,188]},{effectiveFrom:'2026-02-30'},{effectiveFrom:'2026-08-32'},{effectiveFrom:'2026-12-01'},{source:'AI'}])assert.throws(()=>validateZone({...heart,...patch},'2026-11-10'));
 assert.throws(()=>validateZone({...pace,boundaries:[330,350,375,420,480]},'2026-11-10'));
 assert.equal(parseZonePace('6:30'),390);assert.ok(Number.isNaN(parseZonePace('6:70')));
});
test('effective dates, same-day corrections and explicit disabling preserve earlier zones',()=>{
 const versions=[heart,{...heart,revision:2,effectiveFrom:'2026-09-01',boundaries:[130,155,175,190]},{...heart,revision:3,effectiveFrom:'2026-09-01',boundaries:null}];
 assert.equal(zoneAt(versions,'heart','2026-08-19'),null);assert.equal(zoneAt(versions,'heart','2026-08-21').revision,1);assert.equal(zoneAt(versions,'heart','2026-09-01').revision,3);assert.equal(zoneAt(versions,'pace','2026-09-01'),null);
});
test('zones weight real time, exact boundaries, zero readings and gaps without inventing streams',()=>{
 const records=[{t:0,hr:125,speed:1000/500},{t:10,hr:126,speed:1000/480},{t:20,hr:150,speed:0},{t:30,hr:172,speed:3},{t:60,hr:188,speed:1000/330},{t:70,hr:null,speed:null},{t:80}];
 const h=zoneDistribution(records,heart),p=zoneDistribution(records,pace);
 assert.deepEqual(h.bins.map(b=>b.seconds),[10,10,10,0,10]);assert.equal(h.knownS,40);assert.equal(h.unknownS,40);
 assert.deepEqual(p.bins.map(b=>b.seconds),[10,10,0,0,0,10]);assert.equal(p.unknownS,50);assert.equal(p.knownS,30);
 assert.equal(activityZones({sport:'Run',date:'2026-08-21',distance:2000,records:[]},[heart]).heart.knownS,0);
 assert.deepEqual(activityZones({sport:'Walk',records},[heart]),{});
});
test('aggregate time uses each run settings version, excludes screenshots and never doubles shares',()=>{
 const rows=[{run:true,zones:{heart:zoneDistribution([{t:0,hr:126},{t:10}],heart)}},{run:true,zones:{heart:zoneDistribution([{t:0,hr:150},{t:20}],{...heart,revision:2})}},{run:true,zones:{}},{run:false,zones:{}}];
 const result=aggregateZones(rows,'heart');assert.equal(result.knownS,10);assert.equal(result.unknownS,20);assert.equal(result.sampledRuns,1);assert.equal(result.uncoveredRuns,2);assert.deepEqual(result.revisions,[1]);
});
test('zone SQL isolates members and protects immutable, idempotent, ordered revisions',async()=>{
 const db=new PGlite(),owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';let counter=1;
 try{
  await db.exec(`create role authenticated;create role anon;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;create table fitness_owners(owner_id uuid primary key);create table fitness_profiles(owner_id uuid primary key,timezone text);insert into fitness_owners values('${owner}'),('${other}');insert into fitness_profiles values('${owner}','Australia/Sydney'),('${other}','Australia/Sydney');`);
  await db.exec(await readFile(new URL('../supabase/migrations/20261110_training_zones.sql',import.meta.url),'utf8'));
  await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${owner}',false);`);
  const value=({effectiveFrom,boundaries,source})=>({effectiveFrom,boundaries,source});
  const save=(rev,v=heart,id=`aaaaaaaa-aaaa-4aaa-8aaa-${String(counter++).padStart(12,'0')}`)=>db.query('select save_training_zones($1,$2,$3,$4) as v',[v.kind,rev,id,value(v)]);
  const op='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';await save(0,heart,op);await save(0,heart,op);
  await assert.rejects(save(1,{...heart,boundaries:[120,140,160,180]},op),e=>e.code==='PT409');
  await assert.rejects(save(0),e=>e.code==='PT409');
  await assert.rejects(save(1,{...heart,boundaries:[126,150,150,188]}),e=>e.code==='PT400');
  await assert.rejects(save(1,{...heart,effectiveFrom:'2026-02-30'}),e=>e.code==='PT400');

  await save(1,{...heart,effectiveFrom:'2026-09-01',boundaries:null});
  await save(2,{...heart,effectiveFrom:'2026-07-01'});assert.equal((await db.query('select * from training_zone_versions')).rows.length,3);
  await assert.rejects(db.query('delete from training_zone_versions'),e=>e.code==='42501');
  await db.exec(`select set_config('request.jwt.claim.sub','${other}',false);`);assert.equal((await db.query('select * from training_zone_versions')).rows.length,0);await save(0,pace);
  await db.exec(`select set_config('request.jwt.claim.sub','99999999-9999-4999-8999-999999999999',false);`);await assert.rejects(save(0),e=>e.code==='42501');
  await db.exec('reset role;set role anon;');await assert.rejects(save(0),e=>e.code==='42501');
 }finally{await db.close();}
});

test('integer chart shares total 100 without changing recorded seconds',()=>{const bins=[620,677,2607,1021,460].map(seconds=>({seconds}));assert.equal(zoneShares(bins).reduce((a,b)=>a+b,0),100);assert.deepEqual(zoneShares([{seconds:0},{seconds:0}]),[0,0]);assert.deepEqual(bins.map(b=>b.seconds),[620,677,2607,1021,460]);});

test('zone API returns useful validation errors and scopes RPC writes to the verified session',async()=>{
 const owner='11111111-1111-4111-8111-111111111111',calls=[];let conflict=false;
 const config={url:'https://example.supabase.co',key:'test',owner,origin:'https://fitness.example'};
 const api={config,user:{id:owner},json:async path=>{assert.ok(path.includes('owner_id=eq.'+owner));return path.includes('fitness_profiles')?[{timezone:'Australia/Sydney'}]:[];},request:async(path,options)=>{calls.push({path,body:options.body});return conflict?new Response(JSON.stringify({code:'PT409',message:'Reload settings.'}),{status:409}):Response.json({kind:'heart',revision:1});}};
 const deps={configReader:()=>config,auth:async()=>api,libraryFactory:()=>({}),env:{VERCEL:'1'}};
 const response=()=>({statusCode:0,setHeader(){},end(body){this.body=JSON.parse(body);}});
 const req=body=>({method:'POST',url:'/api/private?route=zones',headers:{origin:config.origin},body});
 const bad=response();await privateHandler(req({...heart,boundaries:[1]}),bad,'zones',deps);assert.equal(bad.statusCode,400);assert.match(bad.body.error,/boundaries/);assert.equal(calls.length,0);
 const input={...heart,expectedRevision:0,operationId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',owner_id:'22222222-2222-4222-8222-222222222222'};
 const ok=response();await privateHandler(req(input),ok,'zones',deps);assert.equal(ok.statusCode,200);assert.equal(ok.body.saved.revision,1);assert.equal(calls[0].body.owner_id,undefined);assert.equal(calls[0].body.new_value.owner_id,undefined);
 conflict=true;await assert.rejects(new CloudZones(api).save(input),e=>e.status===409&&e.message==='Reload settings.');
});
test('zone views preserve measurement links and distinguish missing sensors from missing settings',()=>{
 const d=zoneDistribution([{t:0,hr:150},{t:10}],heart),html=zoneChart(d,{title:'Heart <rate>',setting:heart});assert.ok(html.includes('Heart &lt;rate&gt;'));assert.ok(html.includes('/account?zones=heart#running-zones'));assert.ok(html.includes('<colgroup>'));assert.equal(zoneDuration(5400),'1h 30m');
 const empty=progressZonesMarkup([{run:true,zones:{}}],'heart',{versions:[heart],through:'2026-11-10'});assert.ok(empty.includes('No usable heart-rate samples'));assert.ok(!empty.includes('Add your zone boundaries'));
 const unset=progressZonesMarkup([],'pace');assert.ok(unset.includes('Add your zone boundaries'));assert.ok(unset.includes('/account?zones=pace#running-zones'));
});
