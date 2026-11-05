import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { inflateRawSync } from 'node:zlib';

const base='https://personal.connectapi.garmin.com';
const limit=32*1024*1024;
export async function readGarminKey(){
  let env={};try{env=parseEnv(await readFile(new URL('../.env',import.meta.url),'utf8'));}catch{}
  return (process.env.GARMIN_PERSONAL_API_KEY||env.GARMIN_PERSONAL_API_KEY||env.API_KEY||'').trim();
}

// Read one FIT entry in memory. Archive names are never filesystem paths.
export function fitFromZip(bytes){
  let end=-1;
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(bytes.readUInt32LE(i)===0x06054b50){end=i;break;}
  if(end<0)throw new Error('Garmin returned an invalid activity archive.');
  const count=bytes.readUInt16LE(end+10);let offset=bytes.readUInt32LE(end+16),fits=[];
  if(count>1000)throw new Error('The Garmin archive has too many entries.');
  for(let i=0;i<count;i++){
    if(offset+46>bytes.length||bytes.readUInt32LE(offset)!==0x02014b50)throw new Error('Invalid archive directory.');
    const flags=bytes.readUInt16LE(offset+8),method=bytes.readUInt16LE(offset+10),compressed=bytes.readUInt32LE(offset+20),size=bytes.readUInt32LE(offset+24),nameSize=bytes.readUInt16LE(offset+28),extra=bytes.readUInt16LE(offset+30),comment=bytes.readUInt16LE(offset+32),local=bytes.readUInt32LE(offset+42);
    if(offset+46+nameSize+extra+comment>bytes.length)throw new Error('Invalid archive entry.');
    const name=bytes.subarray(offset+46,offset+46+nameSize).toString('utf8');offset+=46+nameSize+extra+comment;
    if(!/\.fit$/i.test(name))continue;
    if(flags&1||![0,8].includes(method)||size>limit||local+30>bytes.length||bytes.readUInt32LE(local)!==0x04034b50)throw new Error('Unsupported FIT archive entry.');
    const start=local+30+bytes.readUInt16LE(local+26)+bytes.readUInt16LE(local+28);
    if(start+compressed>bytes.length)throw new Error('Truncated FIT archive.');
    const payload=bytes.subarray(start,start+compressed),fit=method===8?inflateRawSync(payload,{maxOutputLength:limit}):payload;
    if(fit.length!==size)throw new Error('Incomplete FIT archive entry.');fits.push(fit);
  }
  if(fits.length!==1)throw new Error('Expected exactly one original FIT activity.');
  return fits[0];
}

export class GarminClient {
  constructor(key,{fetcher=fetch,pause=ms=>new Promise(r=>setTimeout(r,ms))}={}){this.key=key;this.fetcher=fetcher;this.pause=pause;this.token=null;}
  async request(path,{method='GET',authorization=null,binary=false,refresh=true}={}){
    if(!authorization&&!this.token)await this.authenticate();
    for(let attempt=0;attempt<3;attempt++){
      let response;try{response=await this.fetcher(base+path,{method,redirect:'error',signal:AbortSignal.timeout(30000),headers:{Authorization:authorization||`Bearer ${this.token}`,Accept:binary?'application/x-zip-compressed':'*/*'}});}catch{throw new Error('Garmin could not be reached. Try syncing again.');}
      if(response.status===401&&!authorization&&refresh){await this.authenticate();return this.request(path,{method,binary,refresh:false});}
      if([429,500,502,503,504].includes(response.status)&&attempt<2){const retry=Number(response.headers.get('retry-after'));await this.pause(Number.isFinite(retry)&&retry>0?Math.min(retry*1000,30000):500*2**attempt);continue;}
      if(!response.ok)throw new Error(response.status===401||response.status===403?'Garmin access was denied. Check or renew the API key in .env.':`Garmin request failed (HTTP ${response.status}). Retry sync to continue.`);
      let size=0;const chunks=[];for await(const chunk of response.body){size+=chunk.length;if(size>limit)throw new Error('Garmin response exceeds the supported size.');chunks.push(chunk);}return Buffer.concat(chunks);
    }
  }
  async authenticate(){const token=(await this.request('/personalapitoken-service/personal-api/personal-api-key/token',{method:'POST',authorization:`ApiKey ${this.key}`})).toString().trim();if(!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token))throw new Error('Garmin returned an unexpected access token.');this.token=token;}
  async json(path){try{return JSON.parse((await this.request(path)).toString());}catch(e){if(e instanceof SyntaxError)throw new Error('Garmin returned unexpected activity data.');throw e;}}
}

export class GarminSync {
  constructor(library,{keyReader=readGarminKey,clientFactory=key=>new GarminClient(key)}={}){this.library=library;this.keyReader=keyReader;this.clientFactory=clientFactory;this.running=false;this.progress=null;}
  async status(){return {configured:Boolean(await this.keyReader()),running:this.running,progress:this.progress,...(await this.library.read()).garminSync};}
  async run(){
    if(this.running)throw new Error('A Garmin sync is already running.');this.running=true;
    const result={startedAt:new Date().toISOString(),imported:0,updated:0,unchanged:0,skipped:0,failed:0,seen:0,complete:false,errors:[]};this.progress=result;
    try{
      const key=await this.keyReader();if(!key)throw new Error('Add the Garmin API key to the project .env file.');const client=this.clientFactory(key);let exhausted=false;const seen=new Set();
      for(let start=0;start<1000;start+=20){
        const page=await client.json(`/activitylist-service/activities/search/activities?start=${start}&limit=20`);if(!Array.isArray(page))throw new Error('Garmin returned an unexpected activity list.');
        for(const item of page){
          const id=String(item.activityId);if(!/^[1-9]\d{0,15}$/.test(id)||!Number.isSafeInteger(Number(id)))throw new Error('Garmin returned an invalid activity identity.');if(seen.has(id))continue;seen.add(id);result.seen++;
          if(!['running','track_running','treadmill_running','indoor_running','walking'].includes(item.activityType?.typeKey)){result.skipped++;continue;}
          try{const detail=await client.json(`/activity-service/activity/${id}`),bytes=fitFromZip(await client.request(`/download-service/files/activity/${id}`,{binary:true}));const outcome=await this.library.importGarmin(bytes,id,detail);result[outcome]++;}
          catch(e){result.failed++;result.errors.push({activityId:id,message:e.message});}
        }
        if(page.length<20){exhausted=true;break;}
      }
      result.complete=exhausted&&result.failed===0;
      if(!exhausted)result.errors.push({message:'The 1,000-activity safety limit was reached. History is incomplete.'});
      if(result.complete)result.lastSuccessAt=new Date().toISOString();
    }catch(e){result.errors.push({message:e.message});}
    finally{result.finishedAt=new Date().toISOString();try{await this.library.mutate(data=>{data.garminSync={...data.garminSync,...result,lastSuccessAt:result.lastSuccessAt||data.garminSync?.lastSuccessAt||null};});}finally{this.running=false;this.progress=null;}}
    return result;
  }
}
