import { geographicRoute } from './route-geometry.js';

export const REPLAY_VERSION='satellite-replay-v5';
export const REPLAY_SECONDS=22.7;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const angleDelta=(from,to)=>((to-from+540)%360+360)%360-180;
export function bearing(a,b){const rad=Math.PI/180,p=a[1]*rad,q=b[1]*rad,d=(b[0]-a[0])*rad;return Math.atan2(Math.sin(d)*Math.cos(q),Math.cos(p)*Math.sin(q)-Math.sin(p)*Math.cos(q)*Math.cos(d))/rad;}
const mix=(a,b,u)=>a+(b-a)*u;
export function replayDuration(records){
  const distances=records.map(r=>r.distance).filter(Number.isFinite);
  const km=distances.length>1?Math.max(0,distances.at(-1)-distances[0])/1000:0;
  return Math.round(Math.min(20+1.2*Math.sqrt(km),24.5)*10)/10;
}
export function travelProgress(u){u=clamp(u,0,1);const ramp=.1;if(u<ramp)return u*u/(2*ramp*(1-ramp));if(u>1-ramp)return 1-(1-u)**2/(2*ramp*(1-ramp));return (u-ramp/2)/(1-ramp);}
// Start widening during the last part of traversal, then settle on the whole route.
export function replayPullback(seconds,duration=REPLAY_SECONDS){
 const start=3.8+(duration-1.6-3.8)*.88,u=clamp((seconds-start)/(duration-start),0,1);
 return u*u*(3-2*u);
}
export function replayFraming(height,hud,footer){
 const total=hud+footer+32,scale=Math.min(1,Math.max(0,height-80)/Math.max(1,total));
 const top=(hud+16)*scale,bottom=(footer+16)*scale,lead=Math.max(0,height-top-bottom)*.12;
 return {fit:{top,bottom,left:24,right:24},chase:{top,bottom:bottom+lead,left:0,right:0}};
}
// Find the last sample at or before a time, including duplicate timestamps.
function atOrBefore(rows,time,timeOf){
  let low=0,high=rows.length;
  while(low<high){
    const middle=(low+high)>>1;
    if(timeOf(rows[middle])<=time)low=middle+1;
    else high=middle;
  }
  return low-1;
}
const recordTime=row=>row.t,pointTime=point=>point.row.t;
function interpolatePoint(point,next,time){
  const span=next?.row.t-point.row.t;
  if(!(span>0))return point.coordinate;
  const u=clamp((time-point.row.t)/span,0,1);
  return point.coordinate.map((value,axis)=>mix(value,next.coordinate[axis],u));
}
function positionAt(path,time){
  const index=Math.max(0,atOrBefore(path,time,pointTime));
  return interpolatePoint(path[index],path[index+1],time);
}
function speedAt(path,time){
  const index=Math.max(0,atOrBefore(path,time,pointTime));
  const a=path[index].row,b=path[index+1]?.row;
  if(!Number.isFinite(a.speed)||a.speed<0)return null;
  if(!Number.isFinite(b?.speed)||b.speed<0||b.t<=a.t)return a.speed;
  return mix(a.speed,b.speed,clamp((time-a.t)/(b.t-a.t),0,1));
}
const metresBetween=(a,b)=>111195*Math.hypot(
  (b[0]-a[0])*Math.cos((a[1]+b[1])*Math.PI/360),b[1]-a[1]
);
function lineFeature(coordinates,recent=false){
  return {type:'Feature',properties:{recent},geometry:{type:'LineString',coordinates}};
}
const collection=features=>({type:'FeatureCollection',features});

export function replayModel(records){
  const route=geographicRoute(records),segmentAt=new Map(),pointAt=new Map(route.points.map(p=>[p.index,p]));
  route.segments.forEach((segment,index)=>segment.forEach(point=>segmentAt.set(point.index,index)));
  const end=records.at(-1)?.t??0;
  const completeTrail=collection(route.segments.map(path=>lineFeature(path.map(p=>p.coordinate))));
  function sample(time){
    const index=atOrBefore(records,time,recordTime),row=records[index],point=pointAt.get(index),next=pointAt.get(index+1);
    const segment=segmentAt.get(index),path=route.segments[segment];
    const continuous=path&&segmentAt.get(index+1)===segment&&next.row.t>row.t;
    const coordinate=point&&(time===row.t||continuous||index===records.length-1)
      ?interpolatePoint(point,continuous?next:null,time):null;
    const before=path&&positionAt(path,time-10),after=path&&positionAt(path,time+13);
    const heading=coordinate&&before&&after&&metresBetween(before,after)>2?bearing(before,after):null;
    const turn=heading!==null&&metresBetween(before,coordinate)>7&&metresBetween(coordinate,after)>7
      ?angleDelta(bearing(before,coordinate),bearing(coordinate,after)):0;
    const speed=coordinate&&path?speedAt(path,time):null;
    const chaseCoordinate=coordinate&&path?positionAt(path,time-5):coordinate;
    function recentTrail(){
      if(!path||!coordinate)return collection([]);
      const seconds=clamp(125/Math.max(speed??2.5,1),24,72);
      const startTime=Math.max(path[0].row.t,time-seconds);
      const start=Math.max(0,atOrBefore(path,startTime,pointTime));
      const last=atOrBefore(path,time,pointTime);
      const points=[positionAt(path,startTime),...path.slice(start+1,last+1).map(p=>p.coordinate)];
      if(time>path[last].row.t)points.push(coordinate);
      return collection(points.length>1?[lineFeature(points,true)]:[]);
    }
    return {index,row,coordinate,chaseCoordinate,heading,segment,gap:!coordinate,speed,turn,recentTrail,get trail(){
      if(time>=end)return completeTrail;
      const features=route.segments.flatMap(s=>{
        const last=atOrBefore(s,time,pointTime);
        if(last<0)return [];
        const points=s.slice(0,last+1).map(p=>p.coordinate);
        if(continuous&&s===path&&time>row.t)points.push(coordinate);
        return points.length>1?[lineFeature(points)]:[];
      });
      return collection(features);
    }};
  }
  const lastFixAt=time=>route.points[Math.max(0,atOrBefore(route.points,time,pointTime))];
  return {route,end,duration:replayDuration(records),sample,lastFixAt,available:end>0&&route.segments.length>0&&records.every(r=>Number.isFinite(r.t))&&records.every((r,i)=>!i||r.t>=records[i-1].t)};
}
// Playback time is separate from recorded time: a held overview, a descent,
// elapsed-time traversal (including pauses/gaps), and a quiet finish.
export function replayPhase(seconds,end,duration=REPLAY_SECONDS){
  const t=clamp(seconds,0,duration),finish=duration-1.6;
  if(t<1)return {name:'overview',time:0,descent:0};
  if(t<3.8){const u=(t-1)/2.8;return {name:'descent',time:0,descent:1-(1-u)**3};}
  if(t<finish)return {name:'following',time:travelProgress((t-3.8)/(finish-3.8))*end,descent:1};
  return {name:'finished',time:end,descent:1,outro:clamp((t-finish)/1.6,0,1)};
}
export function followCamera(previous,sample,dt){
  if(!sample.coordinate)return previous;
  const target=sample.chaseCoordinate||sample.coordinate;
  if(!previous)return {center:[...target],bearing:sample.heading??0};
  const u=1-Math.exp(-clamp(dt,0,.1)/.16),step=clamp(angleDelta(previous.bearing,sample.heading??previous.bearing)*u,-65*dt,65*dt);
  return {center:previous.center.map((v,n)=>mix(v,target[n],u)),bearing:previous.bearing+step};
}
export function chaseMotion(previous,sample,dt,{reduced=false,sharpImagery=true}={}){
  if(reduced)return {zoom:14.8,pitch:0,roll:0,phase:0,speed:0,bank:0,energy:0};
  const targetSpeed=clamp(sample.speed??0,0,6);
  const targetBank=clamp((sample.turn??0)/30,-3,3)*clamp(targetSpeed,0,1);
  const easing=previous?1-Math.exp(-clamp(dt,0,.1)/.24):1;
  const speed=mix(previous?.speed??0,targetSpeed,easing);
  const bank=mix(previous?.bank??0,targetBank,easing);
  const energy=clamp((speed-.55)/2.8,0,1);
  // Keep the oscillation in playback time; recorded seconds are heavily compressed.
  const phase=(previous?.phase??0)+clamp(dt,0,.1)*(1+energy*.6)*2*Math.PI;
  const sway=Math.sin(phase)*energy;
  const zoom=sharpImagery?16.3-.36*clamp(speed/5,0,1)-Math.abs(bank)*.035:14.8;
  return {zoom,pitch:62+energy*5+sway*.42,roll:bank+sway*.42,phase,speed,bank,energy};
}
export function replayMetrics(row){
  const clock=s=>`${Math.floor(Math.round(s)/60)}:${String(Math.round(s)%60).padStart(2,'0')}`;
  return {pace:Number.isFinite(row?.speed)&&row.speed>=1000/3600?clock(1000/row.speed):'—',elevation:Number.isFinite(row?.elevation)?String(Math.round(row.elevation)):'—',distance:Number.isFinite(row?.distance)?(row.distance/1000).toFixed(2):'—',elapsed:Number.isFinite(row?.t)?clock(row.t):'—'};
}
