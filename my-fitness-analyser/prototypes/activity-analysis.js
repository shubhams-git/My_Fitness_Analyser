import { recordedRange } from './effort-distribution.js';
export const ACTIVITY_VISUAL_VERSION='activity-instruments-v1';
export const MEASURES={pace:{label:'Pace',unit:'/km'},heart:{label:'Heart rate',unit:'bpm'},cadence:{label:'Cadence',unit:'spm'},elevation:{label:'Elevation',unit:'m'},power:{label:'Power',unit:'W'}};
export function metricValue(row,kind){if(kind==='pace')return Number.isFinite(row.speed)&&row.speed>=1000/3600?1000/row.speed:null;const value=row[{heart:'hr',cadence:'cadence',elevation:'elevation',power:'power'}[kind]];return Number.isFinite(value)&&(kind==='elevation'||kind==='power'&&value>=0||value>0)?value:null;}
export function distanceAxis(records){let previous=-Infinity,valid=0;for(const r of records){if(!Number.isFinite(r.distance))continue;if(r.distance<previous)return false;previous=r.distance;valid++;}return valid>=2&&valid>=records.length*.95&&previous-(records.find(r=>Number.isFinite(r.distance))?.distance||0)>=100;}
export function metricHeadline(activity,kind){
 if(kind==='pace'){const seconds=activity.timer??activity.running??activity.moving;return {label:activity.timer!==null&&activity.timer!==undefined?'Timer pace':activity.running!=null?'Running pace':'Moving pace',value:activity.distance>=10&&Number.isFinite(seconds)?seconds/activity.distance*1000:null};}
 if(kind==='elevation')return {label:'Highest point',value:(activity.records||[]).map(r=>r.elevation).filter(Number.isFinite).reduce((a,b)=>a===null?b:Math.max(a,b),null)};
 const source=kind==='heart'?activity.hr:kind==='cadence'?activity.cadence:null;if(Number.isFinite(source)&&source>0)return {label:'Average '+MEASURES[kind].label.toLowerCase(),value:source};
 let sum=0,seconds=0;for(let i=1;i<(activity.records||[]).length;i++){const a=activity.records[i-1],dt=activity.records[i].t-a.t,v=metricValue(a,kind);if(Number.isFinite(v)&&dt>0&&dt<=15){sum+=v*dt;seconds+=dt;}}
 return {label:'Average '+MEASURES[kind].label.toLowerCase(),value:seconds?sum/seconds:null};
}
export function seriesChart(activity,{kind='pace',axis='distance',full=false,width=630}={}){
 const records=activity.records||[],values=records.map(r=>metricValue(r,kind)).filter(Number.isFinite);if(!values.length)return null;
 axis=axis==='distance'&&distanceAxis(records)?'distance':'time';
 const range=recordedRange(values,{focus:kind==='pace'&&!full}),left=width<=450?56:62,right=width-20,top=25,bottom=220;
 let {min,max}=range;const step=kind==='pace'?(max-min<=120?30:max-min<=360?60:120):kind==='elevation'?(max-min<=30?5:10):max-min<=40?10:20;min=Math.floor(min/step)*step;max=Math.ceil(max/step)*step;if(kind!=='elevation')min=Math.max(kind==='pace'?1:0,min);
 const first=axis==='distance'?records.find(r=>Number.isFinite(r.distance)).distance:records[0].t,last=axis==='distance'?records.findLast(r=>Number.isFinite(r.distance)).distance:records.at(-1).t,end=Math.max(1,last-first);
 const position=r=>axis==='distance'?Number.isFinite(r.distance)?r.distance-first:null:r.t-first;
 const x=r=>left+position(r)/end*(right-left),y=v=>kind==='pace'?top+(v-min)/(max-min)*(bottom-top):bottom-(v-min)/(max-min)*(bottom-top);
 const paths=(value,vertical,allow=()=>true)=>{const segments=[];let points=[];const flush=()=>{if(points.length>1)segments.push(points);points=[];};for(let i=0;i<records.length;i++){const r=records[i],v=value(r);if(i&&(r.t-records[i-1].t>15||r.t<=records[i-1].t))flush();if(!Number.isFinite(v)||position(r)===null||!allow(v)){flush();continue;}points.push([x(r),vertical(v)]);}flush();return {line:segments.map(p=>p.map(([x,y],i)=>`${i?'L':'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')).join(' '),area:segments.map(p=>`M${p[0][0].toFixed(2)},${bottom} `+p.map(([x,y])=>`L${x.toFixed(2)},${y.toFixed(2)}`).join(' ')+` L${p.at(-1)[0].toFixed(2)},${bottom}Z`).join(' ')};};
 const primary=paths(r=>metricValue(r,kind),y),altitudes=records.map(r=>r.elevation).filter(Number.isFinite),lo=altitudes.length?altitudes.reduce((a,b)=>Math.min(a,b),Infinity):null,hi=altitudes.length?altitudes.reduce((a,b)=>Math.max(a,b),-Infinity):null;
 const terrain=kind!=='elevation'&&hi>lo?paths(r=>r.elevation,v=>bottom-(v-lo)/(hi-lo)*(bottom-top)*.8):null;
 const nearest=portion=>{const target=Math.max(0,Math.min(1,portion))*end;let index=0,gap=Infinity;for(let i=0;i<records.length;i++){const p=position(records[i]);if(p!==null&&Math.abs(p-target)<gap){gap=Math.abs(p-target);index=i;}}return index;};
 const timeX=t=>{let a=null,b=null;for(const r of records){if(position(r)===null)continue;if(r.t<=t)a=r;if(r.t>=t){b=r;break;}}a??=b;b??=a;if(!a)return left;const f=b.t===a.t?0:Math.max(0,Math.min(1,(t-a.t)/(b.t-a.t)));return x(a)+(x(b)-x(a))*f;};
 return {...range,timeX,omitted:values.filter(v=>v<min||v>max).length,min,max,left,right,top,bottom,width,end,axis,x,y,position,nearest,d:primary.line,area:primary.area,terrain:terrain?.area||'',terrainMin:lo,terrainMax:hi};
}
// Exact distance boundaries with elapsed sample timing. A gap invalidates its
// split instead of being silently removed. No synthetic laps are stored.
export function kilometreSplits(activity){
 const records=activity.records||[];if(records.length<2||!distanceAxis(records))return [];
 const rows=records.filter(r=>Number.isFinite(r.distance)&&Number.isFinite(r.t));if(rows.length<2)return [];
 const start=rows[0].distance,total=rows.at(-1).distance-start,count=Math.floor(total/1000)+(total%1000>=100?1:0);if(count>100)return [];
 return Array.from({length:count},(_,i)=>{
  const from=start+i*1000,to=Math.min(start+(i+1)*1000,rows.at(-1).distance);let elapsed=0,covered=0,hrTime=0,hrSum=0,startS=null,endS=null,startElevation=null,endElevation=null,invalid=false;
  for(let j=1;j<rows.length;j++){
   const a=rows[j-1],b=rows[j],dd=b.distance-a.distance,dt=b.t-a.t;
   if(dd===0){if(a.distance>=from&&a.distance<to){if(startS===null){startS=a.t;startElevation=Number.isFinite(a.elevation)?a.elevation:null;}elapsed+=Math.max(0,dt);if(dt<=0||dt>15)invalid=true;if(Number.isFinite(a.hr)&&a.hr>0&&dt>0&&dt<=15){hrTime+=dt;hrSum+=a.hr*dt;}}continue;}
   const lo=Math.max(from,a.distance),hi=Math.min(to,b.distance);if(hi<=lo)continue;
   const f0=(lo-a.distance)/dd,f1=(hi-a.distance)/dd,seconds=dt*(f1-f0);covered+=hi-lo;elapsed+=Math.max(0,seconds);if(dt<=0||dt>15||dd/dt>12)invalid=true;
   const elevation=f=>Number.isFinite(a.elevation)&&Number.isFinite(b.elevation)?a.elevation+(b.elevation-a.elevation)*f:null;
   if(startS===null){startS=a.t+dt*f0;startElevation=elevation(f0);}endS=a.t+dt*f1;endElevation=elevation(f1);
   if(Number.isFinite(a.hr)&&a.hr>0&&dt>0&&dt<=15){hrTime+=seconds;hrSum+=a.hr*seconds;}
  }
  const distanceM=to-from,complete=!invalid&&Math.abs(covered-distanceM)<.1;
  return {index:i+1,distanceM,elapsedS:complete?elapsed:null,paceSPerKm:complete?elapsed/distanceM*1000:null,hrBpm:complete&&hrTime>0?hrSum/hrTime:null,elevationChangeM:complete&&startElevation!==null&&endElevation!==null?endElevation-startElevation:null,startS,endS,complete,basis:'elapsed-samples'};
 });
}
export function benchmarkHistory(results){
 const ordered=[...results].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
 return ordered.map(row=>{const previous=ordered.filter(r=>r.date<row.date),prior=previous.length?Math.min(...previous.map(r=>r.elapsedS)):null;return {...row,improvementS:prior!==null&&row.elapsedS<prior?prior-row.elapsedS:null,first:prior===null};});
}
