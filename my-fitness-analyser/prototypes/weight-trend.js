export const WEIGHT_TREND_VERSION='calendar-ema7-v1';
const DAY=86400000,stamp=d=>Date.parse(d+'T12:00:00Z');
export function weightTrend(daily,{window='all',anchor=daily.at(-1)?.date}={}){
 const observed=daily.filter(p=>Number.isFinite(p.kg)&&p.kg>0&&p.date<=anchor).toSorted((a,b)=>a.date.localeCompare(b.date));
 if(!observed.length)return {version:WEIGHT_TREND_VERSION,points:[],observed:[],latest:null,change:null};
 let last,level;
 const anchors=observed.map(p=>{
  const elapsed=last?(stamp(p.date)-stamp(last))/DAY:0;
  level=level===undefined?p.kg:level+(1-Math.pow(2,-elapsed/7))*(p.kg-level);last=p.date;
  return {...p,trendKg:level};
 });
 const points=[];
 for(let i=0;i<anchors.length;i++){
  const a=anchors[i],b=anchors[i+1];points.push({...a,estimated:false});
  if(b){const span=(stamp(b.date)-stamp(a.date))/DAY;
   for(let d=1;d<span;d++)points.push({date:new Date(stamp(a.date)+d*DAY).toISOString().slice(0,10),kg:null,readings:0,trendKg:a.trendKg+(b.trendKg-a.trendKg)*d/span,estimated:true});
  }
 }
 const lastObserved=anchors.at(-1);
 // No new observation means no new evidence: carry the last level, rather than
 // extrapolating a slope. The chart draws this held portion dashed.
 for(let d=stamp(lastObserved.date)+DAY;d<=stamp(anchor);d+=DAY)points.push({date:new Date(d).toISOString().slice(0,10),kg:null,readings:0,trendKg:lastObserved.trendKg,estimated:true,held:true,heldSince:lastObserved.date});
 const from=window==='all'?-Infinity:stamp(anchor)-(window==='30'?29:89)*DAY;
 const selected=points.filter(p=>stamp(p.date)>=from&&stamp(p.date)<=stamp(anchor));
 return {version:WEIGHT_TREND_VERSION,points:selected,observed:anchors.filter(p=>stamp(p.date)>=from&&stamp(p.date)<=stamp(anchor)),lastObservedDate:lastObserved.date,latest:selected.at(-1)||null,change:selected.length>1?selected.at(-1).trendKg-selected[0].trendKg:null};
}
