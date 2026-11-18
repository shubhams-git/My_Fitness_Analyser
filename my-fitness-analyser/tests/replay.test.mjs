import test from 'node:test';
import assert from 'node:assert/strict';
import {satelliteStyle,replayShot} from '../prototypes/satellite-replay.js';
import {replayModel,replayPhase,replayFlight,replayDuration,travelProgress,replayFraming,replayPullback,replayMetrics,angleDelta,bearing,REPLAY_SECONDS} from '../prototypes/replay-model.js';
const fix=(t,lon=145+t/10000,extra={})=>({t,lat:-37.8,lon,distance:t*3,speed:3,elevation:27,...extra});
test('cinematic sequence orbits, descends, traverses elapsed time, then finishes exactly',()=>{
  assert.equal(replayPhase(.5,1000).name,'overview');assert.equal(replayPhase(2,1000).name,'descent');assert.equal(replayPhase(3.8,1000).time,0);
  const finish=REPLAY_SECONDS-1.6;
  assert.ok(Math.abs(replayPhase((3.8+finish)/2,1000).time-500)<.001);assert.equal(replayPhase(REPLAY_SECONDS,1000).time,1000);assert.equal(replayPhase(100,1000).name,'finished');
});
test('route-aware duration is 20 to 24.5 seconds with gradual acceleration',()=>{
  const five=[fix(0),fix(2000,145.2,{distance:5000})],short=[fix(0),fix(800,145.08,{distance:2000})],long=[fix(0),fix(5000,145.5,{distance:20000})];
  assert.equal(replayDuration([]),20);
  assert.equal(replayDuration(short),21.7);
  assert.equal(replayDuration(five),22.7);
  assert.equal(replayDuration(long),24.5);
  assert.equal(travelProgress(0),0);assert.equal(travelProgress(1),1);assert.equal(travelProgress(.5),.5);assert.ok(travelProgress(.025)<.025);
});
test('camera fits the route between HUD and controls in portrait, landscape and enlarged text',()=>{
 for(const [height,hud,footer]of [[852,174,282],[390,81,180],[568,280,400]]){const f=replayFraming(height,hud,footer);assert.ok(height-f.fit.top-f.fit.bottom>=79.9);assert.ok(f.chase.top>0);assert.equal(f.fit.left,f.fit.right);assert.ok(f.chase.bottom+f.chase.top<height);}
});
test('GPS motion interpolates only adjacent real fixes; metrics remain recorded and gaps stay open',()=>{
  const rows=[fix(0),fix(2),fix(3,null,{lat:null}),fix(4),fix(6),fix(60),fix(62)],model=replayModel(rows);
  assert.ok(model.available);assert.equal(model.sample(1).row,rows[0]);assert.ok(Math.abs(model.sample(1).coordinate[0]-145.0001)<1e-8);
  assert.equal(model.sample(3.5).coordinate,null);assert.equal(model.sample(30).coordinate,null);
  const trail=model.completeTrail.features;assert.equal(trail.length,3);assert.deepEqual(trail.map(f=>f.geometry.coordinates.length),[2,2,2]);
  assert.equal(model.sample(-1).index,-1);assert.equal(model.sample(-1).coordinate,null);
});
test('late GPS acquisition and missing measurements are not invented',()=>{
  const model=replayModel([fix(0,null,{lat:null}),fix(10),fix(11)]);
  assert.equal(model.sample(5).gap,true);assert.equal(model.sample(10).gap,false);
  assert.deepEqual(replayMetrics({t:12,speed:null,distance:null,elevation:null}),{pace:'—',elevation:'—',distance:'—',elapsed:'0:12'});
  assert.equal(replayMetrics(fix(10)).elevation,'27');assert.equal(replayMetrics(fix(10,145,{speed:0})).pace,'—');
  assert.equal(replayModel([fix(0)]).available,false);assert.equal(replayModel([fix(2),fix(1)]).available,false);
});
test('camera uses the shortest direction across north',()=>{
  assert.equal(angleDelta(359,1),2);assert.equal(angleDelta(1,359),-2);assert.ok(Math.abs(bearing([0,0],[1,0])-90)<.001);
});
test('a dateline crossing remains a short geographic move rather than a world-spanning flight',()=>{
  const model=replayModel([fix(0,179.99),fix(10,-179.99)]);
  assert.ok(model.route.bounds[1][0]-model.route.bounds[0][0]<.1);assert.ok(Math.abs(model.sample(5).coordinate[0]-180)<1e-8);
});


test('pullback begins before the finish, stays continuous, and reveals the complete route',()=>{
 for(const duration of [20,22.7,24.5]){
  const finish=duration-1.6;
  assert.equal(replayPullback(3.8,duration),0);
  assert.equal(replayPullback(duration,duration),1);
  assert.ok(replayPullback(finish-.5,duration)>0);
  assert.ok(replayPullback(finish,duration)<1);
  let previous=0;
  for(let t=0;t<=duration;t+=.025){const next=replayPullback(t,duration);assert.ok(next>=previous&&next<=1);assert.ok(next-previous<.025);previous=next;}
 }
});


test('sharper replay imagery uses native tiles and retains the existing terrain',()=>{
 const fallback=satelliteStyle(),sharp=satelliteStyle('browser+key');
 assert.equal(sharp.sources.satellite.tileSize,512);
 assert.equal(sharp.sources.satellite.maxzoom,22);
 assert.equal(sharp.sources.satellite.tiles[0],'https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}?key=browser%2Bkey');
 assert.ok(fallback.sources.satellite.tiles[0].startsWith('https://tiles.maps.eox.at/'));
 assert.deepEqual(sharp.sources.terrain,fallback.sources.terrain);
 assert.deepEqual(sharp.layers,fallback.layers);
});


test('flight pans into the start, turns smoothly at a sharp corner, and settles deterministically',()=>{
 const rows=Array.from({length:401},(_,t)=>fix(t,145+Math.min(t,200)/30000,{
  lat:-37.8+Math.max(t-200,0)/30000,speed:t%2?1:5
 }));
 const model=replayModel(rows),flight=replayFlight(model);
 const fit={zoom:13,bearing:0,center:[145.003,-37.797]},framing={
  fit,opening:{...fit,bearing:flight.openingBearing},closing:{...fit,bearing:flight.closingBearing},
  chase:{top:60}
 };
 const camera=t=>flight.cameraAt(t,framing);
 assert.equal(camera(0).pitch,12);
 assert.notEqual(camera(1).bearing,camera(0).bearing);
 assert.deepEqual(camera(3.8).center,model.route.points[0].coordinate);
 assert.ok(Math.abs(angleDelta(camera(6).bearing,camera(15).bearing))>30);
 for(let t=4;t<16;t+=.025){
  assert.ok(Math.abs(angleDelta(camera(t).bearing,camera(t+.025).bearing))<=.626);
  assert.equal(camera(t).pitch,camera(6).pitch);
  assert.equal(camera(t).zoom,camera(6).zoom);
 }
 assert.deepEqual(camera(model.duration),camera(model.duration-.3));
 assert.equal(camera(model.duration).pitch,0);
 assert.deepEqual(camera(model.duration).center,fit.center);
 assert.deepEqual(flight.cameraAt(6,framing,{reduced:true}),flight.cameraAt(17,framing,{reduced:true}));
 assert.equal(replayShot(model,model.duration/2,true).phase.time,model.end/2);
});

test('lightning stays in the current GPS segment while the complete route is available in every shot',()=>{
 const rows=Array.from({length:182},(_,t)=>t===80?fix(t,null,{lat:null}):fix(t,145+t/40000,{
  speed:3,lat:t<110?-37.8:-37.8+(t-110)/40000
 }));
 const model=replayModel(rows);
 assert.deepEqual(model.wake(80,model.sample(80),60),[]);
 assert.equal(model.lastFixAt(80).row.t,79);
 const sample=model.sample(150.5),wake=model.wake(150.5,sample,90);
 assert.ok(wake[0][0]>=rows[81].lon);
 assert.deepEqual(wake.at(-1),sample.coordinate);
 assert.ok(wake.length<=50);
 assert.equal(model.completeTrail.features.length,2);
 assert.deepEqual(model.completeTrail.features[0].geometry.coordinates.at(-1),model.sample(79).coordinate);
 assert.deepEqual(model.completeTrail.features[1].geometry.coordinates[0],model.sample(81).coordinate);
 assert.equal(replayShot(model,0,false).effect.energy,0);
 assert.ok(replayShot(model,model.duration/2,false).effect.energy>0);
 assert.equal(replayShot(model,model.duration,false).effect.energy,0);
});
