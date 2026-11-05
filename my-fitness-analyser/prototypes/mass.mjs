import { createHash } from 'node:crypto';
export const MASS_VERSION='mass-journal-v1';
const collections=['weights','sessions'];
const hash=value=>createHash('sha256').update(value).digest('hex');
export const emptyMass=()=>({version:MASS_VERSION,weights:{},sessions:{},imports:{}});
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
const timestamp=value=>Number.isSafeInteger(value)&&value>=0&&value<=8640000000000000;
const text=(value,max=5000)=>{if(value==null)return '';if(typeof value!=='string'||value.length>max)throw new Error('A MASS text field is invalid or too long.');return value;};
const signature=row=>JSON.stringify([row.id,row.dateKey,row.t,row.kg,row.focus,row.mins,row.note,row.updatedAt,row.deletedAt]);
const revision=row=>Math.max(row.updatedAt,row.deletedAt??0);
function normalize(row,kind,sourceHash){
  if(!row||typeof row!=='object'||Array.isArray(row)||typeof row.id!=='string'||!row.id.trim()||row.id.length>200||['__proto__','constructor','prototype'].includes(row.id))throw new Error('Each MASS row needs a valid source ID.');
  const deleted=row.deletedAt!=null;if(deleted&&!timestamp(row.deletedAt)||!timestamp(row.updatedAt??(deleted?row.deletedAt:null)))throw new Error('A MASS update or deletion timestamp is invalid.');
  if((!deleted||row.dateKey!=null)&&!validDate(row.dateKey))throw new Error('A MASS date is invalid. Expected a real YYYY-MM-DD date.');
  if(row.t!=null&&!timestamp(row.t))throw new Error('A MASS source timestamp is invalid.');
  if(kind==='weights'&&(!deleted||row.kg!=null)&&!(Number.isFinite(row.kg)&&row.kg>0&&row.kg<=1000))throw new Error('A MASS weight must be a positive number in kilograms.');
  if(kind==='sessions'&&(!deleted||row.focus!=null)&&!(typeof row.focus==='string'&&row.focus.trim()&&row.focus.length<=200))throw new Error('A MASS strength session needs a focus label.');
  if(kind==='sessions'&&row.mins!=null&&!(Number.isFinite(row.mins)&&row.mins>=0&&row.mins<=1440))throw new Error('A MASS session duration is invalid.');
  return {id:row.id,dateKey:row.dateKey??null,t:row.t??null,...(kind==='weights'?{kg:row.kg??null}:{focus:row.focus??null,mins:row.mins??null}),note:text(row.note),updatedAt:row.updatedAt??row.deletedAt,deletedAt:deleted?row.deletedAt:null,sourceHash};
}
export function parseMass(bytes){
  if(bytes.length>10*1024*1024)throw new Error('Choose a MASS export smaller than 10 MB.');
  const raw=Buffer.isBuffer(bytes)?bytes.toString('utf8'):String(bytes);let source;
  try{source=JSON.parse(raw);}catch{throw new Error('This file is not valid JSON. Choose a MASS format 2 export.');}
  if(source?.app!=='mass'||source.format!==2||!Array.isArray(source.weights)||!Array.isArray(source.sessions)||typeof source.exportedAt!=='string'||!Number.isFinite(Date.parse(source.exportedAt)))throw new Error('Choose a MASS format 2 backup with weight and session collections.');
  if(source.weights.length+source.sessions.length>10000)throw new Error('This release supports up to 10,000 MASS rows per import.');
  const sourceHash=hash(raw),result={hash:sourceHash,raw,exportedAt:source.exportedAt,weights:{},sessions:{},ignoredCollections:['profile','measurements','nutrition','wellness'].filter(k=>source[k]&&(!Array.isArray(source[k])||source[k].length))};
  for(const kind of collections)for(const row of source[kind]){const incoming=normalize(row,kind,sourceHash),existing=Object.hasOwn(result[kind],incoming.id)?result[kind][incoming.id]:null;if(existing&&revision(existing)===revision(incoming)&&signature(existing)!==signature(incoming))throw new Error('The export contains conflicting rows with the same ID and update time.');if(!existing||revision(incoming)>revision(existing))result[kind][incoming.id]=incoming;}
  return result;
}
export function massDigest(state=emptyMass()){return hash(JSON.stringify(collections.map(kind=>Object.values(state[kind]||{}).sort((a,b)=>a.id.localeCompare(b.id)))));}
export function mergeMass(state,incoming,{importedAt=new Date().toISOString()}={}){
  state??=emptyMass();const next={version:MASS_VERSION,weights:{...state.weights},sessions:{...state.sessions},imports:{...state.imports}},counts={};
  for(const kind of collections){const count={added:0,updated:0,deleted:0,unchanged:0,older:0};for(const row of Object.values(incoming[kind])){const prior=Object.hasOwn(next[kind],row.id)?next[kind][row.id]:null;if(prior&&revision(row)<revision(prior)){count.older++;continue;}if(prior&&revision(row)===revision(prior)){if(signature(row)!==signature(prior))throw new Error('A MASS row conflicts with a saved row at the same update time. Resolve it in MASS and export again.');count.unchanged++;continue;}next[kind][row.id]=row;if(row.deletedAt!==null)count.deleted++;else count[prior?'updated':'added']++;}counts[kind]=count;}
  if(!Object.hasOwn(next.imports,incoming.hash))next.imports[incoming.hash]={hash:incoming.hash,raw:incoming.raw,exportedAt:incoming.exportedAt,importedAt};
  return {state:next,counts,duplicate:Object.hasOwn(state.imports||{},incoming.hash)};
}
export function importPreview(state,incoming){const merged=mergeMass(state,incoming),dates=[...Object.values(incoming.weights),...Object.values(incoming.sessions)].map(r=>r.dateKey).filter(Boolean).sort();return {hash:incoming.hash,baseDigest:massDigest(state),exportedAt:incoming.exportedAt,counts:merged.counts,duplicate:merged.duplicate,dateRange:dates.length?[dates[0],dates.at(-1)]:null,ignoredCollections:incoming.ignoredCollections,result:{weights:Object.values(merged.state.weights).filter(r=>r.deletedAt===null).length,sessions:Object.values(merged.state.sessions).filter(r=>r.deletedAt===null).length}};}
export function restoreMass(current,backup){
  if(backup?.version!==MASS_VERSION||!backup.imports||!backup.weights||!backup.sessions)throw new Error('The MASS journal backup is invalid.');
  let reconstructed=emptyMass();for(const [key,original]of Object.entries(backup.imports)){if(!/^[a-f0-9]{64}$/.test(key)||typeof original.raw!=='string'||hash(original.raw)!==key||typeof original.importedAt!=='string'||!Number.isFinite(Date.parse(original.importedAt)))throw new Error('A MASS original hash did not match.');const incoming=parseMass(original.raw);reconstructed=mergeMass(reconstructed,incoming,{importedAt:original.importedAt}).state;}
  for(const kind of collections){const entries=Object.entries(backup[kind]);if(entries.length!==Object.keys(reconstructed[kind]).length||entries.some(([id,r])=>!Object.hasOwn(reconstructed[kind],id)||signature(r)!==signature(reconstructed[kind][id])))throw new Error('A MASS backup record does not match its source evidence.');}
  let result=current??emptyMass();for(const original of Object.values(reconstructed.imports))result=mergeMass(result,parseMass(original.raw),{importedAt:original.importedAt}).state;return result;
}
export function sessionKind(focus){return /^cardio$/i.test(focus||'')?'Cardio':/^(push|pull|legs|upper body|lower body|full body|strength)$/i.test(focus||'')?'Strength':'Session';}
const dayMs=86400000;
const dateMs=date=>Date.parse(date+'T12:00:00Z');
export function journalDataset(state=emptyMass(),{window='90',anchor=new Date().toISOString().slice(0,10),synthetic=false}={}){
  const active=kind=>Object.values(state[kind]||{}).filter(r=>r.deletedAt===null&&dateMs(r.dateKey)<=dateMs(anchor)+dayMs).sort((a,b)=>a.dateKey.localeCompare(b.dateKey)||(a.t??0)-(b.t??0)||a.id.localeCompare(b.id));
  const weights=active('weights'),byDate=new Map();for(const r of weights){const values=byDate.get(r.dateKey)||[];values.push(r.kg);byDate.set(r.dateKey,values);}
  const daily=[...byDate].map(([date,values])=>({date,kg:values.reduce((a,b)=>a+b,0)/values.length,readings:values.length}));
  let left=0,sum=0;for(let i=0;i<daily.length;i++){const p=daily[i];sum+=p.kg;while(dateMs(daily[left].date)<dateMs(p.date)-6*dayMs){sum-=daily[left].kg;left++;}p.meanDays=i-left+1;p.mean7=p.meanDays>=3?sum/p.meanDays:null;}
  const inWindow=r=>window==='all'||dateMs(r.dateKey||r.date)>=dateMs(anchor)-(window==='30'?29:89)*dayMs,points=daily.filter(inWindow),entries=weights.filter(inWindow).toReversed(),sessions=active('sessions').filter(inWindow).toReversed().map(s=>({...s,kind:sessionKind(s.focus)})),latest=points.at(-1),first=points[0],imports=Object.values(state.imports||{}).sort((a,b)=>b.importedAt.localeCompare(a.importedAt));
  return {version:MASS_VERSION,dataset:synthetic?'synthetic':'personal',window,anchor,points,entries,sessions,metrics:{weighIns:entries.length,recordedDays:points.length,latestKg:latest?.kg??null,latestDate:latest?.date??null,changeKg:points.length>=2?latest.kg-first.kg:null,changeFrom:first?.date??null,mean7:latest?.mean7??null,meanDays:latest?.meanDays??0,firstDate:first?.date??null,loggedSessions:sessions.length,strengthSessions:sessions.filter(s=>s.kind==='Strength').length,cardioSessions:sessions.filter(s=>s.kind==='Cardio').length,recordedSessionMinutes:sessions.reduce((n,s)=>n+(s.mins??0),0),durationCoverage:sessions.filter(s=>s.mins!==null).length},imports:imports.map(({hash,exportedAt,importedAt})=>({hash,exportedAt,importedAt})),tombstones:collections.reduce((n,k)=>n+Object.values(state[k]||{}).filter(r=>r.deletedAt!==null).length,0),scope:'MASS records imported on this computer. Missing days do not mean no activity.',method:'Daily points average readings on the same date. The trailing seven-day mean uses recorded daily values and needs at least three recorded days; missing days are not filled.'};
}
export function syntheticMass(){const source={app:'mass',format:2,exportedAt:'2026-11-01T00:00:00Z',weights:Array.from({length:24},(_,i)=>({id:'demo-weight-'+i,dateKey:new Date(Date.UTC(2026,9,1+i)).toISOString().slice(0,10),kg:82-i*.035+Math.sin(i*1.7)*.32,updatedAt:1793491200000+i})),sessions:[{id:'demo-strength-1',dateKey:'2026-10-22',focus:'Upper body',mins:45,note:'Synthetic session. No exercise sets or loads supplied.',updatedAt:1793491200000},{id:'demo-strength-2',dateKey:'2026-10-25',focus:'Lower body',mins:40,note:'Synthetic session.',updatedAt:1793491200000}]};return mergeMass(null,parseMass(JSON.stringify(source)),{importedAt:'2026-11-01T00:00:00Z'}).state;}
