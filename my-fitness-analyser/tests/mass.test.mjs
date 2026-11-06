import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm,readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { parseMass,mergeMass,importPreview,restoreMass,massDigest,journalDataset,syntheticMass } from '../prototypes/mass.mjs';
import { LocalLibrary } from '../prototypes/library.mjs';
import publicJournal from '../api/journal.mjs';
const row=(extra={})=>({id:'weight-one',dateKey:'2026-10-04',t:Date.parse('2026-10-03T15:00:00Z'),kg:80,note:'Synthetic fixture',updatedAt:100,...extra});
const source=(weights=[row()],sessions=[])=>({app:'mass',format:2,exportedAt:'2026-11-01T00:00:00Z',weights,sessions});
const parse=value=>parseMass(Buffer.from(JSON.stringify(value)));
async function temp(){const path=await mkdtemp(join(tmpdir(),'fitness-mass-'));return {path,url:pathToFileURL(path+'/')};}
async function cleanup(path){assert.match(relative(tmpdir(),path),/^fitness-mass-[^\\/]+$/);await rm(path,{recursive:true,force:true});}

test('MASS adapter preserves dateKey and precision, bounds input and validates identities',()=>{
 const incoming=parse(source());assert.equal(incoming.weights['weight-one'].dateKey,'2026-10-04');assert.equal(incoming.weights['weight-one'].t,Date.parse('2026-10-03T15:00:00Z'));
 assert.equal(parse(source([row({kg:80.12345})])).weights['weight-one'].kg,80.12345);
 for(const extra of [{dateKey:'2026-02-30'},{dateKey:'04/10/2026'},{kg:0},{kg:'80'},{updatedAt:-1},{deletedAt:'yesterday'},{id:'__proto__'},{note:'x'.repeat(5001)}])assert.throws(()=>parse(source([row(extra)])));
 assert.throws(()=>parse({...source(),format:3}));assert.throws(()=>parse({...source(),app:'another-app'}));assert.throws(()=>parseMass('not json'));assert.throws(()=>parseMass(Buffer.alloc(10*1024*1024+1)));
 assert.equal(Object.keys(parse(source([row({id:'toString'})])).weights).length,1);
});
test('reimports, partial exports, newer updates and tombstones respect source revisions',()=>{
 const original=parse(source()),first=mergeMass(null,original),again=mergeMass(first.state,original);assert.equal(again.counts.weights.unchanged,1);assert.equal(again.duplicate,true);assert.equal(Object.keys(again.state.weights).length,1);
 const changed=mergeMass(first.state,parse(source([row({kg:79.7,updatedAt:200})])));assert.equal(changed.counts.weights.updated,1);assert.equal(changed.state.weights['weight-one'].kg,79.7);
 const partial=mergeMass(changed.state,parse(source([row({id:'weight-two',dateKey:'2026-10-06'})])));assert.equal(Object.keys(partial.state.weights).length,2);
 const deletion=mergeMass(partial.state,parse(source([{id:'weight-one',deletedAt:300,updatedAt:300}])));assert.equal(deletion.counts.weights.deleted,1);assert.equal(journalDataset(deletion.state,{window:'all',anchor:'2026-11-01'}).metrics.weighIns,1);
 const old=mergeMass(deletion.state,original);assert.equal(old.counts.weights.older,1);assert.equal(old.state.weights['weight-one'].deletedAt,300);
 const restored=mergeMass(old.state,parse(source([row({updatedAt:400,kg:79})])));assert.equal(restored.state.weights['weight-one'].deletedAt,null);
});
test('same-revision conflicts fail atomically and duplicate IDs in one export are resolved',()=>{
 const first=mergeMass(null,parse(source())).state,before=JSON.stringify(first);
 assert.throws(()=>mergeMass(first,parse(source([row({kg:81})]))),/conflict/);assert.equal(JSON.stringify(first),before);
 assert.throws(()=>parse(source([row(),row({kg:81})])),/conflicting/);
 assert.equal(parse(source([row({updatedAt:200,kg:79}),row()])).weights['weight-one'].kg,79);
});
test('daily and seven-day calculations use recorded days without filling gaps or double weighting',()=>{
 const weights=[row({id:'a',dateKey:'2026-10-01',kg:80}),row({id:'b',dateKey:'2026-10-01',kg:82}),row({id:'c',dateKey:'2026-10-03',kg:79}),row({id:'d',dateKey:'2026-10-06',kg:80}),row({id:'e',dateKey:'2026-10-20',kg:78})];
 const state=mergeMass(null,parse(source(weights))).state,d=journalDataset(state,{window:'all',anchor:'2026-11-01'});
 assert.equal(d.metrics.weighIns,5);assert.equal(d.metrics.recordedDays,4);assert.equal(d.points[0].kg,81);assert.equal(d.points[0].mean7,null);assert.equal(d.points[2].mean7,80);assert.equal(d.points[3].mean7,null);assert.equal(d.metrics.changeKg,-3);assert.equal(d.metrics.latestDate,'2026-10-20');
 assert.equal(journalDataset(state,{window:'30',anchor:'2026-11-01'}).metrics.recordedDays,3);assert.equal(journalDataset(state,{window:'90',anchor:'2026-11-01'}).metrics.recordedDays,4);
 const single=journalDataset(mergeMass(null,parse(source())).state,{window:'all',anchor:'2026-11-01'});assert.equal(single.metrics.changeKg,null);
});
test('strength deletions and missing duration remain separate from active workout totals',()=>{
 const sessions=[{id:'s1',dateKey:'2026-10-04',focus:'Legs',mins:45,updatedAt:1},{id:'s2',dateKey:'2026-10-05',focus:'Cardio',updatedAt:1},{id:'s3',dateKey:'2026-10-04',focus:'Old session',mins:30,updatedAt:1,deletedAt:2}];
 const d=journalDataset(mergeMass(null,parse(source([],sessions))).state,{window:'all',anchor:'2026-11-01'});assert.equal(d.metrics.loggedSessions,2);assert.equal(d.metrics.recordedSessionMinutes,45);assert.equal(d.metrics.strengthSessions,1);assert.equal(d.metrics.cardioSessions,1);assert.equal(d.metrics.durationCoverage,1);assert.equal(d.sessions[0].mins,null);assert.equal(d.tombstones,1);assert.equal(d.metrics.latestKg,null);
});
test('source originals and restored rows are verified, preserving newer local changes',()=>{
 const state=mergeMass(null,parse(source())).state;assert.deepEqual(restoreMass(undefined,state),state);
 const changed=mergeMass(state,parse(source([row({kg:79,updatedAt:200})]))).state;assert.equal(restoreMass(changed,state).weights['weight-one'].kg,79);
 const bad=structuredClone(state);bad.weights['weight-one'].kg=70;assert.throws(()=>restoreMass(undefined,bad),/source evidence/);
 const hash=Object.keys(state.imports)[0],corrupt=structuredClone(state);corrupt.imports[hash].raw+=' ';assert.throws(()=>restoreMass(undefined,corrupt),/hash/);
});
test('review is read-only; import and complete-library restore survive fresh instances',async()=>{
 const a=await temp(),b=await temp();try{const library=new LocalLibrary(a.url),incoming=parse(source()),before=await library.read(),preview=importPreview(before.mass,incoming);assert.equal((await library.read()).mass,undefined);
 await library.importMass(incoming,preview.baseDigest);const persisted=await new LocalLibrary(a.url).read();assert.equal(persisted.mass.weights['weight-one'].kg,80);
 await assert.rejects(library.importMass(parse(source([row({id:'second'})])),preview.baseDigest),/changed/);
 const restore=new LocalLibrary(b.url);await restore.restore(persisted);assert.deepEqual((await restore.read()).mass,persisted.mass);
 await restore.restore({schemaVersion:1,activities:{},feedback:{},originals:{}});assert.equal((await restore.read()).mass.weights['weight-one'].kg,80);
 assert.notEqual(massDigest(persisted.mass),preview.baseDigest);
 }finally{await cleanup(a.path);await cleanup(b.path);}
});
test('hosted journal fails closed without a member session and never serves synthetic readings',async()=>{
 const response={setHeader(){},end(v){this.value=JSON.parse(v);}};await publicJournal({method:'GET',headers:{},url:'/api/journal?window=30'},response);assert.ok([401,503].includes(response.statusCode));assert.equal(response.value.dataset,undefined);assert.equal(response.value.entries,undefined);assert.equal(journalDataset(syntheticMass(),{window:'all'}).metrics.strengthSessions,2);
});
test('local MASS HTTP review, commit retries and origin boundaries use an isolated library',async()=>{
 const directory=await temp(),port=4191,base=`http://127.0.0.1:${port}`,child=spawn(process.execPath,['prototypes/server.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,FITNESS_CLOUD_ENABLED:'0',FITNESS_LIBRARY_DIR:directory.path,PROTOTYPE_PORT:String(port)},stdio:['ignore','pipe','pipe']});
 try{await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Server startup timed out')),10000);child.once('error',reject);child.stdout.on('data',chunk=>{if(chunk.toString().includes('Local:')){clearTimeout(timeout);resolve();}});});
 assert.equal((await fetch(base+'/journal')).status,200);assert.equal((await fetch(base+'/api/journal').then(r=>r.json())).metrics.weighIns,0);
 const body=JSON.stringify(source()),headers={Origin:base,'Content-Type':'application/json'};
 assert.equal((await fetch(base+'/api/mass/preview',{method:'POST',headers:{Origin:'https://foreign.invalid'},body})).status,403);
 const preview=await fetch(base+'/api/mass/preview',{method:'POST',headers,body}).then(r=>r.json());assert.equal(preview.result.weights,1);assert.equal((await new LocalLibrary(directory.url).read()).mass,undefined);
 const commit=()=>fetch(base+'/api/mass/commit',{method:'POST',headers,body:JSON.stringify({token:preview.token})});const responses=await Promise.all([commit(),commit()]);assert.ok(responses.every(r=>r.status===200));assert.equal((await fetch(base+'/api/journal?window=all').then(r=>r.json())).metrics.weighIns,1);
 assert.equal((await fetch(base+'/api/mass/preview',{method:'POST',headers,body:'bad'})).status,400);
 const exportData=await fetch(base+'/api/export').then(r=>r.json());assert.ok(exportData.mass);assert.equal(Object.keys(exportData.activities).length,0);
 }finally{child.kill();await new Promise(resolve=>child.exitCode!==null?resolve():child.once('exit',resolve));await cleanup(directory.path);}
});
