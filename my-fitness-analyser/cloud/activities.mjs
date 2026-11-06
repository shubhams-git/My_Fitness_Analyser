import { CloudError } from './supabase.mjs';

const number=v=>v==null?null:Number(v);
export async function ownerRows(api,table,select='*',extra=''){
  const result=[];
  for(let offset=0;offset<10000;offset+=200){
    const rows=await api.json(`/rest/v1/${table}?owner_id=eq.${api.config.owner}&select=${select}&limit=200&offset=${offset}${extra?'&'+extra:''}`);
    if(!Array.isArray(rows))throw new CloudError(503,'Your training record could not be read.');
    result.push(...rows);if(rows.length<200)return result;
  }
  throw new CloudError(413,'This record needs paginated loading. Your saved data is intact.');
}
export function projectActivities(rows,sources,accounts,segments){
  const sourceById=new Map(sources.map(s=>[s.id,s])),accountById=new Map(accounts.map(a=>[a.id,a]));
  return rows.map(row=>{
    const source=sourceById.get(row.selected_source_id),provider=accountById.get(source?.source_account_id)?.provider;
    if(!source||!provider)throw new CloudError(503,'A saved activity is missing its accepted source.');
    const screenshot=['nike-run-club','strava'].includes(provider);
    const splits=segments.filter(s=>s.activity_id===row.id&&s.source_id===row.selected_source_id&&s.kind==='provider-kilometre-split').sort((a,b)=>a.sequence-b.sequence).map(s=>({index:s.sequence,displayedDistanceKm:number(s.distance_m)/1000,distanceM:number(s.distance_m),paceSecondsPerKm:number(s.pace_s_per_km),deltaSecondsPerKm:number(s.pace_delta_s_per_km),elevationChangeM:number(s.elevation_net_m),approximate:number(s.distance_m)!==1000}));
    const full=splits.filter(s=>s.distanceM===1000),delta=full.length>=2?Math.abs(full[1].paceSecondsPerKm-full[0].paceSecondsPerKm):null;
    return {id:row.id,title:row.title,date:row.local_date,time:row.local_start?.slice(0,5)||null,startInstant:row.start_instant,timePrecision:row.time_precision,sport:row.sport==='running'?'Run':row.sport==='walking'?'Walk':row.sport,source:provider==='nike-run-club'?'Nike Run Club':provider==='strava'?'Strava':provider,
      device:screenshot?'Screenshot import':'Recorded activity',synthetic:false,canonical:true,canSaveFeedback:row.sport==='running',legacyAliases:row.legacy_aliases||[],sourceHash:source.revision_sha256,
      distance:number(row.distance_m),running:number(row.running_s),timer:number(row.timer_s),moving:number(row.moving_s),elapsed:number(row.elapsed_s),displayedPace:number(row.average_pace_s_per_km),fastestPace:number(row.fastest_pace_s_per_km),hr:number(row.average_hr_bpm),maxHr:number(row.max_hr_bpm),cadence:number(row.average_cadence_spm),calories:number(row.calories_kcal),elevationGain:number(row.elevation_gain_m),elevationLoss:number(row.elevation_loss_m),records:[],blocks:[],laps:[],splits,blockLabel:'Kilometre splits',coverage:row.coverage,sourceFile:screenshot?'Owner-supplied screenshots':'Stored source summary',sourceIssues:row.quality_flags||[],sourceNote:null,
      observation:{title:delta===null?'Your recorded effort, preserved.':delta===0?'Your first two kilometres matched in pace.':`Your first two kilometres were ${delta} seconds apart in pace.`,evidence:delta===null?'Distance, displayed pace and recorded time are available for this session.':'Compared the two displayed full-kilometre split paces.',method:'Source screenshot summary and rounded split values. No physiological or progress claim inferred.',version:'screenshot-read-model-v1'}};
  });
}
export async function activityEvidence(api){
  const [rows,sources,accounts,segments,feedback]=await Promise.all([
    ownerRows(api,'activities','*','order=local_date.desc,id'),
    ownerRows(api,'activity_sources','id,activity_id,source_account_id,revision_sha256'),
    ownerRows(api,'source_accounts','id,provider'),ownerRows(api,'activity_segments'),ownerRows(api,'activity_feedback_latest')
  ]);
  return {activities:projectActivities(rows,sources,accounts,segments),feedback:Object.fromEntries(feedback.map(f=>[f.activity_id,{...f.state,revision:Number(f.revision)}]))};
}
