import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Decoder, Stream } from '@garmin/fitsdk';
import { timeBlocks } from './data.mjs';

const finite=x=>Number.isFinite(x)?x:null;
export function decodeActivity(bytes) {
  const decoder=new Decoder(Stream.fromBuffer(bytes));
  if(!decoder.isFIT()||!decoder.checkIntegrity())throw new Error('This file is not a valid, intact FIT activity.');
  const {messages,errors}=decoder.read();
  if(errors.length)throw new Error('FIT decoding failed. The original file has not been imported.');
  if(messages.sessionMesgs?.length!==1)throw new Error('Import one activity session at a time. Multisport files are not supported yet.');
  const s=messages.sessionMesgs[0];
  if(!['running','walking'].includes(s.sport))throw new Error('This release supports running and walking FIT activities.');
  const start=new Date(s.startTime),base=start.getTime()/1000;
  if(!Number.isFinite(base))throw new Error('The activity has no valid start timestamp.');
  const coordinate=(v,limit)=>{const n=finite(v)==null?null:v*180/2**31;return n!==null&&Math.abs(n)<=limit?n:null;};
  const records=(messages.recordMesgs||[]).map(r=>({t:new Date(r.timestamp).getTime()/1000-base,distance:finite(r.distance),speed:finite(r.enhancedSpeed??r.speed),hr:finite(r.heartRate),elevation:finite(r.enhancedAltitude??r.altitude),lat:coordinate(r.positionLat,90),lon:coordinate(r.positionLong,180),cadence:r.cadence==null?null:(r.cadence+(r.fractionalCadence||0))*2,power:finite(r.power)})).filter(r=>Number.isFinite(r.t)&&r.t>=0).sort((a,b)=>a.t-b.t);
  const hash=createHash('sha256').update(bytes).digest('hex');
  const date=start.toISOString().slice(0,10),time=start.toISOString().slice(11,16)+' UTC';
  const activity={id:'fit-'+hash,title:s.sport==='walking'?'Imported walk':'Imported run',date,time,startInstant:start.toISOString(),sport:s.sport==='walking'?'Walk':'Run',source:'Original FIT',device:'FIT recording device',synthetic:false,sourceHash:hash,parserVersion:'fit-local-v1',distance:finite(s.totalDistance),timer:finite(s.totalTimerTime),elapsed:finite(s.totalElapsedTime),moving:null,hr:finite(s.avgHeartRate),maxHr:finite(s.maxHeartRate),cadence:s.avgCadence==null?null:s.avgCadence*2,elevationGain:finite(s.totalAscent),records,laps:(messages.lapMesgs||[]).map(l=>({distance:finite(l.totalDistance),duration:finite(l.totalTimerTime)})),blockLabel:'1-minute blocks',sourceNote:null,sourceIssues:['Start time is displayed in UTC. Moving time is unavailable in this import.'],sourceFile:'Original FIT'};
  activity.blocks=timeBlocks(records);
  activity.observation={title:'Your session is ready to explore.',evidence:'Inspect the recorded route, measurements and device laps, then add how it felt.',method:'Source summary from one FIT session. Time blocks use recorded sample boundaries; device laps remain separate.',version:'fit-local-v1'};
  return activity;
}

export function validateFeedback(draft) {
  const a=draft?.answers;
  if(!a||!/^([1-9]|10)$/.test(String(a.effort))||!['sentences','phrases','few-words'].includes(a.breathing)||!['none','mild','affected'].includes(a.discomfort)||!['plenty','right','limit'].includes(a.finish))throw new Error('Answer all four check-in questions.');
  if(a.discomfort!=='none'&&!['shin','knee','ankle','foot','hip','other'].includes(draft.location))throw new Error('Choose where you felt discomfort.');
  return {answers:{effort:String(a.effort),breathing:a.breathing,discomfort:a.discomfort,finish:a.finish},location:a.discomfort==='none'?null:draft.location,note:String(draft.note||'').slice(0,500),context:(Array.isArray(draft.context)?draft.context:[]).filter(x=>['Heat','Poor sleep','Busy day','New shoes'].includes(x)),complete:true,pending:false,savedAt:new Date().toISOString()};
}

export class LocalLibrary {
  constructor(directory){this.directory=directory;this.file=new URL('library.json',directory);this.queue=Promise.resolve();}
  async read(){try{const value=JSON.parse(await readFile(this.file,'utf8'));if(value.schemaVersion!==1||!value.activities||!value.feedback)throw new Error('Unsupported library');for(const [id,a]of Object.entries(value.activities)){const canonical='fit-'+a.sourceHash;if(a.parserVersion==='fit-local-v1'&&id!==canonical){value.activities[canonical]={...a,id:canonical};delete value.activities[id];if(value.feedback[id]){value.feedback[canonical]??=value.feedback[id];delete value.feedback[id];}}}return value;}catch(e){if(e.code==='ENOENT')return {schemaVersion:1,activities:{},feedback:{},originals:{}};throw e;}}
  mutate(fn){const work=this.queue.then(async()=>{const data=await this.read(),result=await fn(data);await mkdir(this.directory,{recursive:true});const temp=new URL('library.tmp',this.directory);await writeFile(temp,JSON.stringify(data));await rename(temp,this.file);return result;});this.queue=work.catch(()=>{});return work;}
  async import(bytes,seeds=[]){const activity=decodeActivity(bytes);return this.mutate(data=>{const existing=Object.values(data.activities).find(a=>a.sourceHash===activity.sourceHash);if(existing)return {activity:existing,duplicate:true};data.activities[activity.id]=activity;data.originals[activity.sourceHash]=bytes.toString('base64');return {activity,duplicate:false};});}
  async save(id,draft,knownIds){if(!knownIds.includes(id))throw new Error('Activity was not found.');const value=validateFeedback(draft);return this.mutate(data=>{data.feedback[id]=value;return value;});}
  async restore(backup,seedIds=[]){
    if(backup?.schemaVersion!==1||!backup.activities||!backup.originals||!backup.feedback)throw new Error('Choose a fitness-library.json export.');
    const activities={},originals={},feedback={};
    for(const [id,a] of Object.entries(backup.activities)){
      if(!/^fit-[a-f0-9]{64}$/.test(id)&&!seedIds.includes(id))throw new Error('The backup has an unknown activity identity.');
      const raw=backup.originals[a.sourceHash];if(typeof raw!=='string')throw new Error('The backup is missing an original FIT.');
      const decoded=decodeActivity(Buffer.from(raw,'base64'));if(decoded.sourceHash!==a.sourceHash)throw new Error('A backup file hash did not match.');decoded.id=id;activities[id]=decoded;originals[a.sourceHash]=raw;
    }
    for(const [id,draft]of Object.entries(backup.feedback)){if(!Object.hasOwn(activities,id)&&!seedIds.includes(id))throw new Error('The backup references an unknown activity.');feedback[id]=validateFeedback(draft);}
    return this.mutate(data=>{data.activities={...activities,...data.activities};data.originals={...originals,...data.originals};data.feedback={...feedback,...data.feedback};return {restored:Object.keys(activities).length};});
  }
}
