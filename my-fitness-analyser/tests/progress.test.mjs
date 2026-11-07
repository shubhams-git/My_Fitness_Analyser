import test from 'node:test';
import assert from 'node:assert/strict';
import { bestEfforts, progressModel } from '../prototypes/progress-model.js';
import { recordedDistribution, recordedRange } from '../prototypes/effort-distribution.js';

const recording=(rows,extra={})=>({sport:'Run',distance:5000,records:rows.map(([t,d])=>({t,distance:d,lat:-37,lon:145})),...extra});
const stream=Array.from({length:1001},(_,i)=>[i,4*i]);
test('best efforts use elapsed windows, precise benchmark distances and one result per distance',()=>{
 const efforts=bestEfforts(recording(stream));
 assert.equal(efforts.find(e=>e.distanceM===400).elapsedS,100);
 assert.equal(efforts.find(e=>e.distanceM===1000).elapsedS,250);
 assert.ok(Math.abs(efforts.find(e=>e.distanceM===1609.344).elapsedS-402.336)<1e-9);
 assert.ok(!efforts.some(e=>e.distanceM===5000));
 assert.equal(new Set(efforts.map(e=>e.distanceM)).size,efforts.length);
 assert.equal(efforts[0].basis,'elapsed-samples');
});
test('best efforts consider end-aligned windows rather than only source-aligned starts',()=>{
 // The fastest 400 m ends at the last sample (404 m); its start at
 // 4 m lies between samples at 3 m and 6 m. Start-only scanning misses it.
 const points=Array.from({length:101},(_,i)=>[i,i<=50?i*3:i<100?150+(i-50)*5:404]);
 const r=bestEfforts(recording(points)).find(e=>e.distanceM===400);
 assert.ok(Math.abs(r.elapsedS-(100-4/3))<1e-9);
 assert.ok(r.startS>=0);assert.equal(r.endS-r.startS,r.elapsedS);
});
test('stationary time inside an effort is included; resets, missing GPS and recording gaps are not bridged',()=>{
 const paused=stream.map(([t,d])=>[t+(t>500?30:0),d]);
 // Fill the stationary interval so it is observed, not a missing recording.
 paused.splice(501,0,...Array.from({length:30},(_,i)=>[501+i,2000]));
 const long=bestEfforts(recording(paused)).find(e=>e.distanceM===3218.688);
 assert.ok(Math.abs(long.elapsedS-(3218.688/4+30))<1e-9);
 const gapped=stream.map(([t,d])=>[t+(t>=500?60:0),d]);
 assert.ok(!bestEfforts(recording(gapped)).some(e=>e.distanceM===3218.688));
 const missing=recording(stream);missing.records[500].lat=null;
 assert.ok(!bestEfforts(missing).some(e=>e.distanceM===3218.688));
 const reset=recording(stream);reset.records.slice(500).forEach(r=>r.distance-=2000);
 assert.ok(!bestEfforts(reset).some(e=>e.distanceM===3218.688));
 assert.deepEqual(bestEfforts(recording(stream,{sport:'Walk'})),[]);
 assert.deepEqual(bestEfforts(recording([])),[]);
});
test('monthly totals preserve multiple sessions per day, leap dates, sports and current-month extent',()=>{
 const sessions=[{id:'a',date:'2028-02-29',run:true,distanceM:2000,durationS:600},{id:'b',date:'2028-02-29',run:true,distanceM:3000,durationS:1000},{id:'w',date:'2028-03-01',run:false,distanceM:1000,durationS:null}];
 const model=progressModel(sessions,'2028-03-02');
 assert.equal(model.monthly[0].days,29);assert.equal(model.monthly[0].totalM,5000);
 assert.equal(model.monthly[0].daily.at(-1).sessions.length,2);
 assert.equal(model.monthly[0].activeDays,1);assert.equal(model.monthly.at(-1).through,2);
 assert.equal(model.monthly.at(-1).totalM,0);
 assert.equal(progressModel(sessions,'2028-03-02','all').monthly.at(-1).totalM,1000);
 assert.equal(progressModel(sessions,'2028-03-02','walk').sessions.length,1);
 assert.equal(progressModel([],'2026-11-08').monthly[0].daily.length,30);
});

test('distribution weights elapsed sample intervals and retains unknown gaps instead of assigning zones',()=>{
 const rows=[{t:0,hr:119,speed:3},{t:5,hr:120,speed:0},{t:15,hr:null,speed:2},{t:50,hr:180,speed:2.5},{t:60,hr:180,speed:2.5}];
 const heart=recordedDistribution(rows,'heart');
 assert.equal(heart.knownS,25);assert.equal(heart.unknownS,35);
 assert.equal(heart.bins[1].seconds,5);assert.equal(heart.bins[2].seconds,10);assert.equal(heart.bins[5].seconds,10);
 const pace=recordedDistribution(rows,'pace');assert.equal(pace.knownS,15);assert.equal(pace.unknownS,45);
 assert.equal(heart.bins.reduce((n,b)=>n+b.seconds,0),heart.knownS);
 assert.deepEqual(recordedDistribution([],'heart').bins.map(b=>b.seconds),[0,0,0,0,0,0]);
});

 test('focused chart scales disclose omitted tails while full range retains every measurement',()=>{
 const values=Array.from({length:100},(_,i)=>350+i/2).concat([150,2000]);
 const focused=recordedRange(values,{focus:true}),full=recordedRange(values);
 assert.equal(focused.focused,true);assert.equal(focused.omitted,2);assert.ok(focused.min>150);assert.ok(focused.max<2000);
 assert.equal(full.omitted,0);assert.ok(full.min<150);assert.ok(full.max>2000);assert.equal(values.length,102);
 assert.equal(recordedRange([4,5,6],{focus:true}).focused,false);assert.equal(recordedRange([]),null);
 });
