import test from 'node:test';
import assert from 'node:assert/strict';
import {replayModel,replayPhase,followCamera,replayMetrics,angleDelta,bearing,REPLAY_SECONDS} from '../prototypes/replay-model.js';
const fix=(t,lon=145+t/10000,extra={})=>({t,lat:-37.8,lon,distance:t*3,speed:3,elevation:27,...extra});
test('cinematic sequence holds the city, descends, traverses elapsed time, then finishes exactly',()=>{
  assert.equal(replayPhase(1,1000).name,'overview');assert.equal(replayPhase(2,1000).name,'descent');assert.equal(replayPhase(4.5,1000).time,0);
  assert.equal(replayPhase(18.25,1000).time,500);assert.equal(replayPhase(REPLAY_SECONDS,1000).time,1000);assert.equal(replayPhase(100,1000).name,'finished');
});
test('GPS motion interpolates only adjacent real fixes; metrics remain recorded and gaps stay open',()=>{
  const rows=[fix(0),fix(2),fix(3,null,{lat:null}),fix(4),fix(6),fix(60),fix(62)],model=replayModel(rows);
  assert.ok(model.available);assert.equal(model.sample(1).row,rows[0]);assert.ok(Math.abs(model.sample(1).coordinate[0]-145.0001)<1e-8);
  assert.equal(model.sample(3.5).coordinate,null);assert.equal(model.sample(30).coordinate,null);
  const trail=model.sample(62).trail.features;assert.equal(trail.length,3);assert.deepEqual(trail.map(f=>f.geometry.coordinates.length),[2,2,2]);
  assert.equal(model.sample(-1).index,-1);assert.equal(model.sample(-1).coordinate,null);
});
test('late GPS acquisition and missing measurements are not invented',()=>{
  const model=replayModel([fix(0,null,{lat:null}),fix(10),fix(11)]);
  assert.equal(model.sample(5).gap,true);assert.equal(model.sample(10).gap,false);
  assert.deepEqual(replayMetrics({t:12,speed:null,distance:null,elevation:null}),{pace:'—',elevation:'—',distance:'—',elapsed:'0:12'});
  assert.equal(replayMetrics(fix(10)).elevation,'27');assert.equal(replayMetrics(fix(10,145,{speed:0})).pace,'—');
  assert.equal(replayModel([fix(0)]).available,false);assert.equal(replayModel([fix(2),fix(1)]).available,false);
});
test('camera takes the short heading across north, limits turns, and holds through gaps and stops',()=>{
  assert.equal(angleDelta(359,1),2);assert.equal(angleDelta(1,359),-2);assert.ok(Math.abs(bearing([0,0],[1,0])-90)<.001);
  const previous={center:[145,-37.8],bearing:359};const next=followCamera(previous,{coordinate:[145.01,-37.81],heading:1},.016);
  assert.ok(next.bearing>359&&next.bearing<361);assert.ok(next.center[0]>145&&next.center[0]<145.01);
  assert.equal(followCamera(previous,{coordinate:null},.016),previous);
  assert.ok(Math.abs(followCamera(previous,{coordinate:[145,-37.8],heading:179},.016).bearing-359)<=75*.016);
  assert.equal(followCamera(previous,{coordinate:[145,-37.8],heading:null},.016).bearing,359);
});
test('a dateline crossing remains a short geographic move rather than a world-spanning flight',()=>{
  const model=replayModel([fix(0,179.99),fix(10,-179.99)]);
  assert.ok(model.route.bounds[1][0]-model.route.bounds[0][0]<.1);assert.ok(Math.abs(model.sample(5).coordinate[0]-180)<1e-8);
});
