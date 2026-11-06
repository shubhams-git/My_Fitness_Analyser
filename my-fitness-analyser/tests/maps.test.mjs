import test from 'node:test';
import assert from 'node:assert/strict';
import { geographicRoute,routeFeatures,cursorFeature,routeMarkers,nearestRoutePoint } from '../prototypes/route-geometry.js';
import { mapStyle } from '../prototypes/map-style.js';

const fix=(t,lat=10,lon=20,distance=t*10)=>({t,lat,lon,distance});
test('geographic route preserves missing fixes and timestamp gaps without joining them',()=>{
  const records=[fix(0),fix(1),fix(2,null,null),fix(3,11),fix(4,12),fix(50,13),fix(51,14),fix(52,NaN),fix(53,100),fix(54,10,Infinity)];
  const route=geographicRoute(records),features=routeFeatures(route);
  assert.equal(route.points.length,6);assert.equal(features.features.length,3);
  assert.deepEqual(features.features.map(f=>f.geometry.coordinates.length),[2,2,2]);
  assert.deepEqual(routeFeatures(route,{first:3,last:4}).features[0].geometry.coordinates,[[20,11],[20,12]]);
  assert.equal(cursorFeature(route,2).features.length,0);assert.deepEqual(cursorFeature(route,3).features[0].geometry.coordinates,[20,11]);
  assert.equal(geographicRoute([]).bounds,null);
});
test('map bounds unwrap the dateline and support a single recorded fix',()=>{
  const route=geographicRoute([fix(0,5,179.9),fix(1,5,-179.9)]);
  assert.ok(route.bounds[1][0]-route.bounds[0][0]<1);
  assert.deepEqual(geographicRoute([fix(0)]).bounds,[[20,10],[20,10]]);
});
test('map inspections select recorded indices only within a screen-space tolerance',()=>{
  const route=geographicRoute([fix(0),fix(1,20,30)]),project=c=>({x:c[0],y:c[1]});
  assert.equal(nearestRoutePoint(route,project,{x:31,y:21},4),1);
  assert.equal(nearestRoutePoint(route,project,{x:100,y:100},4),null);
  const marks=routeMarkers(geographicRoute([fix(0),fix(100),fix(200),fix(220)]));
  assert.deepEqual(marks.map(m=>m.label),['S','F','1','2']);
});
test('street and night treatments retain real sources, symbols and attribution without mutating upstream',()=>{
  const style={sources:{osm:{attribution:'OpenStreetMap'}},layers:[{id:'background',type:'background',paint:{'background-color':'white'}},{id:'park',type:'fill',paint:{}},{id:'highway-name-minor',type:'symbol',layout:{'text-field':['get','name']},paint:{}}]};
  const night=mapStyle(style,'night'),streets=mapStyle(style,'streets');
  assert.deepEqual(night.sources,style.sources);assert.deepEqual(night.layers[2].layout,style.layers[2].layout);
  assert.notEqual(streets.layers[0].paint['background-color'],night.layers[0].paint['background-color']);
  assert.equal(style.layers[0].paint['background-color'],'white');
});
