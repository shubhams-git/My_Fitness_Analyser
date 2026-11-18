import { geographicRoute,routeFeatures } from './route-geometry.js';

export const REPLAY_VERSION='satellite-replay-v6';
export const REPLAY_SECONDS=22.7;
const descentEnd=3.8, finishHold=1.6;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const angleDelta=(from,to)=>((to-from+540)%360+360)%360-180;
export function bearing(a,b){const rad=Math.PI/180,p=a[1]*rad,q=b[1]*rad,d=(b[0]-a[0])*rad;return Math.atan2(Math.sin(d)*Math.cos(q),Math.cos(p)*Math.sin(q)-Math.sin(p)*Math.cos(q)*Math.cos(d))/rad;}
const mix=(a,b,u)=>a+(b-a)*u;
const mixPoint=(a,b,u)=>[mix(a[0],b[0],u),mix(a[1],b[1],u)];
const smooth=u=>u>.5?1-smooth(1-u):u*u*u*(10+u*(-15+6*u));
export function replayDuration(records){
  const distances=records.map(r=>r.distance).filter(Number.isFinite);
  const km=distances.length>1?Math.max(0,distances.at(-1)-distances[0])/1000:0;
  return Math.round(Math.min(20+1.2*Math.sqrt(km),24.5)*10)/10;
}
export function travelProgress(u){u=clamp(u,0,1);const ramp=.1;if(u<ramp)return u*u/(2*ramp*(1-ramp));if(u>1-ramp)return 1-(1-u)**2/(2*ramp*(1-ramp));return (u-ramp/2)/(1-ramp);}
// Start widening during the last part of traversal, then settle on the whole route.
export function replayPullback(seconds,duration=REPLAY_SECONDS){
 const start=descentEnd+(duration-finishHold-descentEnd)*.84;
 return smooth(clamp((seconds-start)/(duration-.65-start),0,1));
}
export function replayFraming(height,hud,footer){
 const total=hud+footer+32,scale=Math.min(1,Math.max(0,height-80)/Math.max(1,total));
 const top=(hud+16)*scale,bottom=(footer+16)*scale;
 return {fit:{top,bottom,left:24,right:24},chase:{top:Math.max(0,height-top-bottom)*.16,bottom:0,left:0,right:0}};
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
const metresBetween=(a,b)=>111195*Math.hypot(
  (b[0]-a[0])*Math.cos((a[1]+b[1])*Math.PI/360),b[1]-a[1]
);
export function replayModel(records){
  const route=geographicRoute(records),segmentAt=new Map(),pointAt=new Map(route.points.map(p=>[p.index,p]));
  route.segments.forEach((segment,index)=>segment.forEach(point=>segmentAt.set(point.index,index)));
  const end=records.at(-1)?.t??0;
  const completeTrail=routeFeatures(route);
  function sample(time){
    const index=atOrBefore(records,time,recordTime),row=records[index],point=pointAt.get(index),next=pointAt.get(index+1);
    const segment=segmentAt.get(index),path=route.segments[segment];
    const continuous=path&&segmentAt.get(index+1)===segment&&next.row.t>row.t;
    const coordinate=point&&(time===row.t||continuous||index===records.length-1)
      ?interpolatePoint(point,continuous?next:null,time):null;
    return {index,row,coordinate,segment,gap:!coordinate};
  }
  const lastFixAt=time=>route.points[Math.max(0,atOrBefore(route.points,time,pointTime))];
  function wake(time,fix,seconds){
    const path=route.segments[fix.segment];
    if(!path||!fix.coordinate)return [];
    const startTime=Math.max(path[0].row.t,time-seconds);
    const first=atOrBefore(path,startTime,pointTime)+1,last=atOrBefore(path,time,pointTime);
    const points=[positionAt(path,startTime)];
    // Retain recorded corners for normal streams; bound projections on dense imports.
    const stride=Math.max(1,Math.ceil((last-first+1)/48));
    for(let index=first;index<=last;index+=stride)points.push(path[index].coordinate);
    points.push(fix.coordinate);
    return points;
  }
  return {route,completeTrail,end,duration:replayDuration(records),sample,wake,lastFixAt,available:end>0&&route.segments.length>0&&records.every(r=>Number.isFinite(r.t))&&records.every((r,i)=>!i||r.t>=records[i-1].t)};
}
export function replayPhase(seconds,end,duration=REPLAY_SECONDS){
  const t=clamp(seconds,0,duration),finish=duration-finishHold;
  if(t<1.25)return {name:'overview',time:0};
  if(t<descentEnd)return {name:'descent',time:0};
  if(t<finish)return {name:'following',time:travelProgress((t-descentEnd)/(finish-descentEnd))*end,followSeconds:t-descentEnd};
  return {name:'finished',time:end};
}

// Sample the camera in playback time so a pause, seek or dropped frame always
// produces the same shot. The runner itself still uses the original GPS fixes.
export function replayFlight(model){
  const fps=24, first=model.route.points[0].coordinate;
  const count=Math.ceil((model.duration-finishHold-descentEnd)*fps);
  const fixes=Array.from({length:count+1},(_,i)=>{
    const time=replayPhase(descentEnd+i/fps,model.end,model.duration).time;
    return model.sample(time).coordinate??model.lastFixAt(time).coordinate;
  });
  const fix=i=>fixes[clamp(i,0,count)];
  const initialDirection=fixes.find((point,i)=>i<=2*fps&&metresBetween(first,point)>14);
  const initialBearing=initialDirection?bearing(first,initialDirection):0;
  let heading=initialBearing;
  const frames=fixes.map((_,i)=>{
    const center=[0,0];
    const radius=12;
    for(let offset=-radius;offset<=radius;offset++){
      const target=fix(i-2+offset);
      const weight=(radius+1-Math.abs(offset))/(radius+1)**2;
      center[0]+=target[0]*weight;
      center[1]+=target[1]*weight;
    }
    const behind=fix(i-18),ahead=fix(i+22);
    const delta=metresBetween(behind,ahead)>14?angleDelta(heading,bearing(behind,ahead)):0;
    if(i)heading+=clamp(delta*.055,-25/fps,25/fps);
    return {center:mixPoint(first,center,smooth(clamp(i/14,0,1))),bearing:heading};
  });
  const openingBearing=initialBearing-44,closingBearing=angleDelta(0,heading+22);
  function cameraAt(seconds,framing,{reduced=false,sharpImagery=true}={}){
    const {opening,closing,fit,chase}=framing;
    if(reduced)return {...fit,pitch:0};
    const intro=clamp(seconds/descentEnd,0,1);
    const approach=smooth(clamp((seconds-.45)/(descentEnd-.45),0,1));
    const turn=smooth(intro);
    const index=clamp((seconds-descentEnd)*fps,0,count),start=Math.floor(index),u=index-start;
    const a=frames[start],b=frames[Math.min(count,start+1)],exit=replayPullback(seconds,model.duration);
    const followCenter=mixPoint(a.center,b.center,u);
    const followBearing=mix(a.bearing,b.bearing,u);
    const chaseZoom=Math.min(sharpImagery?15.6:14.45,fit.zoom+2.15);
    return {
      center:mixPoint(mixPoint(opening.center,followCenter,approach),closing.center,exit),
      bearing:mix(openingBearing,followBearing,turn)+angleDelta(followBearing,closingBearing)*exit,
      zoom:mix(mix(opening.zoom-.32,chaseZoom,approach),closing.zoom,exit),
      pitch:mix(mix(12,54,approach),0,exit),
      padding:{top:chase.top*approach*(1-exit),bottom:0,left:0,right:0}
    };
  }
  return {cameraAt,openingBearing,closingBearing};
}
export function replayMetrics(row){
  const clock=s=>`${Math.floor(Math.round(s)/60)}:${String(Math.round(s)%60).padStart(2,'0')}`;
  return {pace:Number.isFinite(row?.speed)&&row.speed>=1000/3600?clock(1000/row.speed):'—',elevation:Number.isFinite(row?.elevation)?String(Math.round(row.elevation)):'—',distance:Number.isFinite(row?.distance)?(row.distance/1000).toFixed(2):'—',elapsed:Number.isFinite(row?.t)?clock(row.t):'—'};
}
