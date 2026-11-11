import {weightTrend} from './weight-trend.js';
export const GOAL_VERSION='member-goals-v1';
export const GOAL_KINDS=['weekly-distance','run-time','weight'];
export const GOAL_DISTANCES=[1000,5000,10000,21097.5,42195];
const stamp=v=>Date.parse(v+'T12:00Z'),dayS=86400000,round=(v,n=2)=>Math.round(v*10**n)/10**n;
export const shiftDay=(v,n)=>new Date(stamp(v)+n*dayS).toISOString().slice(0,10);
export const weekStart=v=>shiftDay(v,-((new Date(stamp(v)).getUTCDay()+6)%7));
const validDay=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(stamp(v))&&new Date(stamp(v)).toISOString().slice(0,10)===v;
export class GoalError extends Error{constructor(message,field){super(message);this.status=400;this.field=field;}}
export function validateGoal(input,today){
 if(!input||!GOAL_KINDS.includes(input.kind))throw new GoalError('Choose a goal type.','kind');
 const {kind,effectiveFrom,target,deadline,distanceM}=input;
 if(!validDay(effectiveFrom)||effectiveFrom<'2026-07-01'||effectiveFrom>shiftDay(today,366))throw new GoalError('Choose a start date from July 2026 through next year.','effectiveFrom');
 if(kind==='weekly-distance'&&weekStart(effectiveFrom)!==effectiveFrom)throw new GoalError('Weekly goals start on a Monday.','effectiveFrom');
 if(target===null)return {kind,effectiveFrom,target:null,deadline:null,distanceM:null};
 if(!Number.isFinite(target)||target<=0)throw new GoalError('Enter your target.','target');
 if(kind==='weekly-distance'&&(!Number.isInteger(target)||target<100||target>500000))throw new GoalError('Choose a weekly distance from 0.1 to 500 km.','target');
 if(kind==='run-time'&&(!Number.isInteger(target)||target<30||target>86400))throw new GoalError('Enter a target time from 0:30 to 24:00:00.','target');
 if(kind==='weight'&&(target>1000||Math.abs(target*10-Math.round(target*10))>1e-7))throw new GoalError('Enter a target above zero and up to 1,000 kg, with at most one decimal.','target');
 if(kind==='run-time'&&!GOAL_DISTANCES.includes(distanceM))throw new GoalError('Choose a benchmark distance.','distanceM');
 if(kind!=='run-time'&&distanceM!==null)throw new GoalError('Check your goal distance.','distanceM');
 if(deadline!==null&&(!validDay(deadline)||deadline<effectiveFrom||deadline>shiftDay(effectiveFrom,1826)))throw new GoalError('Choose a target date after the start, within five years.','deadline');
 if(kind==='weekly-distance'&&deadline!==null)throw new GoalError('Weekly distance repeats each Monday.','deadline');
 return {kind,effectiveFrom,target,deadline,distanceM};
}
export function goalAt(versions,kind,date){return versions.filter(g=>g.kind===kind&&g.effectiveFrom<=date).toSorted((a,b)=>b.effectiveFrom.localeCompare(a.effectiveFrom)||b.revision-a.revision)[0]||null;}
export function nextGoal(versions,kind,date){return versions.filter(g=>g.kind===kind&&g.effectiveFrom>date).toSorted((a,b)=>a.effectiveFrom.localeCompare(b.effectiveFrom)||b.revision-a.revision)[0]||null;}
const setup=(versions,kind,today)=>{const active=goalAt(versions,kind,today),goal=active||nextGoal(versions,kind,today);return !goal?{kind,status:'unset',goal:null}:goal.effectiveFrom>today?{kind,status:'planned',goal}:goal.target===null?{kind,status:'paused',goal}:{kind,status:'active',goal};};
export function runningGoalProgress(sessions,versions,today){
 const week=weekStart(today),weekly=setup(versions,'weekly-distance',week),time=setup(versions,'run-time',today),runs=sessions.filter(s=>s.run&&s.date<=today);
 if(weekly.status==='active'){const selected=runs.filter(s=>s.date>=week&&s.date<=shiftDay(week,6)),done=Math.round(selected.reduce((n,s)=>n+(Number.isFinite(s.distanceM)?Math.max(0,s.distanceM):0),0));Object.assign(weekly,{done,target:weekly.goal.target,remaining:Math.max(0,weekly.goal.target-done),percent:round(done/weekly.goal.target*100,1),weekFrom:week,weekThrough:shiftDay(week,6),daysLeft:Math.max(0,(stamp(shiftDay(week,6))-stamp(today))/dayS),sessionIds:selected.map(s=>s.id),status:done>=weekly.goal.target?'met':'active'});}
 if(time.status==='active'){
  const candidates=runs.filter(s=>s.date>=time.goal.effectiveFrom).flatMap(s=>(s.bestEfforts||[]).filter(e=>e.distanceM===time.goal.distanceM&&Number.isFinite(e.elapsedS)).map(e=>({seconds:e.elapsedS,id:s.id,date:s.date}))).toSorted((a,b)=>a.seconds-b.seconds||a.date.localeCompare(b.date));
  const best=candidates[0];Object.assign(time,{done:best?.seconds??null,target:time.goal.target,remaining:best?Math.max(0,best.seconds-time.goal.target):null,percent:best?Math.min(100,round(time.goal.target/best.seconds*100,1)):null,sessionIds:best?[best.id]:[],bestDate:best?.date??null,status:best&&best.seconds<=time.goal.target?'met':'active'});
 }
 for(const g of [weekly,time])if(g.goal?.deadline)g.daysLeft=Math.round((stamp(g.goal.deadline)-stamp(today))/dayS);
 return {version:GOAL_VERSION,weekly,time};
}
export function weightGoalProgress(points,versions,today){
 const result=setup(versions,'weight',today);if(result.status!=='active')return result;
 const history=points.filter(p=>p.date<=today),observed=weightTrend(history).observed,current=observed.at(-1),baseline=observed.filter(p=>p.date<=result.goal.effectiveFrom).at(-1)||observed[0];
 if(!current||!baseline)return {...result,current:null,baseline:null,percent:null,remaining:null};
 // Goal comparisons use the journal's displayed 0.1 kg trend resolution.
 const start=round(baseline.trendKg,1),level=round(current.trendKg,1),target=round(result.goal.target,1),change=target-start,done=change<0?start-level:level-start,total=Math.abs(change),met=change<0?level<=target:change>0?level>=target:Math.abs(level-target)<.05;
 return {...result,baseline:start,baselineDate:baseline.date,current:level,measuredDate:current.date,target,remaining:met?0:round(Math.abs(level-target),1),percent:total?Math.max(0,Math.min(100,round(done/total*100,1))):met?100:0,direction:change<0?'decrease':change>0?'increase':'maintain',daysLeft:result.goal.deadline?Math.round((stamp(result.goal.deadline)-stamp(today))/dayS):null,status:met?'met':'active'};
}
export function parseGoalTime(v){if(!/^\d{1,2}:[0-5]\d(?::[0-5]\d)?$/.test(v.trim()))return NaN;return v.split(':').map(Number).reduce((n,x)=>n*60+x,0);}
export const goalTime=v=>{const n=Math.round(v);return n>=3600?Math.floor(n/3600)+':'+String(Math.floor(n%3600/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0'):Math.floor(n/60)+':'+String(n%60).padStart(2,'0');};
