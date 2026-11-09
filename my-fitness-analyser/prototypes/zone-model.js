export const ZONE_VERSION='personal-zones-v1';
export const ZONE_KINDS=['heart','pace'];
const counts={heart:4,pace:5};
export class ZoneError extends Error{constructor(message){super(message);this.status=400;}}
export function validateZone(value,today){
 if(!value||!ZONE_KINDS.includes(value.kind))throw new ZoneError('Choose heart rate or pace.');
 const {kind,effectiveFrom,boundaries,source}=value;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom||'')||!Number.isFinite(Date.parse(effectiveFrom+'T12:00Z'))||new Date(effectiveFrom+'T12:00Z').toISOString().slice(0,10)!==effectiveFrom||effectiveFrom<'2026-07-01'||effectiveFrom>today)throw new ZoneError('Choose a valid date from 1 July 2026 through today.');
 if(!['garmin','coach','manual'].includes(source))throw new ZoneError('Choose where your zones come from.');
 if(boundaries!==null){
  if(!Array.isArray(boundaries)||boundaries.length!==counts[kind]||boundaries.some(x=>!Number.isInteger(x)||x<(kind==='heart'?40:60)||x>(kind==='heart'?240:3600)))throw new ZoneError(kind==='heart'?'Enter four whole-number boundaries from 40 to 240 bpm.':'Enter five valid paces from 1:00 to 60:00 /km.');
  if(boundaries.some((v,i)=>i&&(kind==='heart'?v<=boundaries[i-1]:v>=boundaries[i-1])))throw new ZoneError(kind==='heart'?'Each zone must start at a higher heart rate.':'Each higher zone must start at a faster pace.');
 }
 return {kind,effectiveFrom,boundaries,source};
}
export function zoneAt(versions,kind,date){return versions.filter(v=>v.kind===kind&&v.effectiveFrom<=date).toSorted((a,b)=>b.effectiveFrom.localeCompare(a.effectiveFrom)||b.revision-a.revision)[0]||null;}
export function zoneDistribution(records,setting){
 if(!setting?.boundaries)return null;
 const bins=Array.from({length:setting.boundaries.length+1},(_,i)=>({zone:i+1,seconds:0}));let knownS=0,unknownS=0;
 for(let i=0;i<records.length-1;i++){
  const a=records[i],dt=records[i+1].t-a.t;if(!Number.isFinite(dt)||dt<=0)continue;
  const v=setting.kind==='heart'?a.hr:Number.isFinite(a.speed)&&a.speed>=1000/3600?1000/a.speed:null;
  if(dt>15||!Number.isFinite(v)||v<=0){unknownS+=dt;continue;}
  const index=setting.boundaries.filter(b=>setting.kind==='heart'?v>=b:v<=b).length;
  bins[index].seconds+=dt;knownS+=dt;
 }
 return {version:ZONE_VERSION,settingRevision:setting.revision,effectiveFrom:setting.effectiveFrom,boundaries:setting.boundaries,kind:setting.kind,bins,knownS,unknownS};
}
export function activityZones(activity,versions=[]){
 if(!['Run','Track run','Track Run'].includes(activity.sport))return {};
 return Object.fromEntries(ZONE_KINDS.map(kind=>[kind,zoneDistribution(kind==='pace'&&activity.distance<10?[]:activity.records,zoneAt(versions,kind,activity.date))]));
}
export function aggregateZones(sessions,kind){
 const present=sessions.filter(s=>s.run),rows=present.map(s=>s.zones?.[kind]).filter(Boolean),bins=Array.from({length:kind==='heart'?5:6},(_,i)=>({zone:i+1,seconds:0}));
 for(const r of rows)for(const b of r.bins)bins[b.zone-1].seconds+=b.seconds;
 return {kind,bins,knownS:rows.reduce((n,r)=>n+r.knownS,0),unknownS:rows.reduce((n,r)=>n+r.unknownS,0),sampledRuns:rows.filter(r=>r.knownS>0).length,uncoveredRuns:present.length-rows.filter(r=>r.knownS>0).length,revisions:[...new Set(rows.filter(r=>r.knownS>0).map(r=>r.settingRevision))],settings:rows};
}
export const zoneClock=v=>Math.floor(Math.round(v)/60)+':'+String(Math.round(v)%60).padStart(2,'0');
export function parseZonePace(v){const m=/^(\d{1,2}):([0-5]\d)$/.exec(v.trim());return m?Number(m[1])*60+Number(m[2]):NaN;}
export function zoneRange(setting,index){
 const b=setting.boundaries;if(setting.kind==='heart')return index===0?`Below ${b[0]}`:index===b.length?`${b.at(-1)}+`:`${b[index-1]}–${b[index]-1}`;
 return index===0?`>${zoneClock(b[0])}`:index===b.length?`≤${zoneClock(b.at(-1))}`:`>${zoneClock(b[index])}–${zoneClock(b[index-1])}`;
}

// Largest remainders keep the displayed integer shares at exactly 100%.
export function zoneShares(bins){const total=bins.reduce((n,b)=>n+b.seconds,0);if(!total)return bins.map(()=>0);const raw=bins.map(b=>b.seconds/total*100),shares=raw.map(Math.floor);let remaining=100-shares.reduce((a,b)=>a+b,0);for(const i of raw.map((v,i)=>({i,f:v-shares[i]})).toSorted((a,b)=>b.f-a.f||a.i-b.i).map(x=>x.i)){if(remaining--<=0)break;shares[i]++;}return shares;}

export const zoneDate=v=>new Date(v+'T12:00Z').toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
