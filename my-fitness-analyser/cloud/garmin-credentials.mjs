import { createCipheriv,createDecipheriv,randomBytes } from 'node:crypto';
import { GarminClient } from '../prototypes/garmin.mjs';
import { CloudError } from './supabase.mjs';

function encryptionKey(value){
  if(!/^[0-9a-f]{64}$/i.test(value||''))throw new CloudError(503,'Garmin credential storage is unavailable.');
  return Buffer.from(value,'hex');
}

function context(owner){return Buffer.from('fitness:garmin:v1:'+owner);}

export function sealGarminKey(key,owner,secret){
  const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',encryptionKey(secret),nonce);
  cipher.setAAD(context(owner));
  const encrypted=Buffer.concat([cipher.update(key,'utf8'),cipher.final()]);
  return 'v1.'+Buffer.concat([nonce,cipher.getAuthTag(),encrypted]).toString('base64url');
}

export function openGarminKey(envelope,owner,secret){
  const key=encryptionKey(secret);
  try{
    if(!/^v1\.[\w-]+$/.test(envelope))throw new Error();
    const bytes=Buffer.from(envelope.slice(3),'base64url');
    const decipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));
    decipher.setAAD(context(owner));
    decipher.setAuthTag(bytes.subarray(12,28));
    return Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString('utf8');
  }catch{throw new CloudError(503,'Your stored Garmin key could not be opened. Reconnect Garmin in Account.');}
}

export class GarminCredentials {
  constructor(api,secret){
    this.api=api;
    this.secret=secret;
    this.owner=api.config.owner;
    this.path='/rest/v1/fitness_garmin_credentials';
    this.filter='?owner_id=eq.'+this.owner;
  }
  async configured(){return (await this.api.json(this.path+this.filter+'&select=owner_id')).length>0;}
  async read(){
    const [row]=await this.api.json(this.path+this.filter+'&select=envelope');
    return row?openGarminKey(row.envelope,this.owner,this.secret):null;
  }
  async save(value,{clientFactory=key=>new GarminClient(key)}={}){
    const key=typeof value==='string'?value.trim():'';
    if(!/^[!-~]{8,1800}$/.test(key))throw new CloudError(400,'Enter a valid Garmin Personal API key.');
    const envelope=sealGarminKey(key,this.owner,this.secret);
    try{await clientFactory(key).authenticate(AbortSignal.timeout(15000));}
    catch(error){
      if([400,401,403].includes(error.status))throw new CloudError(400,'Garmin rejected this key. Check it or create a new one in Garmin Connect.');
      throw new CloudError(502,'Garmin could not verify the key. Try again shortly.');
    }
    const response=await this.api.request(this.path+'?on_conflict=owner_id',{
      method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},
      body:{owner_id:this.owner,envelope,updated_at:new Date().toISOString()}
    });
    if(!response.ok)throw new CloudError(503,'Your Garmin key could not be saved. Try again.');
  }
}
