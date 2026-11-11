import {appendGoalEvidence} from './goal-evidence.mjs';
import {zoneShares,zoneAt,aggregateZones} from '../prototypes/zone-model.js';
import { createHash } from 'node:crypto';
import { trainingDataset } from '../prototypes/training-data.mjs';
import { calendarDay } from '../prototypes/calendar-day.js';
export const COACH_EVIDENCE='coaching-evidence-v3';
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
const median=xs=>{const s=[...xs].sort((a,b)=>a-b),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2;};
export function coachingEvidence(library,{anchor=calendarDay(),zoneVersions=[],goalVersions=[]}={}){
 const activities=Object.values(library.activities).filter(a=>!a.synthetic&&a.date>='2026-07-01'),data=trainingDataset(activities,library.feedback,{window:'all',anchor,zoneVersions,goalVersions}),runs=data.sessions.filter(s=>s.run),selected=runs.slice(0,60),facts=[],mapping={};
 const add=(id,label,value,unit,sessionIds=[])=>{if(Number.isFinite(value))facts.push({id,label,value,unit,sessionIds});};
 add('history.runs','Imported runs',runs.length,'count');add('history.distance','Imported running distance',runs.reduce((n,s)=>n+(s.distanceM||0),0),'m');
 const zoneFacts=(distribution,prefix,sessionIds=[])=>{if(!distribution?.knownS)return null;const {bins,knownS,unknownS}=distribution,shares=zoneShares(bins),peak=bins.reduce((a,b)=>b.seconds>a.seconds?b:a);
  add(prefix+'.covered','Measured time covered by personal zones',knownS,'s',sessionIds);add(prefix+'.unclassified','Time without usable samples',unknownS,'s',sessionIds);
  bins.forEach((b,i)=>{add(prefix+'.zone'+b.zone+'Seconds','Time in personal Zone '+b.zone,b.seconds,'s',sessionIds);add(prefix+'.zone'+b.zone+'Share','Share in personal Zone '+b.zone,shares[i],'%',sessionIds);});
  add(prefix+'.dominantZone','Most-used personal zone',peak.zone,'zone',sessionIds);add(prefix+'.dominantShare','Share in most-used zone',shares[peak.zone-1],'%',sessionIds);
  add(prefix+'.upperShare','Share in your upper two configured zones',shares.slice(-2).reduce((a,b)=>a+b,0),'%',sessionIds);
  return {kind:distribution.kind,knownS,unknownS,revision:distribution.settingRevision??null};
 };
 const sessions=selected.map((s,i)=>{
  const ref='s'+String(i+1).padStart(2,'0'),a=library.activities[s.id],answers=library.feedback[s.id]?.answers||{};mapping[ref]=s.id;
  for(const [field,label,unit]of [['distanceM','Recorded distance','m'],['durationS','Recorded duration','s'],['paceSPerKm','Recorded pace','s/km'],['hrBpm','Average heart rate','bpm']])add(ref+'.'+field,label,s[field],unit,[ref]);
  add(ref+'.cadence','Average cadence',a?.cadence,'spm');add(ref+'.elevation','Recorded elevation gain',a?.elevationGain,'m');
  for(const e of s.bestEfforts||[])if([400,1000,2000,5000].includes(e.distanceM))add(ref+'.best'+e.distanceM,'Fastest elapsed '+e.distanceM+' metre segment',e.elapsedS,'s',[ref]);
  if(/^(10|[1-9])$/.test(String(answers.effort||'')))add(ref+'.effort','Reported effort',Number(answers.effort),'/10',[ref]);
  const splits=(a?.splits||[]).filter(x=>x.distanceM===1000||x.displayedDistanceKm===1).map(x=>x.paceSecondsPerKm).filter(Number.isFinite);
  if(splits.length>=2){add(ref+'.openingSplit','Opening full kilometre',splits[0],'s/km',[ref]);add(ref+'.closingSplit','Closing full kilometre',splits.at(-1),'s/km',[ref]);add(ref+'.splitChange','Closing minus opening full-kilometre pace',splits.at(-1)-splits[0],'s/km',[ref]);}
  splits.forEach((v,i)=>add(ref+'.split'+(i+1)+'Pace','Full kilometre '+(i+1)+' pace',v,'s/km',[ref]));
  const personalZones=i<8?['heart','pace'].flatMap(kind=>{const z=s.zones?.[kind],meta=zoneFacts(z,ref+'.zones.'+kind,[ref]);return meta?[{...meta,boundaries:z.boundaries}]:[];}):[];
  return {personalZones,ref,daysAgo:Math.round((Date.parse(anchor)-Date.parse(s.date))/86400000),source:s.sourceKind,environment:s.environment,durationBasis:s.durationBasis,paceBasis:s.paceBasis,limitations:s.flags,fullKmSplitCount:splits.length,breathing:['sentences','phrases','few-words'].includes(answers.breathing)?answers.breathing:null,finish:['plenty','right','limit'].includes(answers.finish)?answers.finish:null,discomfort:['none','mild','affected'].includes(answers.discomfort)?answers.discomfort:null};
 });
 const comparisons=[];
 for(let i=0;i<selected.length;i++){
  const latest=selected[i],meta=sessions[i];if(latest.paceSPerKm===null||latest.distanceM<1000||latest.durationS<300||latest.environment==='indoor')continue;
  const matches=selected.map((s,j)=>({s,j})).filter(({s,j})=>j>i&&s.date<latest.date&&s.paceSPerKm!==null&&s.distanceM>=1000&&s.durationS>=300&&s.sourceKind===latest.sourceKind&&s.environment===latest.environment&&s.paceBasis===latest.paceBasis&&s.durationBasis===latest.durationBasis&&Math.abs(s.distanceM-latest.distanceM)/latest.distanceM<=.2).slice(0,5);
  if(matches.length<2)continue;
  const refs=[meta.ref,...matches.map(x=>sessions[x.j].ref)],prefix='comparison.'+meta.ref;
  const change=latest.paceSPerKm-median(matches.map(x=>x.s.paceSPerKm));
  add(prefix+'.baselinePace','Earlier similar-distance runs: median pace',median(matches.map(x=>x.s.paceSPerKm)),'s/km',refs.slice(1));add(prefix+'.paceChange','Latest minus earlier median pace',change,'s/km',refs);add(prefix+'.paceDifference','Absolute pace difference from earlier median',Math.abs(change),'s/km',refs);add(prefix+'.count','Earlier comparison runs',matches.length,'count',refs.slice(1));
  comparisons.push({ref:prefix,sessionIds:refs,direction:change>0?'slower':change<0?'faster':'unchanged',rule:'Same source, environment and time basis; distance within twenty percent. Effort, weather and terrain are not controlled.'});if(comparisons.length>=6)break;
 }
 for(const [label,start,end]of [['recent',0,7],['previous',7,14]]){const set=runs.filter(s=>{const age=Math.round((Date.parse(anchor)-Date.parse(s.date))/86400000);return age>=start&&age<end;});add('week.'+label+'.runs',label+' seven-day imported runs',set.length,'count');add('week.'+label+'.distance',label+' seven-day imported running distance',set.reduce((n,s)=>n+(s.distanceM||0),0),'m');}
 const earlier=facts.find(f=>f.id==='week.previous.distance')?.value,recent=facts.find(f=>f.id==='week.recent.distance')?.value;
 if(earlier>0){add('week.distanceChange','Recent minus previous seven-day running distance',recent-earlier,'m');add('week.distanceChangePercent','Seven-day running distance change',(recent/earlier-1)*100,'%');}
 add('history.activeDays','Days with a run',new Set(runs.map(s=>s.date)).size,'days');
 const rated=selected.filter(s=>/^(10|[1-9])$/.test(String(library.feedback[s.id]?.answers?.effort||'')));
 add('history.ratedRuns','Runs with a reported effort',rated.length,'count');
 const goalContext={weekly:appendGoalEvidence(data.goals.weekly,'goal.weekly',anchor,add),time:appendGoalEvidence(data.goals.time,'goal.time',anchor,add)};
 const zoneRuns=runs.filter(s=>(Date.parse(anchor)-Date.parse(s.date))/86400000<28),zoneContext=['heart','pace'].flatMap(kind=>{const d=aggregateZones(zoneRuns,kind),meta=zoneFacts(d,'zones.28d.'+kind);return meta?[{...meta,periodDays:28,settingsVersions:d.revisions.length,sampledRuns:d.sampledRuns,uncoveredRuns:d.uncoveredRuns}]:[];});
 const content={goalContext,zoneContext,version:COACH_EVIDENCE,dataset:'personal',scope:'Running record from July 2026. Different sources retain their timing basis.',runsInHistory:runs.length,truncated:runs.length>selected.length,sessions,facts,comparisons,task:{product:'A runner’s personal coach, session explorer and progress journal.',goal:goalContext,availableActions:['run conversationally','adjust opening pace','repeat a familiar distance','review a cited run','complete a post-run check-in'],analysis:'Find what changed, explain why it matters and choose the most useful next action. Rank patterns across the whole record rather than summarising every field.'}};
 const hash=evidenceHash(content);return {content,mapping,hash,legacyHash:hash};
}
