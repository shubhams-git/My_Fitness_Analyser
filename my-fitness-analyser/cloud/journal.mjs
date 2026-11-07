import { createHash } from 'node:crypto';
import { CloudError } from './supabase.mjs';
import { parseMass,emptyMass,mergeMass,importPreview,journalDataset } from '../prototypes/mass.mjs';

export const HISTORY_FROM='2026-07-01',JOURNAL_LIMIT=3.5*1024*1024;
export function localDay(timezone='Australia/Sydney',instant=new Date()){
  try{const p=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(instant);return ['year','month','day'].map(k=>p.find(x=>x.type===k).value).join('-');}
  catch{return localDay('Australia/Sydney',instant);}
}
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00Z'))&&new Date(value+'T12:00Z').toISOString().slice(0,10)===value;
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function validateWeighIn(body,today){
  if(!body||!uuid(body.id)||!uuid(body.operationId)||!Number.isSafeInteger(body.revision)||body.revision<0||!Number.isSafeInteger(body.head)||body.head<0)throw new CloudError(400,'Refresh your journal before saving this reading.');
  if(!date(body.dateKey)||body.dateKey<HISTORY_FROM||body.dateKey>today)throw new CloudError(400,'Choose a date from July 2026 through today.');
  if(typeof body.kg!=='number'||!Number.isFinite(body.kg)||body.kg<=0||body.kg>1000||Math.abs(body.kg*100-Math.round(body.kg*100))>1e-7)throw new CloudError(400,'Enter a weight above 0 and up to 1,000 kg, with at most two decimal places.');
  if(typeof body.note!=='string'||body.note.length>2000||typeof body.deleted!=='boolean'||typeof body.confirmSameDay!=='boolean')throw new CloudError(400,'Check the reading and keep the note under 2,000 characters.');
  return {target_id:body.id,expected_revision:body.revision,expected_head:body.head,operation_id:body.operationId,new_value:{dateKey:body.dateKey,kg:body.kg,note:body.note,deleted:body.deleted,confirmSameDay:body.confirmSameDay}};
}
export function validateStrength(body,today){
  if(!body||!uuid(body.id)||!uuid(body.operationId)||!Number.isSafeInteger(body.revision)||body.revision<0||!Number.isSafeInteger(body.head)||body.head<0)throw new CloudError(400,'Refresh your journal before saving this session.');
  if(!date(body.dateKey)||body.dateKey<HISTORY_FROM||body.dateKey>today||!['Push','Pull','Legs','Upper body','Lower body','Full body','Strength'].includes(body.focus)||body.mins!==null&&(!Number.isInteger(body.mins)||body.mins<1||body.mins>1440)||typeof body.note!=='string'||body.note.length>2000||typeof body.deleted!=='boolean'||typeof body.confirmSeparate!=='boolean')throw new CloudError(400,'Check the session details.');
  const c=body.checkin;
  if(c!==null&&(!c||Object.keys(c).some(k=>!['completion','effort','legFatigue','discomfort','location'].includes(k))||!['planned','modified','cut-short'].includes(c.completion)||!Number.isInteger(c.effort)||c.effort<1||c.effort>10||!['fresh','noticeable','heavy'].includes(c.legFatigue)||!['none','mild','affected'].includes(c.discomfort)||typeof c.location!=='string'||c.location.length>200||(c.discomfort==='none'?c.location!=='':!c.location.trim())))throw new CloudError(400,'Complete the four check-in answers, including discomfort location when needed.');
  return {target_id:body.id,expected_revision:body.revision,expected_head:body.head,operation_id:body.operationId,new_value:Object.fromEntries(['dateKey','focus','mins','note','deleted','confirmSeparate','checkin'].map(k=>[k,body[k]]))};
}
export function massState(snapshot,{manual=true}={}){
  const state=emptyMass();
  for(const r of snapshot.weights){if(!manual&&r.source!=='mass')continue;state.weights[(manual?r.source+':':'')+r.entry_key]={...r.data,id:(manual?r.source+':':'')+r.entry_key,source:r.source,entryKey:r.entry_key,revision:Number(r.revision),recordedAt:r.created_at,sourceHash:r.import_sha256};}
  for(const r of snapshot.sessions)state.sessions[(manual?'mass:':'')+r.entry_key]={...r.data,source:'mass',entryKey:r.entry_key,revision:Number(r.revision)};
  if(manual)for(const r of snapshot.manualSessions||[])state.sessions['manual:'+r.id]={...r.data,id:r.id,source:'manual',entryKey:r.id,revision:Number(r.revision),deletedAt:r.deleted?1:null};
  for(const r of snapshot.imports)state.imports[r.sha256]={hash:r.sha256,importedAt:r.created_at,exportedAt:r.exported_at};
  return state;
}
export function journalProjection(snapshot,{window='90',now=new Date()}={}){
  const state=massState(snapshot),today=localDay(snapshot.timezone,now);
  for(const kind of ['weights','sessions'])state[kind]=Object.fromEntries(Object.entries(state[kind]).filter(([,r])=>r.dateKey===null||r.dateKey>=HISTORY_FROM));
  const view=journalDataset(state,{window,anchor:today});
  const all=journalDataset(state,{window:'all',anchor:today});
  const recent=(a,b)=>b.dateKey.localeCompare(a.dateKey)||(Date.parse(b.recordedAt||0)||0)-(Date.parse(a.recordedAt||0)||0)||b.id.localeCompare(a.id);
  view.entries.sort(recent);all.entries.sort(recent);
  return {...view,revision:Number(snapshot.revision),today,timezone:snapshot.timezone,canLog:true,canLogStrength:Array.isArray(snapshot.manualSessions),canImport:true,importLimitMB:3.5,latestReading:all.entries[0]||null,daySessions:all.sessions.map(({entryKey,source,dateKey,focus})=>({entryKey,source,dateKey,focus})),removedSessions:(snapshot.manualSessions||[]).filter(r=>r.deleted).map(r=>({...r.data,entryKey:r.id,revision:Number(r.revision),source:'manual'})),dayReadings:all.entries.map(({entryKey,source,revision,dateKey,kg})=>({entryKey,source,revision,dateKey,kg})),removed:snapshot.weights.filter(r=>r.source==='manual'&&r.deleted).map(r=>({...r.data,entryKey:r.entry_key,revision:Number(r.revision),source:'manual'})),scope:'Your private MASS history, weigh-ins and recorded strength sessions. Missing days are left open.'};
}
export class CloudJournal {
  constructor(api){this.api=api;}
  async rpc(name,body={}){
    const response=await this.api.request('/rest/v1/rpc/'+name,{method:'POST',body});
    let value;try{value=await response.json();}catch{}
    if(!response.ok){
      const known=['Your journal changed.','There is already a reading on this date.','A MASS row conflicts','This save identifier was already used.','Check the date, weight and note.','Check the session','A session is already recorded'];
      throw new CloudError([400,409].includes(response.status)?response.status:503,known.some(s=>value?.message?.startsWith(s))?value.message:'Your journal could not be saved or loaded. Please retry.');
    }
    return value;
  }
  snapshot(){return this.rpc('journal_snapshot');}
  async dataset(options){return journalProjection(await this.snapshot(),options);}
  async save(body){const snapshot=await this.snapshot();return this.rpc('save_body_measurement',validateWeighIn(body,localDay(snapshot.timezone)));}
  async saveStrength(body){const snapshot=await this.snapshot();return this.rpc('save_strength_entry',validateStrength(body,localDay(snapshot.timezone)));}
  async preview(bytes){
    const incoming=this.parse(bytes),snapshot=await this.snapshot(),state=massState(snapshot,{manual:false});
    const excluded={weights:0,sessions:0};
    for(const kind of ['weights','sessions'])for(const [id,row]of Object.entries(incoming[kind]))if(row.dateKey&&row.dateKey<HISTORY_FROM&&!state[kind][id]){delete incoming[kind][id];excluded[kind]++;}
    const result=importPreview(state,incoming),merged=mergeMass(state,incoming).state;
    for(const kind of ['weights','sessions']){result.counts[kind].excluded=excluded[kind];result.result[kind]=Object.values(merged[kind]).filter(r=>r.deletedAt===null&&r.dateKey>=HISTORY_FROM).length;}
    const overlapDates=[...new Set(snapshot.weights.filter(r=>r.source==='manual'&&!r.deleted&&Object.values(incoming.weights).some(w=>w.deletedAt===null&&w.dateKey===r.date_key)).map(r=>r.date_key))];
    const overlapSessionDates=[...new Set((snapshot.manualSessions||[]).filter(r=>!r.deleted&&Object.values(incoming.sessions).some(v=>v.deletedAt===null&&v.dateKey===r.date_key)).map(r=>r.date_key))];
    return {...result,overlapDates,overlapSessionDates,headRevision:Number(snapshot.revision),importLimitMB:3.5};
  }
  parse(bytes){if(bytes.length>JOURNAL_LIMIT)throw new CloudError(413,'Choose a MASS export smaller than 3.5 MB.');try{return parseMass(bytes);}catch(e){throw new CloudError(400,e.message);}}
  async commit(bytes,{head,hash,confirmSameDay=false}){
    const incoming=this.parse(bytes);
    if(!Number.isSafeInteger(head)||head<0||hash!==incoming.hash)throw new CloudError(400,'Review the same MASS file again before importing.');
    const key=this.api.config.owner+'/journal/'+incoming.hash+'.json',path='/storage/v1/object/fitness-private/'+key;
    const upload=await this.api.request(path,{method:'POST',body:bytes,headers:{'Content-Type':'application/json','x-upsert':'false'}});
    if(!upload.ok&&![400,409].includes(upload.status))throw new CloudError(503,'The original could not be archived. Please retry.');
    const stored=await this.api.request(path);if(!stored.ok||createHash('sha256').update(Buffer.from(await stored.arrayBuffer())).digest('hex')!==incoming.hash)throw new CloudError(503,'The archived original did not verify. No readings were published.');
    return this.rpc('commit_mass_journal',{expected_head:head,source_hash:incoming.hash,object_key:key,byte_length:bytes.length,exported_at:incoming.exportedAt,confirm_same_day:confirmSameDay,incoming:{weights:Object.values(incoming.weights),sessions:Object.values(incoming.sessions)}});
  }
}
