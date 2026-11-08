import { geographicRoute } from './route-geometry.js';

export const REPLAY_VERSION='satellite-replay-v1';
export const REPLAY_SECONDS=34;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const angleDelta=(from,to)=>((to-from+540)%360+360)%360-180;
export function bearing(a,b){const rad=Math.PI/180,p=a[1]*rad,q=b[1]*rad,d=(b[0]-a[0])*rad;return Math.atan2(Math.sin(d)*Math.cos(q),Math.cos(p)*Math.sin(q)-Math.sin(p)*Math.cos(q)*Math.cos(d))/rad;}
const mix=(a,b,u)=>a+(b-a)*u;
export function replayModel(records){
  const route=geographicRoute(records),segmentAt=new Map(),pointAt=new Map(route.points.map(p=>[p.index,p]));route.segments.forEach((s,n)=>s.forEach(p=>segmentAt.set(p.index,n)));
  const end=records.at(-1)?.t??0;
  function sample(time){
    let lo=0,hi=records.length-1,index=-1;while(lo<=hi){const m=(lo+hi)>>1;if(records[m].t<=time){index=m;lo=m+1;}else hi=m-1;}
    const row=records[index],point=pointAt.get(index),next=records[index+1];
    const segment=segmentAt.get(index),continuous=segment!==undefined&&segmentAt.get(index+1)===segment&&next?.t>row.t;
    const u=continuous?clamp((time-row.t)/(next.t-row.t),0,1):0;
    const coordinate=point&&(time===row.t||continuous||index===records.length-1)?point.coordinate.map((v,n)=>mix(v,n===0?point.coordinate[0]+angleDelta(row.lon,next?.lon??row.lon):next?.lat??row.lat,u)):null;
    const path=segment===undefined?[]:route.segments[segment];
    const ahead=path.find(p=>p.index>index&&((Number.isFinite(row.distance)&&p.row.distance-row.distance>=100)||p.row.t-row.t>=18))||path.at(-1);
    const behind=[...path].reverse().find(p=>p.index<index&&row.t-p.row.t>=8)||path[0];
    const heading=coordinate&&ahead&&behind&&Math.hypot(ahead.coordinate[0]-behind.coordinate[0],ahead.coordinate[1]-behind.coordinate[1])>.00001?bearing(behind.coordinate,ahead.coordinate):null;
    const trail=route.segments.map(s=>{const points=s.filter(p=>p.row.t<=time).map(p=>p.coordinate);if(continuous&&s===path&&coordinate)points.push(coordinate);return points;}).filter(s=>s.length>1);
    return {index,row,coordinate,heading,segment,gap:!coordinate,trail:{type:'FeatureCollection',features:trail.map(coordinates=>({type:'Feature',properties:{},geometry:{type:'LineString',coordinates}}))}};
  }
  return {route,end,sample,available:end>0&&route.segments.length>0&&records.every(r=>Number.isFinite(r.t))&&records.every((r,i)=>!i||r.t>=records[i-1].t)};
}
// Playback time is separate from recorded time: a held overview, a descent,
// elapsed-time traversal (including pauses/gaps), and a quiet finish.
export function replayPhase(seconds,end){
  const t=clamp(seconds,0,REPLAY_SECONDS);
  if(t<1.2)return {name:'overview',time:0,descent:0};
  if(t<4.5){const u=(t-1.2)/3.3;return {name:'descent',time:0,descent:1-(1-u)**3};}
  if(t<32)return {name:'following',time:(t-4.5)/27.5*end,descent:1};
  return {name:'finished',time:end,descent:1};
}
export function followCamera(previous,sample,dt){
  if(!sample.coordinate)return previous;
  if(!previous)return {center:[...sample.coordinate],bearing:sample.heading??0};
  const u=1-Math.exp(-clamp(dt,0,.1)/.24),step=clamp(angleDelta(previous.bearing,sample.heading??previous.bearing)*u,-75*dt,75*dt);
  return {center:previous.center.map((v,n)=>mix(v,sample.coordinate[n],u)),bearing:previous.bearing+step};
}
export function replayMetrics(row){
  const clock=s=>`${Math.floor(Math.round(s)/60)}:${String(Math.round(s)%60).padStart(2,'0')}`;
  return {pace:Number.isFinite(row?.speed)&&row.speed>=1000/3600?clock(1000/row.speed):'—',elevation:Number.isFinite(row?.elevation)?String(Math.round(row.elevation)):'—',distance:Number.isFinite(row?.distance)?(row.distance/1000).toFixed(2):'—',elapsed:Number.isFinite(row?.t)?clock(row.t):'—'};
}
