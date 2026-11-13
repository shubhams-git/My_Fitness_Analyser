import {ownerRows} from './activities.mjs';
import {CloudError} from './supabase.mjs';
import {localDay} from './journal.mjs';
import {validateGoal} from '../prototypes/goal-model.js';
export class CloudGoals{
 constructor(api){this.api=api;}
 async versions(){const rows=await ownerRows(this.api,'training_goal_versions','kind,revision,effective_from,target,deadline,distance_m,created_at','order=created_at.asc,kind.asc,revision.asc');return rows.map(r=>({kind:r.kind,revision:Number(r.revision),effectiveFrom:r.effective_from,target:r.target===null?null:Number(r.target),deadline:r.deadline,distanceM:r.distance_m===null?null:Number(r.distance_m),createdAt:r.created_at}));}
 async snapshot(){
  const [versions,profiles]=await Promise.all([this.versions(),this.api.json(`/rest/v1/fitness_profiles?owner_id=eq.${this.api.config.owner}&select=timezone`)]);
  return {today:localDay(profiles[0]?.timezone||'Australia/Sydney'),versions};
 }
 async save(body){const snapshot=await this.snapshot();let value;try{value=validateGoal(body,snapshot.today);}catch(e){throw new CloudError(400,e.message);}
  if(!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.operationId||''))throw new CloudError(400,'Reload your goals before saving.');
  const {kind,...new_value}=value,r=await this.api.request('/rest/v1/rpc/save_training_goal',{method:'POST',body:{goal_kind:kind,expected_revision:body.expectedRevision,operation_id:body.operationId,new_value}});
  if(!r.ok){let e={};try{e=await r.json();}catch{}throw new CloudError(e.code==='PT409'?409:e.code==='PT400'?400:503,['PT400','PT409'].includes(e.code)?e.message:'Your goal could not be saved. Your entries are intact; retry.');}
  return {saved:await r.json(),...await this.snapshot()};
 }
}
