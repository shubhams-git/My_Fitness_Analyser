import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
export const ANALYSIS_VERSION = 'prototype-sampled-blocks-v2';

export const finite = value => Number.isFinite(value) ? value : null;
export const pace = speed => Number.isFinite(speed) && speed > 0 ? 1000 / speed : null;

// Sample-aligned elapsed-time blocks, not reconstructed kilometre splits.
export function timeBlocks(records, seconds = 60) {
  if (records.length < 2) return [];
  const start = records[0].t;
  const end = records.at(-1).t;
  const blocks = [];
  let first = 0;
  for (let boundary = start + seconds; first < records.length - 1; boundary += seconds) {
    let last = records.findIndex((row, i) => i > first && row.t >= Math.min(boundary, end));
    if (last < 0) last = records.length - 1;
    const a = records[first], b = records[last], duration = b.t - a.t;
    const distance = a.distance !== null && b.distance !== null ? b.distance - a.distance : null;
    const hr = records.slice(first, last + 1).map(x => x.hr).filter(x => x !== null);
    blocks.push({ index: blocks.length, start: a.t - start, end: b.t - start, duration, distance, pace: distance > 0 && duration > 0 ? duration / distance * 1000 : null, hr: hr.length ? hr.reduce((x,y) => x+y,0) / hr.length : null, first, last });
    first = last;
  }
  return blocks;
}

export function observation(activity) {
  if(activity.distance!==null&&activity.distance<10&&activity.timer>0)return {title:'This session has no usable distance for pace.',evidence:'Recorded duration and available sensor measurements are preserved.',method:'Distance is below 10 metres. Pace and distance-based findings are withheld; original summary values remain available.'};
  const blocks = activity.blocks;
  const first = blocks[0], last = blocks.at(-1);
  const eligible = block => block && block.duration >= 50 && block.pace >= 180 && block.pace <= 1200;
  if (blocks.length >= 2 && eligible(first) && eligible(last)) {
    const difference = Math.round(Math.abs(last.pace - first.pace));
    const label=first.duration>=110?'block':'minute';
    return { title: difference < 2 ? `Your opening and closing ${label}s were almost even.` : `Your closing ${label} was ${difference} sec/km ${last.pace < first.pace ? 'quicker' : 'slower'}.`, evidence: `Compared with your opening ${label}, using recorded distance and time.`, method: `Sample-aligned ${Math.round(first.duration)} s and ${Math.round(last.duration)} s blocks. Pace = elapsed sample time ÷ recorded distance. This describes this session; it does not establish a fitness trend.` };
  }
  if(activity.moving!=null && activity.timer-activity.moving>60){const time=s=>`${Math.floor(Math.round(s)/60)}:${String(Math.round(s)%60).padStart(2,'0')}`;return {title:`Your moving time was ${time(activity.moving)} of ${time(activity.timer)}.`,evidence:'Moving time and timer time are different measurements.',method:'These are separate Garmin summary fields. Their difference is not treated as proof of a pause or walking.'};}
  return { title: 'A short session, with the details intact.', evidence: 'Inspect the recorded time, distance and available measurements.', method: 'Source summary only. No physiological or progress claim is inferred.' };
}

export function demonstration() {
  const records = Array.from({length: 1201}, (_,i) => {
    const angle = i/1200*Math.PI*2;
    return { t:i, distance:0, speed:null, hr:145+Math.sin(i/150)*8+i/1200*9, elevation:65+Math.sin(i/170)*5, lat:-37.9+Math.sin(angle)*.0063, lon:145.1+Math.cos(angle)*.0094, cadence:168, power:null };
  });
  const radians=x=>x*Math.PI/180;
  let elevationGain=0;
  for(let i=1;i<records.length;i++){const a=records[i-1],b=records[i];const h=Math.sin(radians(b.lat-a.lat)/2)**2+Math.cos(radians(a.lat))*Math.cos(radians(b.lat))*Math.sin(radians(b.lon-a.lon)/2)**2;const metres=6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));b.distance=a.distance+metres;b.speed=metres/(b.t-a.t);elevationGain+=Math.max(0,b.elevation-a.elevation);}
  const total=records.at(-1).distance;
  const activity = { id:'demo', title:'Riverside loop', date:'2026-10-25', time:'07:12', sport:'Run', source:'Synthetic sample', device:'Demonstration', synthetic:true, distance:total, timer:1200, elapsed:1200, moving:1200, hr:records.reduce((s,r)=>s+r.hr,0)/records.length, maxHr:Math.max(...records.map(r=>r.hr)), cadence:168, elevationGain, records, laps:[{distance:total,duration:1200}], sourceNote:null, sourceIssues:[], sourceFile:null };
  activity.blocks = timeBlocks(records,240);
  activity.blockLabel = '4-minute blocks';
  activity.observation = observation(activity);
  activity.observation.version = ANALYSIS_VERSION;
  return activity;
}

export async function loadPrototypeData() {
  const privateRoot = new URL('../private-data/', import.meta.url);
  const activities = [];
  try {
    const dirs = (await readdir(new URL('garmin/', privateRoot), {withFileTypes:true})).filter(x => x.isDirectory()).map(x => x.name).sort().reverse();
    let capture;
    for (const dir of dirs) {
      try { const m=JSON.parse(await readFile(new URL(`garmin/${dir}/manifest.json`,privateRoot),'utf8')); if(m.complete){capture=`garmin/${dir}/`;break;} } catch {}
    }
    if (capture) {
      const list = JSON.parse(await readFile(new URL(capture+'activities.json',privateRoot),'utf8'));
      const fitFiles = await readdir(new URL(capture+'fits/',privateRoot));
      const chosen = [list.find(x=>x.activityType.typeKey==='running'),list.find(x=>x.activityType.typeKey==='track_running'),list.find(x=>x.activityType.typeKey==='walking')].filter(Boolean);
      for (const item of chosen) {
        const detail=JSON.parse(await readFile(new URL(capture+`activity-${item.activityId}.json`,privateRoot),'utf8'));
        const filename=fitFiles.find(x=>x.startsWith(`activity-${item.activityId}-`)&&x.endsWith('.fit.decoded.json'));
        if(!filename)continue;
        const decoded=JSON.parse(await readFile(new URL(capture+'fits/'+filename,privateRoot),'utf8')).messages;
        const summary=detail.summaryDTO;
        const records=(decoded.recordMesgs||[]).map(row=>({t:Date.parse(row.timestamp)/1000,distance:finite(row.distance),speed:finite(row.enhancedSpeed??row.speed),hr:finite(row.heartRate),elevation:finite(row.enhancedAltitude??row.altitude),lat:row.positionLat==null?null:row.positionLat*180/2**31,lon:row.positionLong==null?null:row.positionLong*180/2**31,cadence:row.cadence==null?null:(row.cadence+(row.fractionalCadence||0))*2,power:finite(row.power)}));
        const start=records[0]?.t||0;records.forEach(r=>r.t-=start);
        const sport=detail.activityTypeDTO.typeKey;
        const activity={ id:sport==='running'?'run':sport==='track_running'?'track':'walk',title:detail.activityName,date:summary.startTimeLocal.slice(0,10),time:summary.startTimeLocal.slice(11,16),sport:sport==='walking'?'Walk':sport==='track_running'?'Track run':'Run',source:'Garmin Connect',device:decoded.deviceInfoMesgs?.some(x=>x.garminProduct==='fr965')?'Forerunner 965':'Forerunner 255 Music',synthetic:false,distance:finite(summary.distance),timer:finite(summary.duration),elapsed:finite(summary.elapsedDuration),moving:finite(summary.movingDuration),hr:finite(summary.averageHR),maxHr:finite(summary.maxHR),cadence:finite(summary.averageRunCadence),elevationGain:finite(summary.elevationGain),records,laps:(decoded.lapMesgs||[]).map(x=>({distance:finite(x.totalDistance),duration:finite(x.totalTimerTime)})),sourceNote:null,sourceIssues:[],sourceFile:'Original FIT + API summary',blockLabel:'1-minute blocks'};
        activity.garminActivityId=String(item.activityId);activity.sourceHash=createHash('sha256').update(await readFile(new URL(capture+'fits/'+filename.replace('.decoded.json',''),privateRoot))).digest('hex');
        activity.blocks=timeBlocks(records);activity.observation=observation(activity);activities.push(activity);
      }
    }
  } catch (error) { console.warn('Private Garmin fixture unavailable; synthetic preview remains available.'); }
  try {
    const historical=JSON.parse(await readFile(new URL('historical/extracted-candidates.json',privateRoot),'utf8'));
    for (const candidate of historical.activities) {
      const s=candidate.summary;
      const nrc=candidate.provider.startsWith('nike');
      const splitDiff=Math.abs(candidate.splits[1].paceSecondsPerKm-candidate.splits[0].paceSecondsPerKm);
      activities.push({id:nrc?'nrc':'strava',title:nrc?'Evening run':candidate.title,date:candidate.localDate,time:candidate.localTime,sport:'Run',source:nrc?'Nike Run Club':'Strava',device:'Screenshot import',synthetic:false,distance:s.distanceM,timer:null,running:s.runningDurationSeconds??null,elapsed:s.elapsedDurationSeconds,moving:s.movingDurationSeconds??null,displayedPace:s.averagePaceSecondsPerKm,hr:null,maxHr:null,cadence:s.averageCadenceStepsPerMinute??null,elevationGain:s.elevationGainM,records:[],blocks:[],laps:[],splits:candidate.splits,blockLabel:'Kilometre splits',sourceNote:candidate.sourceNote,sourceIssues:candidate.reviewIssues,sourceFile:'Owner-supplied screenshots',observation:{title:`Your first two kilometres were ${splitDiff} seconds apart in pace.`,evidence:'Based on the split values visible in your screenshots.',method:'Absolute difference between the two displayed full-kilometre paces. Rounded screenshot measurements; no GPS or heart-rate stream.'}});
    }
  } catch {}
  activities.push(demonstration());
  activities.forEach(a=>a.observation.version=ANALYSIS_VERSION);
  return {activities,defaultId:activities.some(x=>x.id==='run')?'run':'demo',mode:'local-design-prototype'};
}
