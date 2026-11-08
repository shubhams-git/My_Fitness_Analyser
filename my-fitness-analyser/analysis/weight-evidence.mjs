import { evidenceHash } from './coaching-evidence.mjs';
import { weightTrend,WEIGHT_TREND_VERSION } from '../prototypes/weight-trend.js';
export const WEIGHT_EVIDENCE='weight-evidence-v2';
const day=d=>Date.parse(d+'T12:00Z')/86400000,round=n=>Math.round(n*100)/100;
const median=v=>{const a=v.toSorted((x,y)=>x-y),m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;};
export function weightEvidence(dataset){
 const history=dataset.points.filter(p=>p.date<=(dataset.today||dataset.anchor)),latest=history.at(-1),end=latest?day(latest.date):0;
 const selected=history.filter(p=>day(p.date)>=end-89),trend=weightTrend(history),levels=new Map(trend.observed.map(p=>[p.date,p.trendKg]));
 const facts=[];const add=(id,label,value,unit)=>{if(Number.isFinite(value))facts.push({id,label,value:round(value),unit});};
 add('history.days','Recorded days in this period',selected.length,'days');
 add('history.readings','Individual weigh-ins in this period',selected.reduce((n,p)=>n+p.readings,0),'readings');
 if(latest){
  const first=selected[0],lastLevel=levels.get(latest.date),firstLevel=levels.get(first.date);
  add('period.span','Recorded period length',end-day(first.date),'days');
  add('latest.age','Days since the last recorded weigh-in',Math.max(0,day(dataset.today||dataset.anchor)-end),'days');
  add('latest.scale','Latest daily scale value',latest.kg,'kg');add('latest.trend','Latest smoothed trend',lastLevel,'kg');
  add('latest.vsTrend','Latest scale reading minus smoothed trend',latest.kg-lastLevel,'kg');
  const previous=history.at(-2);if(previous){add('latest.change','Latest scale reading minus previous recorded day',latest.kg-previous.kg,'kg');add('latest.gap','Days between the two latest recorded days',end-day(previous.date),'days');}
  add('period.trendChange','Signed trend change across recorded period',lastLevel-firstLevel,'kg');
  add('period.trendDifference','Absolute trend change across recorded period',Math.abs(lastLevel-firstLevel),'kg');
  const recent=selected.filter(p=>day(p.date)>=end-27),span=end-day(recent[0].date);
  add('recent.days','Recorded days in last recorded 28-day period',recent.length,'days');add('recent.span','Span covered by those readings',span,'days');
  const slopes=[];for(let i=0;i<recent.length;i++)for(let j=i+1;j<recent.length;j++){const gap=day(recent[j].date)-day(recent[i].date);if(gap>=7)slopes.push((recent[j].kg-recent[i].kg)*7/gap);}
  if(recent.length>=4&&span>=14&&slopes.length){const rate=median(slopes);add('recent.weeklyRate','Signed robust weekly scale trend',rate,'kg/week');add('recent.weeklyMagnitude','Absolute robust weekly scale trend',Math.abs(rate),'kg/week');}
  const residuals=recent.map(p=>Math.abs(p.kg-levels.get(p.date)));add('recent.deviation','Median absolute scale-to-trend difference',median(residuals),'kg');
  add('recent.range','Observed daily scale range',Math.max(...recent.map(p=>p.kg))-Math.min(...recent.map(p=>p.kg)),'kg');
 }
 const content={version:WEIGHT_EVIDENCE,trendMethod:WEIGHT_TREND_VERSION,scope:'Daily scale observations, smoothed trend and recent changes. No weight goal supplied.',facts,observations:selected.map(p=>({daysBeforeLatest:end-day(p.date),scaleKg:round(p.kg),trendKg:round(levels.get(p.date)),readings:p.readings})),rules:{interpolatedDaysAreNotObservations:true,weeklyRate:'Median of observed daily-value pair slopes at least seven days apart; requires four recorded days spanning fourteen days.',trendDirection:latest?Math.abs(levels.get(latest.date)-levels.get(selected[0].date))<.1?'level':levels.get(latest.date)<levels.get(selected[0].date)?'falling':'rising':'unavailable',stale:latest?day(dataset.today||dataset.anchor)-end>14:true}};
 return {hash:evidenceHash(content),content};
}
