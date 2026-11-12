import {activityKind,garminId,isGarminOutdoorRun,isScreenshot,runTerrain} from './activity-kind.js';
import {runningGoalProgress} from './goal-model.js';
import { activityZones } from './zone-model.js';
import { createHash } from 'node:crypto';
import { demonstration,timeBlocks,observation,ANALYSIS_VERSION } from './data.mjs';
import { bestEfforts, PROGRESS_VERSION, recordedTraining } from './progress-model.js';
import { calendarDay } from './calendar-day.js';
import { matchedRoutes } from '../analysis/route-matches.mjs';

export const TRAINING_VERSION='training-evidence-v1';
const number=x=>Number.isFinite(x)?x:null;
const day=86400000;
const dateMs=date=>Date.parse(date+'T12:00:00Z');
const monday=date=>{const d=new Date(date);d.setUTCHours(0,0,0,0);d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10);};
const identities=a=>['id:'+a.id,...(a.sourceHash?['fit:'+a.sourceHash]:[]),...(garminId(a)?['garmin:'+garminId(a)]:[]),...(a.legacyAliases||[]).map(id=>'id:'+id)];
export function mergeTrainingActivities(seeds,saved){const map=new Map(seeds.filter(a=>!a.synthetic).map(a=>[a.id,a]));for(const a of saved){const keys=identities(a);for(const [id,b]of map)if(identities(b).some(k=>keys.includes(k)))map.delete(id);map.set(a.id,a);}return [...map.values()];}

export function trainingDataset(activities,feedback={}, {window='90',anchor=calendarDay(),synthetic=false,outdoorGarminOnly=false,includeImportedRuns=false,garminGoals=false,zoneVersions=[],goalVersions=[]}={}){
  const seen=new Map(),selected=new Set(),aliases=new Map();let sessions=[];
  const eligible=a=>!outdoorGarminOnly||isGarminOutdoorRun(a)||(includeImportedRuns&&isScreenshot(a)&&activityKind(a)==='run');
  const quality=a=>4*Boolean(a.canonical)+2*Boolean(a.records?.length)+Number(Boolean(garminId(a)));
  const candidates=activities.filter(a=>Boolean(a.synthetic)===synthetic&&Number.isFinite(dateMs(a.date))&&a.date<=anchor)
    .sort((a,b)=>quality(b)-quality(a)||a.id.localeCompare(b.id));
  for(const a of candidates){
    const keys=identities(a),matches=[...new Set(keys.map(k=>seen.get(k)).filter(Boolean))];
    const winner=matches.sort((a,b)=>quality(b)-quality(a)||a.id.localeCompare(b.id))[0]||a;
    if(!matches.length){selected.add(a);aliases.set(a,new Set());}
    for(const match of matches)if(match!==winner){
      for(const id of aliases.get(match))aliases.get(winner).add(id);
      for(const [key,value] of seen)if(value===match)seen.set(key,winner);
      selected.delete(match);aliases.delete(match);
    }
    for(const key of keys){seen.set(key,winner);if(key.startsWith('id:'))aliases.get(winner).add(key.slice(3));}
  }
  const sorted=[...selected].sort((a,b)=>b.date.localeCompare(a.date)||(b.startInstant||b.time||'').localeCompare(a.startInstant||a.time||'')||a.id.localeCompare(b.id));
  for(const a of sorted){
    const screenshot=isScreenshot(a),garminOutdoor=isGarminOutdoorRun(a),records=screenshot?[]:(a.records||[]),activity={...a,records};
    const gps=records.filter(r=>Number.isFinite(r.lat)&&Number.isFinite(r.lon)).length;
    const kind=activityKind(a),providerKind=a.provider?.detail?.activityTypeDTO?.typeKey||'';
    const environment=['treadmill','stationary-bike','elliptical','stairs'].includes(kind)||/indoor/.test(providerKind)?'indoor':gps||garminOutdoor?'outdoor':'unknown';
    const basis=['timer','running','moving','elapsed'].find(k=>Number.isFinite(a[k])&&a[k]>0)||'unavailable',duration=basis==='unavailable'?null:a[basis];
    const distanceM=Number.isFinite(a.distance)&&a.distance>=0?a.distance:null;
    const rawPace=a.displayedPace??(distanceM>=10&&duration>0?duration/distanceM*1000:null),pace=['run','treadmill','walk'].includes(kind)&&distanceM>=10&&rawPace>0&&rawPace<=3600?rawPace:null;
    const movingFraction=a.timer>0&&a.moving!==null&&a.moving!==undefined?a.moving/a.timer:null;
    const run=kind==='run',terrain=run?runTerrain(a):null,flags=[];
    if(distanceM!==null&&distanceM<10&&run)flags.push('insufficient_distance');
    if(!gps)flags.push('no_gps');if(a.hr==null)flags.push('no_hr');
    if(movingFraction!==null&&movingFraction<.8)flags.push('different_time_bases');
    if(screenshot)flags.push('screenshot_summary');
    const comparable=run&&!screenshot&&gps>0&&environment==='outdoor'&&pace!==null&&distanceM>=1000&&duration>=600&&basis==='timer'&&(movingFraction===null||movingFraction>=.8);
    const spark=records.filter(r=>Number.isFinite(r.hr));const stride=Math.max(1,Math.ceil(spark.length/48));
    const checkin=feedback[a.id]??[...aliases.get(a)].map(id=>feedback[id]).find(Boolean);
    const effort=Number(checkin?.answers?.effort),effortRating=Number.isInteger(effort)&&effort>=1&&effort<=10?effort:null;
    sessions.push({zones:run&&!screenshot?activityZones(activity,zoneVersions):null,id:a.id,title:a.title,date:a.date,sport:a.sport,kind,terrain,source:a.source,sourceKind:screenshot?'screenshot':garminId(a)||['Garmin Connect','garmin'].includes(a.source)?'garmin':a.sourceFile==='Stored source summary'?'summary':'fit',environment,run,garminOutdoor,distanceM,durationS:duration,durationBasis:basis,paceSPerKm:pace,paceBasis:a.displayedPace!=null?'displayed':basis,hrBpm:number(a.hr),gpsSamples:gps,recordCount:records.length,movingFraction,comparable,flags,bestEfforts:run&&!screenshot?bestEfforts(activity):[],effortRating,discomfort:['none','mild','affected'].includes(checkin?.answers?.discomfort)?checkin.answers.discomfort:null,checkinComplete:checkin?.complete===true,sparkline:spark.filter((_,i)=>i%stride===0).map(r=>({t:r.t,value:r.hr}))});
  }
  if(outdoorGarminOnly){const ids=new Set(sorted.filter(eligible).map(a=>a.id));sessions=sessions.filter(s=>ids.has(s.id));}
  const goalSessions=garminGoals?sessions.filter(s=>s.garminOutdoor):sessions;
  if(window!=='all')sessions=sessions.filter(s=>dateMs(s.date)>=dateMs(anchor)-90*day);
  const weeks=Array.from({length:8},(_,i)=>{const start=monday(dateMs(anchor)-(7-i)*7*day);return {start,distanceM:0,sessions:0,garminM:0,historicalM:0};});
  for(const s of sessions){const week=weeks.find(w=>w.start===monday(dateMs(s.date)));if(week){week.distanceM+=s.distanceM??0;week.sessions++;week[s.sourceKind==='screenshot'?'historicalM':'garminM']+=s.distanceM??0;}}
  const metrics={sessions:sessions.length,runs:sessions.filter(s=>s.run).length,walks:sessions.filter(s=>s.sport==='Walk').length,distanceM:sessions.reduce((n,s)=>n+(s.distanceM??0),0),recordedTimeS:sessions.reduce((n,s)=>n+(s.durationS??0),0),durationCoverage:sessions.filter(s=>s.durationS!==null).length,hrSessions:sessions.filter(s=>s.hrBpm!==null).length,gpsSessions:sessions.filter(s=>s.gpsSamples>0).length,paceSessions:sessions.filter(s=>s.paceSPerKm!==null&&s.run).length,comparableSessions:sessions.filter(s=>s.comparable).length,checkins:sessions.filter(s=>s.checkinComplete).length};
  const measured=[];
  if(sessions.some(s=>s.flags.includes('insufficient_distance')))measured.push({kind:'quality',title:'Some distance recordings cannot support pace.',body:'Heart rate and recorded time remain available. Distance-based conclusions are withheld for these sessions.',sessionIds:sessions.filter(s=>s.flags.includes('insufficient_distance')).map(s=>s.id)});
  if(metrics.comparableSessions<3)measured.push({kind:'coverage',title:'A fitness trend would be premature.',body:'The imported history does not yet contain enough comparable outdoor runs. Indoor sessions, short recordings and differing time bases stay separate.',sessionIds:sessions.filter(s=>s.run).map(s=>s.id)});
  if(sessions.some(s=>s.flags.includes('screenshot_summary')))measured.push({kind:'source',title:'Historical summaries are part of your record.',body:'Their displayed distance and pace are preserved. GPS and heart-rate streams are not reconstructed from screenshots.',sessionIds:sessions.filter(s=>s.sourceKind==='screenshot').map(s=>s.id)});
  const selectedIds=new Set(sessions.map(s=>s.id));
  return {goals:runningGoalProgress(goalSessions,goalVersions,anchor),summary:recordedTraining(sessions,anchor),zoneVersions,version:TRAINING_VERSION,progressVersion:PROGRESS_VERSION,dataset:synthetic?'synthetic':'personal',window,anchor,metrics,weeks,sessions,routeMatches:matchedRoutes(sorted.filter(a=>selectedIds.has(a.id)&&activityKind(a)==='run'&&!isScreenshot(a)&&a.records?.length)),measured,scope:'Imported activities only; missing weeks are not proof of no training.'};
}

export function syntheticHistory(){return Array.from({length:10},(_,i)=>{
  const a=demonstration(),factor=1.2-i*.018,missingHr=i===1||i===4,indoor=i===7;
  const result={...a,id:'synthetic-'+i,title:indoor?'Synthetic treadmill run':'Synthetic outdoor run',date:new Date(Date.UTC(2026,9,1+i*3)).toISOString().slice(0,10),timer:a.timer*factor,moving:a.moving*factor,elapsed:a.elapsed*factor,records:a.records.map(r=>({...r,t:r.t*factor,speed:r.speed===null?null:r.speed/factor,hr:missingHr?null:r.hr-i*.2,lat:indoor?null:r.lat,lon:indoor?null:r.lon})),hr:missingHr?null:a.hr-i*.2,maxHr:missingHr?null:a.maxHr-i*.2,laps:[{distance:a.distance,duration:a.timer*factor}],...(indoor?{provider:{id:'synthetic-provider-'+i,detail:{activityTypeDTO:{typeKey:'treadmill_running'}}}}:{})};
  result.blocks=timeBlocks(result.records,240);result.observation={...observation(result),version:ANALYSIS_VERSION};return result;
});}

export function evidencePack(dataset){
  const sessions=dataset.sessions.slice(0,30),facts=[],mapping={};
  const add=(id,label,value,unit,sessionIds=[])=>facts.push({id,label,value,unit,sessionIds});
  const selected=sessions.map((s,i)=>{const ref='s'+String(i+1).padStart(2,'0');mapping[ref]=s.id;for(const [field,label,unit]of [['distanceM','Recorded distance','m'],['durationS','Recorded duration','s'],['paceSPerKm','Recorded pace','s/km'],['hrBpm','Average heart rate','bpm']])add(`${ref}.${field}`,label,s[field],unit,[ref]);return {ref,daysBeforeAnchor:Math.round((dateMs(dataset.anchor)-dateMs(s.date))/day),sport:s.run?'run':'walk',environment:s.environment,sourceKind:s.sourceKind,durationBasis:s.durationBasis,paceBasis:s.paceBasis,comparable:s.comparable,limitations:s.flags};});
  for(const [key,label,unit]of [['sessions','Imported sessions','count'],['runs','Imported runs','count'],['distanceM','Imported distance','m'],['hrSessions','Sessions with heart rate','count'],['gpsSessions','Sessions with GPS','count'],['comparableSessions','Comparable outdoor sessions','count']])add('history.'+key,label,dataset.metrics[key],unit);
  const eligible=selected.filter(s=>s.comparable),latest=eligible[0];
  if(latest){const baseline=eligible.find(s=>s.ref!==latest.ref&&s.daysBeforeAnchor-latest.daysBeforeAnchor>=7&&s.daysBeforeAnchor-latest.daysBeforeAnchor<=42&&Math.abs(facts.find(f=>f.id===s.ref+'.distanceM').value/facts.find(f=>f.id===latest.ref+'.distanceM').value-1)<=.2);if(baseline){const value=ref=>facts.find(f=>f.id===ref+'.paceSPerKm').value;add('comparison.paceChangePercent','Pace change; descriptive only',(value(latest.ref)/value(baseline.ref)-1)*100,'percent',[baseline.ref,latest.ref]);}}
  const content={version:TRAINING_VERSION,dataset:dataset.dataset,historyTruncated:dataset.sessions.length>30,scope:dataset.scope,sessions:selected,facts};
  return {content,hash:createHash('sha256').update(JSON.stringify(content)).digest('hex'),mapping};
}
