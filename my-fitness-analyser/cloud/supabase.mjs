import { LocalLibrary,validateFeedback,decodeActivity } from '../prototypes/library.mjs';
import { createHash } from 'node:crypto';
import { activityEvidence,ownerRows } from './activities.mjs';

export const emptyLibrary=()=>({schemaVersion:1,activities:{},feedback:{},originals:{}});
async function parallelRead(items,read,limit=4){
 let next=0,failure;
 await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(!failure&&next<items.length){const item=items[next++];try{await read(item);}catch(error){failure??=error;}}}));
 if(failure)throw failure;
}
export class CloudError extends Error { constructor(status,message){super(message);this.status=status;} }
export function cloudConfig(env=process.env){
  const {SUPABASE_URL:url,SUPABASE_ANON_KEY:key,FITNESS_OWNER_ID:owner,APP_ORIGIN:origin}=env;
  if(!url||!key||!origin)throw new CloudError(503,'Private hosting is not configured yet.');
  let role;try{role=JSON.parse(Buffer.from(key.split('.')[1]||'','base64url').toString()).role;}catch{}
  if(key.startsWith('sb_secret_')||role==='service_role')throw new CloudError(503,'Use the Supabase publishable or anon key, not a privileged key.');
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)||(owner&&!/^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/.test(owner)))throw new CloudError(503,'Private hosting configuration needs attention.');
  const parsed=new URL(origin);if(parsed.origin!==origin||(parsed.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(parsed.hostname))||(env.VERCEL&&parsed.protocol!=='https:'))throw new CloudError(503,'Set the private app HTTPS origin.');
  return {url,key,owner,origin};
}

export class SupabaseApi {
  constructor(config,token,{fetcher=fetch}={}){this.config=config;this.token=token;this.fetcher=fetcher;}
  async request(path,{method='GET',body,headers={}}={}){
    let response;try{response=await this.fetcher(this.config.url+path,{method,redirect:'error',signal:AbortSignal.timeout(30000),headers:{apikey:this.config.key,...(this.token?{Authorization:`Bearer ${this.token}`}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers},...(body!==undefined?{body:typeof body==='string'||body instanceof Uint8Array?body:JSON.stringify(body)}:{})});}catch{throw new CloudError(503,'The private data service could not be reached.');}
    return response;
  }
  async json(path,options){const response=await this.request(path,options);if(!response.ok)throw new CloudError(response.status===401?401:503,'The private data request could not complete.');return response.status===204?null:response.json();}
}

// Uses the signed-in user's token and RLS, never a service-role key.
export class CloudLibrary extends LocalLibrary {
  constructor(api){super(null);this.api=api;this.owner=api.config.owner;}
  async snapshot(){const rows=await this.api.json(`/rest/v1/fitness_libraries?owner_id=eq.${this.owner}&select=revision,state`);if(!Array.isArray(rows))throw new CloudError(503,'The private library could not be read.');return rows[0]||{revision:0,state:emptyLibrary()};}
  async read(){
    const [snapshot,evidence]=await Promise.all([this.snapshot(),activityEvidence(this.api)]),data=structuredClone(snapshot.state);
    data.activityAliases={};
    for(const activity of evidence.activities){
      for(const alias of activity.legacyAliases){data.activityAliases[alias]=activity.id;data.feedback[activity.id]??=data.feedback[alias];delete data.activities[alias];delete data.feedback[alias];}
      data.activities[activity.id]=activity;
    }
    Object.assign(data.feedback,evidence.feedback);
    data.activities=Object.fromEntries(Object.entries(data.activities).filter(([,a])=>!a.synthetic&&a.date>='2026-07-01'));
    return data;
  }
  async save(id,draft,knownIds){
    if(!knownIds.includes(id))throw new CloudError(404,'Activity was not found.');
    if(!/^[0-9a-f-]{36}$/i.test(id))return super.save(id,draft,knownIds);
    const value=validateFeedback(draft),expected=Number(draft.revision||0);
    if(!Number.isSafeInteger(expected)||expected<0)throw new CloudError(400,'Reload this check-in before saving.');
    const response=await this.api.request('/rest/v1/rpc/save_activity_feedback',{method:'POST',body:{target_activity:id,expected_revision:expected,new_state:value}});
    if(response.status===409)throw new CloudError(409,'Your check-in changed on another device. Reload before saving.');
    if(!response.ok)throw new CloudError(503,'Your check-in could not be saved. Please retry.');
    return {...value,revision:Number(await response.json())};
  }
  async import(bytes,...args){if(decodeActivity(bytes).date<'2026-07-01')throw new CloudError(400,'This app currently keeps activity history from July 2026 onwards.');return super.import(bytes,...args);}
  async mutate(fn){
    for(let attempt=0;attempt<4;attempt++){
      const {revision,state}=await this.snapshot(),data=structuredClone(state),result=await fn(data);
      for(const [hash,original]of Object.entries(data.originals)){
        if(typeof original!=='string')continue;
        const bytes=Buffer.from(original,'base64');if(createHash('sha256').update(bytes).digest('hex')!==hash)throw new CloudError(400,'An original file hash did not match.');
        const key=`${this.owner}/originals/${hash}.fit`,path='/storage/v1/object/fitness-private/'+key;
        const upload=await this.api.request(path,{method:'POST',body:bytes,headers:{'Content-Type':'application/octet-stream','x-upsert':'false'}});
        if(!upload.ok){const existing=await this.api.request(path);if(!existing.ok||createHash('sha256').update(Buffer.from(await existing.arrayBuffer())).digest('hex')!==hash)throw new CloudError(503,'An original file could not be saved.');}
        data.originals[hash]={key};
      }
      const response=await this.api.request('/rest/v1/rpc/commit_fitness_library',{method:'POST',body:{expected_revision:revision,new_state:data}});
      if(response.ok)return result;
      // Serialization conflict: re-read and reapply this operation, never overwrite.
      if(response.status!==409)throw new CloudError(503,'The private library could not be saved.');
    }
    throw new CloudError(409,'Another save is in progress. Please retry.');
  }
  async exportBackup(){
    const backup=structuredClone((await this.snapshot()).state);
    const before=await ownerRows(this.api,'journal_heads');
    for(const [hash,original]of Object.entries(backup.originals)){const response=await this.api.request('/storage/v1/object/fitness-private/'+original.key);if(!response.ok)throw new CloudError(503,'A backup original could not be read.');backup.originals[hash]=Buffer.from(await response.arrayBuffer()).toString('base64');}
    const tables={};await parallelRead(['activities','activity_sources','source_accounts','raw_assets','activity_source_assets','activity_segments','activity_feedback','ingestion_runs','ingestion_items','record_changes','fitness_profiles','screenshot_submissions','ai_preferences','ai_consent_events','analysis_reports','body_measurements','journal_sessions','journal_imports','journal_heads','journal_mutations','strength_entries','weight_ai_preferences','weight_ai_consent_events','weight_analysis_reports'],async table=>{tables[table]=await ownerRows(this.api,table);});
    const assets=[...new Map([...tables.raw_assets,...tables.screenshot_submissions,...tables.journal_imports].map(asset=>[asset.sha256,asset])).values()];
    const originals={};await parallelRead(assets,async asset=>{const response=await this.api.request('/storage/v1/object/fitness-private/'+asset.object_key);if(!response.ok)throw new CloudError(503,'A source original could not be exported.');const bytes=Buffer.from(await response.arrayBuffer());if(createHash('sha256').update(bytes).digest('hex')!==asset.sha256)throw new CloudError(503,'An archived original failed verification.');originals[asset.sha256]=bytes.toString('base64');});
    const after=await ownerRows(this.api,'journal_heads'),revision=rows=>String(rows[0]?.revision||0);
    if(revision(before)!==revision(after)||revision(tables.journal_heads)!==revision(after))throw new CloudError(409,'Your journal changed while preparing the backup. Please export again.');
    return {schemaVersion:2,kind:'fitness-private-evidence-backup',ownerId:this.owner,exportedAt:new Date().toISOString(),legacy:backup,tables,originals};
  }
  async restore(backup,...args){if(backup?.schemaVersion===2)throw new CloudError(409,'This evidence archive needs a reviewed database restore. Your existing records are unchanged.');return super.restore(backup,...args);}
}
