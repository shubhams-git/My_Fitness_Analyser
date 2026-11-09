import {ownerRows} from './activities.mjs';
import {CloudError} from './supabase.mjs';
import {localDay} from './journal.mjs';
import {validateZone} from '../prototypes/zone-model.js';
export class CloudZones{
 constructor(api){this.api=api;}
 async snapshot(){const [rows,profiles]=await Promise.all([ownerRows(this.api,'training_zone_versions','kind,revision,effective_from,boundaries,source,created_at','order=created_at.asc,kind.asc,revision.asc'),this.api.json(`/rest/v1/fitness_profiles?owner_id=eq.${this.api.config.owner}&select=timezone`)]);return {today:localDay(profiles[0]?.timezone||'Australia/Sydney'),versions:rows.map(r=>({kind:r.kind,revision:Number(r.revision),effectiveFrom:r.effective_from,boundaries:r.boundaries,source:r.source,createdAt:r.created_at}))};}
 async save(body){
  const snapshot=await this.snapshot();let value;try{value=validateZone(body,snapshot.today);}catch(e){throw new CloudError(400,e.message);}
  if(!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.operationId||''))throw new CloudError(400,'Refresh your settings before saving.');
  const r=await this.api.request('/rest/v1/rpc/save_training_zones',{method:'POST',body:{zone_kind:value.kind,expected_revision:body.expectedRevision,operation_id:body.operationId,new_value:{effectiveFrom:value.effectiveFrom,boundaries:value.boundaries,source:value.source}}});
  if(!r.ok){let e={};try{e=await r.json();}catch{}throw new CloudError(e.code==='PT409'?409:e.code==='PT400'?400:503,['PT400','PT409'].includes(e.code)?e.message:'Your zone settings could not be saved. Retry with your entries intact.');}
  return {saved:await r.json(),...await this.snapshot()};
 }
}
