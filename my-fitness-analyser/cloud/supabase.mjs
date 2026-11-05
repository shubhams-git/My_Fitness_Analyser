import { LocalLibrary } from '../prototypes/library.mjs';
import { createHash } from 'node:crypto';

export const emptyLibrary=()=>({schemaVersion:1,activities:{},feedback:{},originals:{}});
export class CloudError extends Error { constructor(status,message){super(message);this.status=status;} }
export function cloudConfig(env=process.env){
  const {SUPABASE_URL:url,SUPABASE_ANON_KEY:key,FITNESS_OWNER_ID:owner,APP_ORIGIN:origin}=env;
  if(!url||!key||!owner||!origin)throw new CloudError(503,'Private hosting is not configured yet.');
  let role;try{role=JSON.parse(Buffer.from(key.split('.')[1]||'','base64url').toString()).role;}catch{}
  if(key.startsWith('sb_secret_')||role==='service_role')throw new CloudError(503,'Use the Supabase publishable or anon key, not a privileged key.');
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)||!/^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/.test(owner))throw new CloudError(503,'Private hosting configuration needs attention.');
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
  async read(){return structuredClone((await this.snapshot()).state);}
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
  async exportBackup(){const backup=await this.read();for(const [hash,original]of Object.entries(backup.originals)){const response=await this.api.request('/storage/v1/object/fitness-private/'+original.key);if(!response.ok)throw new CloudError(503,'A backup original could not be read.');backup.originals[hash]=Buffer.from(await response.arrayBuffer()).toString('base64');}backup.exportedAt=new Date().toISOString();return backup;}
}
