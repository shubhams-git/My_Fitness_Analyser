import test from 'node:test';
import assert from 'node:assert/strict';
import { kilometreSplits,seriesChart,metricValue,metricHeadline,benchmarkHistory } from '../prototypes/activity-analysis.js';
const recording=()=>({distance:2200,records:Array.from({length:56},(_,i)=>({t:i*10,distance:i*40,speed:4,hr:140+i,elevation:60+i*.2,cadence:160,lat:-37.9,lon:145.1}))});
test('kilometre splits interpolate boundaries and distinguish the final partial split',()=>{
 const a=recording(),before=JSON.stringify(a),rows=kilometreSplits(a);assert.equal(rows.length,3);assert.deepEqual(rows.map(r=>r.distanceM),[1000,1000,200]);assert.deepEqual(rows.map(r=>r.elapsedS),[250,250,50]);assert.deepEqual(rows.map(r=>r.paceSPerKm),[250,250,250]);assert.ok(Math.abs(rows[0].elevationChangeM-5)<1e-9);assert.equal(JSON.stringify(a),before);
});
test('stationary time counts while gaps and resets never create plausible-looking splits',()=>{
 const a=recording();a.records.splice(26,0,{...a.records[25],t:260});for(let i=27;i<a.records.length;i++)a.records[i].t+=10;
 assert.deepEqual(kilometreSplits(a).map(r=>r.elapsedS),[250,260,50]);const paused=kilometreSplits(a)[1];assert.equal(paused.endS-paused.startS,260);
 const gap=recording();for(let i=10;i<gap.records.length;i++)gap.records[i].t+=60;assert.equal(kilometreSplits(gap)[0].paceSPerKm,null);assert.equal(kilometreSplits(gap)[1].paceSPerKm,250);
 const reset=recording();reset.records[30].distance=0;assert.deepEqual(kilometreSplits(reset),[]);
});
test('distance and time selection use their actual axes, and sensor gaps split area paths',()=>{
 const a=recording();a.records[20].hr=null;const c=seriesChart(a,{kind:'heart'});assert.equal(c.axis,'distance');assert.equal((c.area.match(/Z/g)||[]).length,2);assert.equal(c.nearest(.5),27);assert.ok(c.terrain);assert.equal(c.position(a.records[25]),1000);
 const b=recording();b.records[10].distance=null;b.records[11].distance=null;b.records[12].distance=null;assert.equal(seriesChart(b,{kind:'heart'}).axis,'time');
 assert.equal(metricValue({cadence:0},'cadence'),null);assert.equal(metricValue({elevation:0},'elevation'),0);assert.equal(metricValue({speed:0},'pace'),null);assert.equal(metricValue({power:0},'power'),0);assert.equal(c.timeX(250),c.x(a.records[25]));
});
test('chart full range reveals focused pace tails without altering any original samples',()=>{
 const a=recording();for(const r of a.records)r.speed+=Math.sin(r.t/50)*.1;a.records[5].speed=.3;const before=JSON.stringify(a),focused=seriesChart(a),full=seriesChart(a,{full:true});assert.ok(full.max>focused.max);assert.equal(focused.focused,true);assert.equal(JSON.stringify(a),before);
});
test('best-effort improvements compare earlier dates without guessing same-day order',()=>{
 const rows=[{id:'a',date:'2026-10-01',elapsedS:400},{id:'b',date:'2026-10-01',elapsedS:390},{id:'c',date:'2026-10-10',elapsedS:380},{id:'d',date:'2026-10-20',elapsedS:395}];
 assert.deepEqual(benchmarkHistory(rows).map(r=>r.improvementS),[null,null,10,null]);assert.deepEqual(rows.map(r=>r.elapsedS),[400,390,380,395]);
});

test('headline values retain device summaries and time-weight real zero power without bridging gaps',()=>{
 const activity={distance:5000,timer:1800,hr:171,records:[{t:0,power:0,hr:140},{t:5,power:100,hr:150},{t:10,power:200,hr:160},{t:50,power:100,hr:170}]};
 assert.equal(metricHeadline(activity,'pace').value,360);assert.equal(metricHeadline(activity,'heart').value,171);assert.equal(metricHeadline(activity,'power').value,50);assert.equal(metricHeadline({...activity,records:[]},'power').value,null);
});
