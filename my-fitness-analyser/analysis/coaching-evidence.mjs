import {appendGoalEvidence} from './goal-evidence.mjs';
import {zoneShares,zoneAt,aggregateZones} from '../prototypes/zone-model.js';
import { createHash } from 'node:crypto';
import { trainingDataset } from '../prototypes/training-data.mjs';
import { comparableRunPaces,recordedTraining } from '../prototypes/progress-model.js';
import { calendarDay } from '../prototypes/calendar-day.js';
import { kilometreSplits } from '../prototypes/activity-analysis.js';
export const COACH_EVIDENCE='coaching-evidence-v4';
export function canonicalJson(value){if(Array.isArray(value))return '['+value.map(canonicalJson).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).filter(k=>value[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+canonicalJson(value[k])).join(',')+'}';return JSON.stringify(value);}
export const evidenceHash=content=>createHash('sha256').update(canonicalJson(content)).digest('hex');
// Reconstruct the original v1 serialization for already-published reports.
// JSONB preserves array order but not object key order. Never discard extra fields.
export function legacyEvidenceHash(content){
 const ordered=(value,keys)=>{if(!value||Object.keys(value).length!==keys.length||keys.some(k=>!Object.hasOwn(value,k)))throw new Error('Unknown legacy evidence shape.');return Object.fromEntries(keys.map(k=>[k,value[k]]));};
 const original=ordered(content,['version','dataset','scope','runsInHistory','truncated','sessions','facts','comparisons']);
 original.sessions=content.sessions.map(s=>ordered(s,['ref','daysAgo','source','environment','durationBasis','paceBasis','limitations','breathing','finish']));
 original.facts=content.facts.map(f=>ordered(f,['id','label','value','unit','sessionIds']));
 original.comparisons=content.comparisons.map(c=>ordered(c,['ref','sessionIds','direction','rule']));
 return createHash('sha256').update(JSON.stringify(original)).digest('hex');
}
function workoutContext(sessions,journal,anchor){
 const relativeDay=date=>Math.round((Date.parse(anchor)-Date.parse(date))/86400000);
 const recent=date=>Number.isFinite(relativeDay(date))&&relativeDay(date)>=0&&relativeDay(date)<14;
 const byDay=new Map();
 const add=(date,kind,seconds,focus=null)=>{
  if(!recent(date))return;
  const daysAgo=relativeDay(date),key=daysAgo+':'+kind;
  const row=byDay.get(key)||{daysAgo,kind,sessions:0,durationS:null,focuses:[]};
  row.sessions++;
  if(Number.isFinite(seconds)&&seconds>0)row.durationS=(row.durationS??0)+Math.round(seconds);
  if(['Push','Pull','Legs','Upper body','Lower body','Full body','Strength'].includes(focus)&&!row.focuses.includes(focus))row.focuses.push(focus);
  byDay.set(key,row);
 };
 const activityStrengthDays=new Set(sessions.filter(s=>s.kind==='strength').map(s=>s.date));
 const journalDays=new Map();
 for(const row of journal.filter(r=>recent(r.date_key)&&!r.deleted)){
  const rows=journalDays.get(row.date_key)||[];
  rows.push(row);journalDays.set(row.date_key,rows);
 }
 // Same-day watch and journal strength can describe the same workout. Use
 // journal entries for that day and keep both original records in the library.
 for(const [date,rows] of journalDays)for(const row of rows)add(date,'strength',row.minutes==null?null:row.minutes*60,row.focus);
 for(const s of sessions){
  if(s.run||s.sourceKind==='screenshot'||s.kind==='strength'&&journalDays.has(s.date))continue;
  add(s.date,s.kind,s.durationS);
 }
 return {windowDays:14,overlappingStrengthDays:[...journalDays.keys()].filter(date=>activityStrengthDays.has(date)).length,
  days:[...byDay.values()].sort((a,b)=>a.daysAgo-b.daysAgo||a.kind.localeCompare(b.kind)).map(row=>({...row,focuses:row.focuses.sort()}))};
}
export function coachingEvidence(library,{anchor=calendarDay(),zoneVersions=[],goalVersions=[],strengthEntries=null}={}){
 const activities=Object.values(library.activities).filter(a=>!a.synthetic&&a.date>='2026-07-01'),wholeTraining=strengthEntries!==null;
 const data=trainingDataset(activities,library.feedback,{window:'all',anchor,zoneVersions,goalVersions,garminGoals:wholeTraining}),runs=data.sessions.filter(s=>s.run&&(!wholeTraining||s.garminOutdoor)),selected=runs.slice(0,wholeTraining?12:60),facts=[],mapping={};
 const add=(id,label,value,unit,sessionIds=[])=>{if(Number.isFinite(value))facts.push({id,label,value,unit,sessionIds});};
 add('history.runs','Imported runs',runs.length,'count');
 if(runs.some(s=>s.distanceM!==null))add('history.distance','Imported running distance',runs.reduce((n,s)=>n+(s.distanceM??0),0),'m');
 const zoneFacts=(distribution,prefix,sessionIds=[])=>{if(!distribution?.knownS)return null;const {bins,knownS,unknownS}=distribution,shares=zoneShares(bins),peak=bins.reduce((a,b)=>b.seconds>a.seconds?b:a);
  add(prefix+'.covered','Measured time covered by personal zones',knownS,'s',sessionIds);add(prefix+'.unclassified','Time without usable samples',unknownS,'s',sessionIds);
  bins.forEach((b,i)=>{add(prefix+'.zone'+b.zone+'Seconds','Time in personal Zone '+b.zone,b.seconds,'s',sessionIds);add(prefix+'.zone'+b.zone+'Share','Share in personal Zone '+b.zone,shares[i],'%',sessionIds);});
  add(prefix+'.dominantZone','Most-used personal zone',peak.zone,'zone',sessionIds);add(prefix+'.dominantShare','Share in most-used zone',shares[peak.zone-1],'%',sessionIds);
  add(prefix+'.upperShare','Share in your upper two configured zones',shares.slice(-2).reduce((a,b)=>a+b,0),'%',sessionIds);
  return {kind:distribution.kind,knownS,unknownS,revision:distribution.settingRevision??null};
 };
 const sessions=selected.map((s,i)=>{
  const ref='s'+String(i+1).padStart(2,'0'),a=library.activities[s.id]||activities.find(a=>a.id===s.id),answers=library.feedback[s.id]?.answers||{};mapping[ref]=s.id;
  for(const [field,label,unit]of [['distanceM','Recorded distance','m'],['durationS','Recorded duration','s'],['paceSPerKm','Recorded pace','s/km'],['hrBpm','Average heart rate','bpm']])add(ref+'.'+field,label,s[field],unit,[ref]);
  add(ref+'.cadence','Average cadence',a?.cadence,'spm');add(ref+'.elevation','Recorded elevation gain',a?.elevationGain,'m');
  add(ref+'.power','Recorded average running power',a?.avgPower??a?.provider?.detail?.summaryDTO?.avgPower,'W',[ref]);
  for(const e of s.bestEfforts||[])if([400,1000,2000,5000].includes(e.distanceM))add(ref+'.best'+e.distanceM,'Fastest elapsed '+e.distanceM+' metre segment',e.elapsedS,'s',[ref]);
  add(ref+'.effort','Reported effort',s.effortRating,'/10',[ref]);
  const splits=(s.recordCount?kilometreSplits(a).filter(x=>x.complete).map(x=>x.paceSPerKm):
   (a.splits||[]).filter(x=>x.distanceM===1000||x.displayedDistanceKm===1).map(x=>x.paceSecondsPerKm)).filter(Number.isFinite);
  if(splits.length>=2){add(ref+'.openingSplit','Opening full kilometre',splits[0],'s/km',[ref]);add(ref+'.closingSplit','Closing full kilometre',splits.at(-1),'s/km',[ref]);add(ref+'.splitChange','Closing minus opening full-kilometre pace',splits.at(-1)-splits[0],'s/km',[ref]);}
  splits.slice(0,wholeTraining?16:splits.length).forEach((v,i)=>add(ref+'.split'+(i+1)+'Pace','Full kilometre '+(i+1)+' pace',v,'s/km',[ref]));
  const personalZones=i<8?['heart','pace'].flatMap(kind=>{const z=s.zones?.[kind],meta=zoneFacts(z,ref+'.zones.'+kind,[ref]);return meta?[{...meta,boundaries:z.boundaries}]:[];}):[];
  return {personalZones,ref,daysAgo:Math.round((Date.parse(anchor)-Date.parse(s.date))/86400000),source:s.sourceKind,environment:s.environment,durationBasis:s.durationBasis,paceBasis:s.paceBasis,limitations:s.flags,fullKmSplitCount:splits.length,breathing:['sentences','phrases','few-words'].includes(answers.breathing)?answers.breathing:null,finish:['plenty','right','limit'].includes(answers.finish)?answers.finish:null,discomfort:s.discomfort};
 });
 const refsById=new Map(Object.entries(mapping).map(([ref,id])=>[id,ref]));
 const age=date=>(Date.parse(anchor)-Date.parse(date))/86400000;
 const affected=data.sessions.filter(s=>s.discomfort==='affected'&&(age(s.date)<14||s.id===runs[0]?.id));
 const affectedStrength=(strengthEntries||[]).filter(s=>!s.deleted&&s.discomfort==='affected'&&age(s.date_key)>=0&&age(s.date_key)<14);
 if(affected.length||affectedStrength.length)add('safety.affected','Check-ins reporting that discomfort affected a workout',affected.length+affectedStrength.length,'count',affected.map(s=>refsById.get(s.id)).filter(Boolean));
 const comparisons=[];
 for(const {id,earlierIds,baseline,change} of comparableRunPaces(selected,{allowScreenshot:!wholeTraining})){
  const refs=[refsById.get(id),...earlierIds.map(id=>refsById.get(id))],prefix='comparison.'+refs[0];
  add(prefix+'.baselinePace','Earlier similar-distance runs: median pace',baseline,'s/km',refs.slice(1));add(prefix+'.paceChange','Recorded pace minus earlier median pace',change,'s/km',refs);add(prefix+'.paceDifference','Absolute pace difference from earlier median',Math.abs(change),'s/km',refs);add(prefix+'.count','Earlier comparison runs',earlierIds.length,'count',refs.slice(1));
  comparisons.push({ref:prefix,sessionIds:refs,direction:change>0?'slower':change<0?'faster':'unchanged',rule:'Same source, run type, environment and time basis; distance within twenty percent. Effort, weather and terrain are not controlled.'});
 }
 const volume=wholeTraining?recordedTraining(runs,anchor):data.summary;
 for(const {days,recent,previous} of volume.periods){
  const prefix=days===7?'week':'volume.28d';
  for(const [label,p] of Object.entries({recent,previous})){
   const key=prefix+'.'+label,period=label+' '+days+'-day';
   add(key+'.runs',period+' recorded runs',p.runs,'count');
   add(key+'.activeDays',period+' days with recorded runs',p.days,'days');
   add(key+'.distance',period+' recorded running distance',p.distance.value,'m');
   add(key+'.distanceCoverage',period+' runs with distance',p.distance.count,'count');
   add(key+'.duration',period+' recorded running time',p.duration.value,'s');
   add(key+'.durationCoverage',period+' runs with time',p.duration.count,'count');
  }
  if(days===7&&previous.distance.value>0&&recent.distance.count>0&&recent.distance.count===recent.runs&&previous.distance.count===previous.runs){
   add('week.distanceChange','Recent minus previous recorded seven-day running distance',recent.distance.value-previous.distance.value,'m');
   add('week.distanceChangePercent','Recorded seven-day running distance change',(recent.distance.value/previous.distance.value-1)*100,'%');
  }
 }
 add('history.activeDays','Days with a run',new Set(runs.map(s=>s.date)).size,'days');
 const rated=selected.filter(s=>s.effortRating!==null);
 add('history.ratedRuns','Runs with a reported effort',rated.length,'count');
 const activeGoal=(progress,prefix)=>['active','met'].includes(progress.status)?appendGoalEvidence(progress,prefix,anchor,add):null;
 const goalContext={weekly:activeGoal(data.goals.weekly,'goal.weekly'),time:activeGoal(data.goals.time,'goal.time')};
 const zoneRuns=runs.filter(s=>(Date.parse(anchor)-Date.parse(s.date))/86400000<28),zoneContext=['heart','pace'].flatMap(kind=>{const d=aggregateZones(zoneRuns,kind),meta=zoneFacts(d,'zones.28d.'+kind);return meta?[{...meta,periodDays:28,settingsVersions:d.revisions.length,sampledRuns:d.sampledRuns,uncoveredRuns:d.uncoveredRuns}]:[];});
 const content={goalContext,zoneContext,version:COACH_EVIDENCE,dataset:'personal',scope:'Running record from July 2026. Different sources retain their timing basis.',runsInHistory:runs.length,truncated:runs.length>selected.length,sessions,facts,comparisons,task:{product:'A runner’s personal coach, session explorer and progress journal.',goal:goalContext,availableActions:['run conversationally','adjust opening pace','repeat a familiar distance','review a cited run','complete a post-run check-in'],analysis:'Find what changed, explain why it matters and choose the most useful next action. Rank patterns across the whole record rather than summarising every field.'}};
 if(wholeTraining){
  const workouts=workoutContext(data.sessions,strengthEntries,anchor);
  content.scope='Outdoor Garmin runs for performance. Other recorded workouts provide context for the next run.';
  content.workouts=workouts;
  for(const kind of new Set(workouts.days.map(row=>row.kind))){
   const rows=workouts.days.filter(row=>row.kind===kind),key=kind.replaceAll('-','_');
   add('workouts.'+key+'.count','Recent '+kind+' sessions',rows.reduce((sum,row)=>sum+row.sessions,0),'count');
  }
 }
 const hash=evidenceHash(content);return {content,mapping,hash,legacyHash:hash};
}
