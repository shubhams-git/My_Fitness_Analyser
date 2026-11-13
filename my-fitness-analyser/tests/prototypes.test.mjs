import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { timeBlocks, pace, finite, demonstration, ANALYSIS_VERSION } from '../prototypes/data.mjs';
import { recordIndexAtElapsed } from '../prototypes/interaction-model.js';
import { paceTrace } from '../prototypes/field-notes.js';

test('compact pace trace preserves missing samples, stationary periods and time gaps', () => {
  assert.equal(paceTrace([]),'');
  assert.equal(paceTrace([{t:0,speed:null},{t:1,speed:0}]),'');
  const d=paceTrace([{t:0,speed:2},{t:1,speed:4},{t:2,speed:null},{t:3,speed:2},{t:60,speed:4}]);
  assert.equal((d.match(/M/g)||[]).length,3);
  assert.equal((d.match(/L/g)||[]).length,1);
  assert.match(d,/M600\.00,12\.00/);
  assert.doesNotMatch(d,/NaN|Infinity/);
});

test('replay follows recorded elapsed times through irregular sampling and gaps', () => {
  const records=[{t:0},{t:2},{t:18},{t:18},{t:90}];
  assert.equal(recordIndexAtElapsed([],20),-1);
  assert.equal(recordIndexAtElapsed(records,-5),0);
  assert.equal(recordIndexAtElapsed(records,1),0);
  assert.equal(recordIndexAtElapsed(records,2),1);
  assert.equal(recordIndexAtElapsed(records,17),1);
  assert.equal(recordIndexAtElapsed(records,18),3);
  assert.equal(recordIndexAtElapsed(records,60),3);
  assert.equal(recordIndexAtElapsed(records,900),4);
});

test('control boundaries and keyboard focus meet non-text contrast on all proposed surfaces', async () => {
  const tokens=JSON.parse(await readFile(new URL('../design/tokens.json',import.meta.url),'utf8'));
  const luminance=hex=>{const [r,g,b]=hex.slice(1).match(/../g).map(v=>{const n=parseInt(v,16)/255;return n<=0.04045?n/12.92:((n+.055)/1.055)**2.4;});return .2126*r+.7152*g+.0722*b;};
  const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
  for(const theme of Object.values(tokens.themes))for(const surface of ['canvas','surface','raised'])for(const role of ['border','focus'])assert.ok(contrast(theme[role],theme[surface])>=3,`${role}/${surface} contrast`);
});

test('irregular samples keep real boundaries rather than interpolating a minute', () => {
  const records=[{t:0,distance:0,hr:100},{t:61,distance:150,hr:110},{t:125,distance:300,hr:120}];
  const blocks=timeBlocks(records);
  assert.equal(blocks.length,2);
  assert.deepEqual(blocks.map(b=>[b.start,b.end,b.first,b.last]),[[0,61,0,1],[61,125,1,2]]);
  assert.equal(blocks[0].pace,61/150*1000);
  assert.equal(blocks[1].duration,64);
});

test('absent measurements and stationary samples do not become invented zeroes or pace', () => {
  const missing=timeBlocks([{t:0,distance:null,hr:null},{t:60,distance:100,hr:null}])[0];
  assert.equal(missing.distance,null);assert.equal(missing.pace,null);assert.equal(missing.hr,null);
  const still=timeBlocks([{t:0,distance:0,hr:100},{t:60,distance:0,hr:110}])[0];
  assert.equal(still.distance,0);assert.equal(still.pace,null);
  assert.equal(pace(0),null);assert.equal(pace(null),null);assert.equal(finite(0),0);
  assert.deepEqual(timeBlocks([]),[]);
});

test('demonstration is explicitly synthetic and describes its four-minute blocks correctly', () => {
  const sample=demonstration();
  assert.equal(sample.synthetic,true);assert.equal(sample.blocks.length,5);
  assert.ok(sample.blocks.every(block=>block.duration===240));
  assert.match(sample.observation.title,/blocks/);
  assert.ok(Math.abs(sample.blocks.reduce((sum,b)=>sum+b.distance,0)-sample.distance)<0.001);
  assert.equal(sample.observation.version,ANALYSIS_VERSION);
  assert.equal(sample.records[1].speed,sample.records[1].distance);
});

test('local preview serves its UI while denying credential/source paths and foreign hosts', async () => {
  const port=4186;
  const child=spawn(process.execPath,['prototypes/server.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,FITNESS_CLOUD_ENABLED:'0',PROTOTYPE_PORT:String(port)},stdio:['ignore','pipe','pipe']});
  try {
    await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error('Preview startup timed out')),10000);
      child.once('error',error=>{clearTimeout(timeout);reject(error);});
      child.once('exit',code=>{clearTimeout(timeout);reject(new Error(`Preview exited ${code}`));});
      child.stdout.on('data',chunk=>{if(chunk.toString().includes('Local:')){clearTimeout(timeout);resolve();}});
    });
    const base=`http://127.0.0.1:${port}`;
    assert.equal((await fetch(base)).status,200);
    const shell=await fetch(base+'/training').then(r=>r.text());
    for(const path of ['/','/index.html','/app.html','/training','/journal','/account']){
      const response=await fetch(base+path);assert.equal(response.status,200);
      assert.equal(await response.text(),shell,`${path} must use the shared navigation shell`);
    }
    assert.match(shell,/<script type="module" src="\/navigation\.js">/);
    const navigation=await fetch(base+'/navigation.js').then(r=>r.text());
    for(const stylesheet of ['activity-visuals','satellite-replay','real-map','assets/vendor/maplibre-gl','journal-capture']){
      assert.ok(navigation.includes(`'${stylesheet}'`),`navigation is missing ${stylesheet}`);
      const asset=await fetch(base+'/'+stylesheet+'.css');assert.equal(asset.status,200);assert.match(asset.headers.get('content-type'),/text\/css/);
    }
    const data=await fetch(base+'/api/data');assert.equal(data.status,200);
    assert.match(data.headers.get('content-security-policy'),/connect-src 'self'/);
    assert.match(data.headers.get('content-security-policy'),/worker-src 'self'/);
    assert.match(data.headers.get('content-security-policy'),/connect-src 'self' https:\/\/tiles\.openfreemap\.org https:\/\/tiles\.maps\.eox\.at https:\/\/tiles\.mapterhorn\.com;/);
    const worker=await fetch(base+'/assets/vendor/maplibre-gl-worker.mjs');assert.equal(worker.status,200);assert.match(worker.headers.get('content-type'),/javascript/);
    assert.equal((await fetch(base+'/route-maps.js')).status,200);
    assert.equal((await fetch(base+'/assets/vendor/maplibre-gl.mjs')).status,200);
    const payload=await data.json();assert.ok(payload.activities.length>=1);
    assert.ok(!JSON.stringify(payload).includes('API_KEY'));
    assert.equal((await fetch(base+'/training')).status,200);
    assert.equal((await fetch(base+'/training.js')).status,200);
    for(const path of ['/journal-entry.js','/journal-view.js','/journal-capture.css','/journal-chart.js','/strength-entry.js','/weight-trend.js','/weight-insight.js'])assert.equal((await fetch(base+path)).status,200);
    const training=await fetch(base+'/api/training?window=all').then(r=>r.json());assert.equal(training.dataset,'personal');assert.equal(training.window,'all');assert.ok(training.sessions.every(s=>!s.synthetic));
    const analysis=await fetch(base+'/api/analysis/status').then(r=>r.json());assert.equal(analysis.dataMode,'synthetic-only');assert.equal(analysis.evidence.dataset,'synthetic');assert.ok(!JSON.stringify(analysis).includes('GEMINI_API_KEY'));
    assert.equal((await fetch(base+'/api/analysis/demo',{method:'POST',headers:{Origin:'https://foreign.invalid','Content-Type':'application/json'},body:JSON.stringify({dataset:'synthetic'})})).status,403);
    const personal=await fetch(base+'/api/analysis/demo',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({dataset:'personal'})});assert.equal(personal.status,400);assert.match((await personal.json()).error,/Only synthetic/);
    assert.equal((await fetch(base+'/api/analysis/demo',{method:'POST',headers:{Origin:base},body:'x'.repeat(5000)})).status,400);
    for(const path of ['/.env','/private-data/DATA_REVIEW.md','/server.mjs','/data.mjs','/.git/config','/%2e%2e/.env'])assert.equal((await fetch(base+path)).status,404);
    const foreign=await new Promise((resolve,reject)=>{http.get({host:'127.0.0.1',port,path:'/api/data',headers:{host:'foreign.invalid'}},res=>{res.resume();resolve(res.statusCode);}).on('error',reject);});
    assert.equal(foreign,403);
    assert.equal((await fetch(base+'/api/data',{method:'POST'})).status,403);
  } finally {child.kill();}
});
