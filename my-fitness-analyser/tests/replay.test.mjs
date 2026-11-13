import test from 'node:test';
import assert from 'node:assert/strict';
import {satelliteStyle} from '../prototypes/satellite-replay.js';
import {replayModel,replayPhase,replayDuration,travelProgress,replayFraming,replayPullback,followCamera,chaseMotion,replayMetrics,angleDelta,bearing,REPLAY_SECONDS} from '../prototypes/replay-model.js';
const fix=(t,lon=145+t/10000,extra={})=>({t,lat:-37.8,lon,distance:t*3,speed:3,elevation:27,...extra});
test('cinematic sequence holds the city, descends, traverses elapsed time, then finishes exactly',()=>{
  assert.equal(replayPhase(.5,1000).name,'overview');assert.equal(replayPhase(2,1000).name,'descent');assert.equal(replayPhase(3.8,1000).time,0);
  const finish=REPLAY_SECONDS-1.6;
  assert.ok(Math.abs(replayPhase((3.8+finish)/2,1000).time-500)<.001);assert.equal(replayPhase(REPLAY_SECONDS,1000).time,1000);assert.equal(replayPhase(100,1000).name,'finished');
  assert.equal(replayPhase(finish,1000).outro,0);assert.ok(Math.abs(replayPhase(REPLAY_SECONDS,1000).outro-1)<.001);
});
test('route-aware duration is 20 to 24.5 seconds, with gradual acceleration and a genuine trailing camera',()=>{
  const five=[fix(0),fix(2000,145.2,{distance:5000})],short=[fix(0),fix(800,145.08,{distance:2000})],long=[fix(0),fix(5000,145.5,{distance:20000})];
  assert.equal(replayDuration([]),20);
  assert.equal(replayDuration(short),21.7);
  assert.equal(replayDuration(five),22.7);
  assert.equal(replayDuration(long),24.5);
  assert.equal(travelProgress(0),0);assert.equal(travelProgress(1),1);assert.equal(travelProgress(.5),.5);assert.ok(travelProgress(.025)<.025);
  const m=replayModel(Array.from({length:81},(_,t)=>fix(t))),s=m.sample(40);
  assert.ok(s.chaseCoordinate[0]<s.coordinate[0]);assert.ok(s.chaseCoordinate[0]>=m.route.points[0].coordinate[0]);
  assert.deepEqual(followCamera(null,s,.016).center,s.chaseCoordinate);
  assert.equal(m.sample(0).chaseCoordinate[0],m.sample(0).coordinate[0]);
});
test('camera fits the route between HUD and controls in portrait, landscape and enlarged text',()=>{
 for(const [height,hud,footer]of [[852,174,282],[390,81,180],[568,280,400]]){const f=replayFraming(height,hud,footer);assert.ok(height-f.fit.top-f.fit.bottom>=79.9);assert.ok(f.chase.bottom>f.fit.bottom);assert.equal(f.fit.left,f.fit.right);assert.ok(f.chase.bottom+f.chase.top<height);}
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


test('pullback begins before the finish, stays continuous, and reveals the complete route',()=>{
 for(const duration of [20,22.7,24.5]){
  const finish=duration-1.6;
  assert.equal(replayPullback(3.8,duration),0);
  assert.equal(replayPullback(duration,duration),1);
  assert.ok(replayPullback(finish-.5,duration)>0);
  assert.ok(replayPullback(finish,duration)<1);
  let previous=0;
  for(let t=0;t<=duration;t+=.025){const next=replayPullback(t,duration);assert.ok(next>=previous&&next<=1);assert.ok(next-previous<.02);previous=next;}
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


test('close chase banks at turns, relaxes at higher speed and keeps optional motion bounded',()=>{
 const slow=chaseMotion(null,{speed:1.2,turn:0},0),fast=chaseMotion(null,{speed:4.5,turn:0},0);
 assert.ok(slow.zoom>fast.zoom&&fast.zoom>15.8);
 assert.ok(chaseMotion(null,{speed:4,turn:90},0).roll>2);
 assert.ok(chaseMotion(null,{speed:4,turn:-90},0).roll< -2);
 assert.equal(chaseMotion(null,{speed:3,turn:0},0,{sharpImagery:false}).zoom,14.8);
 const still=chaseMotion(fast,{speed:4,turn:90},.016,{reduced:true});
 assert.deepEqual([still.pitch,still.roll],[0,0]);
 const quiet=chaseMotion(null,{speed:null,turn:90},.1);
 assert.equal(quiet.roll,0);
 let motion=fast;
 for(let i=0;i<60;i++){
  const next=chaseMotion(motion,{speed:1,turn:90},.016);
  assert.ok(Math.abs(next.roll-motion.roll)<.3);
  motion=next;
 }
 assert.ok(motion.speed<1.2);
});

test('chase only traces the latest continuous GPS segment and finish preserves the complete route',()=>{
 const rows=Array.from({length:182},(_,t)=>t===80?fix(t,null,{lat:null}):fix(t,145+t/40000,{
  speed:3,lat:t<110?-37.8:-37.8+(t-110)/40000
 }));
 const model=replayModel(rows);
 assert.equal(model.sample(80).recentTrail().features.length,0);
 assert.equal(model.lastFixAt(80).row.t,79);
 const sample=model.sample(150.5),[tail]=sample.recentTrail().features;
 assert.ok(tail.properties.recent);
 assert.ok(tail.geometry.coordinates[0][0]>rows[81].lon);
 assert.deepEqual(tail.geometry.coordinates.at(-1),sample.coordinate);
 assert.equal(model.sample(181).trail.features.length,2);
 const turnModel=replayModel(Array.from({length:31},(_,t)=>fix(t,145+Math.min(t,15)/30000,{
  lat:-37.8+Math.max(t-15,0)/30000
 })));
 assert.ok(turnModel.sample(15).turn< -60);
});
