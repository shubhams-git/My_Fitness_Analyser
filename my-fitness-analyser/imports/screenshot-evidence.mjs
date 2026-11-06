import { createHash } from 'node:crypto';

export const SCREENSHOT_ADAPTER='reviewed-screenshot-v1';
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export const md5=bytes=>createHash('md5').update(bytes).digest('hex');
export function stableId(key){const h=createHash('sha1').update(Buffer.from('6ba7b8109dad11d180b400c04fd430c8','hex')).update(key).digest('hex').slice(0,32).split('');h[12]='5';h[16]=((parseInt(h[16],16)&3)|8).toString(16);const s=h.join('');return `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`;}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const date=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
const time=value=>/^([01]\d|2[0-3]):[0-5]\d$/.test(value);
function requireThat(condition,message){if(!condition)throw new Error(message);}
const fields={distance:['distance_m','Distance','m'],pace:['average_pace_s_per_km','Avg. Pace','s/km'],fastest:['fastest_pace_s_per_km','Fastest Pace','s/km'],running:['running_s','Running Time','s'],elapsed:['elapsed_s','Elapsed Time','s'],calories:['calories_kcal','Est. Calories','kcal'],cadence:['average_cadence_spm','Avg. Cadence','steps/min'],gain:['elevation_gain_m','Elevation Gain','m'],loss:['elevation_loss_m','Elevation Loss','m']};
const paceText=s=>`${Math.floor(s/60)}'${String(s%60).padStart(2,'0')}''`;
const durationText=s=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

export function validateReview(input){
  requireThat(input.version===1&&input.cutoff==='2026-07-01','Unsupported review version or history boundary');
  requireThat(date(input.reviewedAt)&&typeof input.yearEvidence==='string'&&input.yearEvidence.length>0,'Review/year evidence required');
  requireThat(Array.isArray(input.files)&&input.files.length>0&&input.files.length<=500,'Evidence files required');
  requireThat(Array.isArray(input.runs)&&input.runs.length>0&&input.runs.length<=200,'Reviewed runs required');
  const keys=new Set(),used=new Set();
  for(const r of input.runs){
    requireThat(typeof r.key==='string'&&r.key.length>0&&!keys.has(r.key),'Duplicate or missing logical run key');keys.add(r.key);
    requireThat(date(r.date)&&r.date>=input.cutoff&&r.date.startsWith('2026-'),'Invalid or out-of-scope source date');
    requireThat(typeof r.title==='string'&&r.title.length>0&&r.title.length<200,'Run title required');
    requireThat((r.start==null&&r.end==null)||(time(r.start)&&time(r.end)),'Preserve minute times or leave both unknown');
    for(const k of Object.keys(fields))requireThat(r[k]==null||(Number.isFinite(r[k])&&r[k]>=0),'Invalid metric '+k);
    requireThat(r.distance>0&&r.pace>0&&r.running>0,'Distance, pace and running time required');
    requireThat(r.elapsed==null||r.elapsed>=r.running,'Elapsed time cannot be shorter than running time');
    requireThat(r.hr===null&&r.maxHr===null,'This adapter accepts no measured heart rate from these screenshots');
    requireThat(Array.isArray(r.splits)&&Array.isArray(r.overview)&&r.overview.length>0&&Array.isArray(r.issues),'Splits, overview links and review issues required');
    const refs=[r.summary,r.splitsImage,r.mapImage,...r.overview].filter(x=>x!=null);
    for(const i of refs){requireThat(Number.isInteger(i)&&i>=0&&i<input.files.length,'Unresolved evidence reference');used.add(i);}
    requireThat(r.splits.length===0||r.splitsImage!=null,'Splits need their source image');
    for(const [i,s] of r.splits.entries())requireThat(s.length===5&&s[0]===i+1&&Number.isFinite(s[1])&&s[1]>0&&s[1]<=1&&Number.isFinite(s[2])&&s[2]>0&&(s[3]===null||Number.isFinite(s[3]))&&Number.isFinite(s[4]),'Invalid split or sequence');
    if(r.splits.length)requireThat(Math.abs(r.splits.reduce((sum,s)=>sum+s[1]*1000,0)-r.distance)<=10*r.splits.length,'Split distance outside displayed rounding tolerance');
  }
  requireThat(used.size===input.files.length,'An image was inventoried but not assigned to a run');
  for(const m of input.monthlyAssertions){
    requireThat(/^2026-\d{2}$/.test(m.month)&&Number.isInteger(m.runs)&&m.distanceM>0&&m.paceSecondsPerKm>0,'Invalid month assertion');
    requireThat(input.runs.filter(r=>r.date.startsWith(m.month)).length===m.runs,'Overview run count does not reconcile');
    requireThat(m.assets.every(i=>Number.isInteger(i)&&i>=0&&i<input.files.length),'Invalid monthly evidence');
  }
  return input;
}

export function buildManifest(input,assets){
  validateReview(input);
  requireThat(assets.length===input.files.length,'Incomplete asset inventory');
  for(const [i,a]of assets.entries())requireThat(a.index===i&&/^[0-9a-f]{64}$/.test(a.sha256)&&/^[0-9a-f]{32}$/.test(a.md5)&&a.bytes>0&&!a.originalName.includes('..'),'Invalid asset metadata');
  const reconciliation=input.monthlyAssertions.map(m=>{
    const runs=input.runs.filter(r=>r.date.startsWith(m.month));const sum=runs.reduce((n,r)=>n+r.distance,0);
    return {...m,individualDistanceM:sum,differenceM:m.distanceM-sum,countMatches:runs.length===m.runs,disposition:'Keep displayed monthly and individual figures separately; do not distribute the difference.'};
  });
  return {schema:'fitness-reviewed-screenshots',schemaVersion:1,adapterVersion:SCREENSHOT_ADAPTER,provider:'nike-run-club',cutoff:input.cutoff,reviewedAt:input.reviewedAt,yearEvidence:input.yearEvidence,
    interpretation:{reviewMethod:'Direct visual transcription of every supplied image',timePrecision:'Displayed minute, or date only; no UTC or timezone inferred',distancePrecisionM:10,pacePrecisionSPerKm:1,hr:'Unavailable (-- or 0); not a measured zero',map:'Image evidence only; no GPS/continuous chart series reconstructed',loss:'Positive normalized descent; source display has a minus sign',splitDistance:'NRC row label denotes one kilometre except final partial distance; rounded source assertion',unknowns:'Null; no backfilled sensor data'},assets,
    reconciliation,runs:input.runs.map(r=>{
      const evidence={};const summary=r.summary==null?r.overview:[r.summary];
      for(const [k,[column,label,unit]]of Object.entries(fields))evidence[column]={images:summary.map(i=>assets[i].sha256),label:r.summary==null&&k==='running'?'Time':label,unit,value:r[k]??null,display:r[k]==null?null:k==='distance'?(r[k]/1000).toFixed(2)+' km':k==='pace'||k==='fastest'?paceText(r[k])+' /km':k==='running'||k==='elapsed'?durationText(r[k]):k==='loss'?'-'+r[k]+' m':k==='gain'?'+'+r[k]+' m':String(r[k]),precision:k==='distance'?10:1};
      evidence.local_date={images:summary.map(i=>assets[i].sha256),display:r.date,yearEvidence:input.yearEvidence};
      evidence.local_start={images:r.summary==null?[]:[assets[r.summary].sha256],display:r.start??null,precision:r.start?'minute':'date'};
      evidence.local_end={images:r.summary==null?[]:[assets[r.summary].sha256],display:r.end??null,precision:r.end?'minute':'date'};
      evidence.title={images:r.overview.map(i=>assets[i].sha256),display:r.title};
      evidence.average_hr_bpm={images:r.summary==null?[]:[assets[r.summary].sha256],display:r.summary==null?null:'--',value:null};
      evidence.max_hr_bpm={...evidence.average_hr_bpm};
      evidence.splits={images:r.splitsImage==null?[]:[assets[r.splitsImage].sha256],values:r.splits.map(s=>({row:String(s[1]===1?s[0]:s[1]),pace:paceText(s[2]),delta:s[3]===null?null:(s[3]<0?'-':'+')+paceText(Math.abs(s[3])),elevation:s[4]+' m'}))};
      if(r.mapImage!=null)evidence.mapReadout={images:[assets[r.mapImage].sha256],...r.mapReadout,elevationMeaning:'Displayed map-panel readout; not maximum elevation'};
      return {...r,fieldEvidence:evidence,evidence:[...new Set([r.summary,r.splitsImage,r.mapImage,...r.overview].filter(x=>x!=null))].map(i=>({sha256:assets[i].sha256,role:i===r.summary?'summary':i===r.splitsImage?'splits':i===r.mapImage?'map':'overview'}))};
    })};
}

export function buildPublication(manifest,manifestBytes,owner){
  requireThat(uuid.test(owner),'Invalid owner UUID');
  requireThat(sha256(manifestBytes)===sha256(JSON.stringify(manifest,null,2)+'\n'),'Manifest bytes must be canonical');
  const manifestHash=sha256(manifestBytes),accountId=stableId(owner+':nike-run-club:screenshots'),runId=stableId(owner+':screenshot-batch:'+manifestHash);
  const assetRow=(a)=>({owner_id:owner,id:stableId(owner+':asset:'+a.sha256),sha256:a.sha256,bucket_id:'fitness-private',object_key:`${owner}/evidence/${a.sha256}.${a.extension}`,media_type:a.mediaType,byte_length:a.bytes,md5:a.md5,verification:'storage-size-and-etag',metadata:{originalName:a.originalName,group:a.group??null}});
  const assets=manifest.assets.map(assetRow),manifestAsset=assetRow({sha256:manifestHash,extension:'json',mediaType:'application/json',bytes:Buffer.byteLength(manifestBytes),md5:md5(manifestBytes),originalName:'manifest.json'});assets.push(manifestAsset);
  const tables={source_accounts:[{owner_id:owner,id:accountId,provider:'nike-run-club',account_key:'owner-reviewed-screenshots',capabilities:{summaries:true,splits:true,sensorStreams:false}}],raw_assets:assets,
    ingestion_runs:[{owner_id:owner,id:runId,source_account_id:accountId,adapter_version:SCREENSHOT_ADAPTER,manifest_sha256:manifestHash,manifest_asset_id:manifestAsset.id,status:'committed',scope:{from:manifest.cutoff,kind:'owner-supplied-screenshot-batch',reviewedAt:manifest.reviewedAt},reconciliation:manifest.reconciliation,completed_at:new Date().toISOString()}],activities:[],activity_sources:[],activity_source_assets:[],activity_segments:[],ingestion_items:[],record_changes:[]};
  for(const r of manifest.runs){
    const activityId=stableId(owner+':nrc:'+r.key),revisionHash=sha256(JSON.stringify(r)),sourceId=stableId(owner+':nrc-source:'+r.key+':'+revisionHash);
    const coverage={summary:true,splits:r.splits.length>0,overviewOnly:r.summary==null,hr:false,gps:false,continuousPace:false,sourcePrecision:'screenshot-rounded'};
    const activity={owner_id:owner,id:activityId,sport:'running',title:r.title,local_date:r.date,start_instant:null,local_start:r.start??null,local_end:r.end??null,time_precision:r.start?'minute':'date',timezone_name:null,timezone_evidence:'Not visible in supplied screenshot',timer_s:null,moving_s:null,average_hr_bpm:null,max_hr_bpm:null,selected_source_id:sourceId,revision:1,legacy_aliases:r.legacyAlias?[r.legacyAlias]:[],coverage,quality_flags:r.issues};
    for(const[k,[column]]of Object.entries(fields))activity[column]=r[k]??null;
    tables.activities.push(activity);
    tables.activity_sources.push({owner_id:owner,id:sourceId,activity_id:activityId,source_account_id:accountId,entity_key:r.key,revision_sha256:revisionHash,ingestion_run_id:runId,adapter_version:SCREENSHOT_ADAPTER,source_values:r,field_evidence:r.fieldEvidence,review:{status:'accepted-visible-values',method:'Direct visual review',reviewedAt:manifest.reviewedAt,yearEvidence:manifest.yearEvidence,issues:r.issues},supersedes_id:null});
    for(const e of [...r.evidence,{sha256:manifestHash,role:'extraction-manifest'}])tables.activity_source_assets.push({owner_id:owner,source_id:sourceId,asset_id:assets.find(a=>a.sha256===e.sha256).id,evidence_role:e.role});
    for(const s of r.splits)tables.activity_segments.push({owner_id:owner,id:stableId(sourceId+':split:'+s[0]),activity_id:activityId,source_id:sourceId,kind:'provider-kilometre-split',sequence:s[0],distance_m:s[1]*1000,distance_precision_m:10,duration_s:null,pace_s_per_km:s[2],pace_delta_s_per_km:s[3],elevation_net_m:s[4],source_values:{rowLabel:s[1]===1?String(s[0]):String(s[1]),displayed:r.fieldEvidence.splits.values[s[0]-1],evidenceSha256:r.fieldEvidence.splits.images[0],distanceIsRounded:true}});
    tables.ingestion_items.push({owner_id:owner,id:stableId(runId+':item:'+r.key),ingestion_run_id:runId,entity_key:r.key,source_revision_id:sourceId,domain:'activity',outcome:r.summary==null?'overview_only':'committed',attempts:1,details:{coverage,issues:r.issues}});
    tables.record_changes.push({owner_id:owner,id:stableId(sourceId+':accept'),activity_id:activityId,source_id:sourceId,action:'accept-reviewed-screenshot',actor:'owner-authorized-import',details:{legacyAliases:activity.legacy_aliases,originalFolder:r.group??null,issues:r.issues,matching:'Distinct source date/time/metrics visually reconciled; no date-only automatic merge'}});
  }
  return {version:1,owner,manifestHash,tables};
}

const literal=value=>"'"+JSON.stringify(value).replaceAll("'","''")+"'::jsonb";
// No writes to v1 state or check-ins. Replays are no-ops. A revised existing
// canonical activity needs a separately reviewed optimistic update, never a
// last-write-wins import. All originals must exist with matching size/ETag.
export function publicationSQL(bundle){
  requireThat(uuid.test(bundle.owner),'Invalid owner UUID');
  requireThat(Object.keys(bundle.tables).join()===['source_accounts','raw_assets','ingestion_runs','activities','activity_sources','activity_source_assets','activity_segments','ingestion_items','record_changes'].join(),'Unknown publication tables');
  let guard='$guard_'+sha256(JSON.stringify(bundle)).slice(0,16)+'$';while(JSON.stringify(bundle).includes(guard))guard=guard.slice(0,-1)+'x$';
  let sql=`begin;\nset local standard_conforming_strings=on;\nset local lock_timeout='5s';\nset local statement_timeout='30s';\nselect pg_advisory_xact_lock(hashtext('${bundle.owner}:screenshot-import'));\n`;
  sql+=`do ${guard} begin\nif not exists(select 1 from public.fitness_owners where owner_id='${bundle.owner}') then raise exception 'Owner is not allowlisted'; end if;\n`;
  // Supabase dashboard uses resumable single-part multipart uploads even for
  // small files: their ETag is MD5(binary part MD5) + '-1', not file MD5.
  // Unknown/multi-part/encrypted opaque ETags fail closed and need download
  // verification; do not simply strip the suffix or accept arbitrary ETags.
  sql+=`if exists(select 1 from jsonb_populate_recordset(null::public.raw_assets,${literal(bundle.tables.raw_assets)}) a left join storage.objects o on o.bucket_id=a.bucket_id and o.name=a.object_key where o.name is null or (o.metadata->>'size')::bigint is distinct from a.byte_length or lower(trim(both '"' from coalesce(o.metadata->>'eTag',o.metadata->>'etag',''))) not in (a.md5,md5(decode(a.md5,'hex'))||'-1')) then raise exception 'Original upload missing or size/ETag mismatch'; end if;\n`;
  sql+=`if exists(select 1 from jsonb_populate_recordset(null::public.activities,${literal(bundle.tables.activities)}) n join public.activities a using(owner_id,id) where a.selected_source_id<>n.selected_source_id) then raise exception 'Existing activity has another accepted revision; explicit review required'; end if;\nend ${guard};\n`;
  for(const [table,rows]of Object.entries(bundle.tables)){
    requireThat(rows.length>0,'Empty publication table '+table);
    const columns=Object.keys(rows[0]);requireThat(columns.every(c=>/^[a-z][a-z0-9_]*$/.test(c))&&rows.every(row=>row.owner_id===bundle.owner&&Object.keys(row).join()===columns.join()),'Inconsistent row fields or ownership');
    sql+=`insert into public.${table} (${columns.join(',')}) select ${columns.join(',')} from jsonb_populate_recordset(null::public.${table},${literal(rows)}) on conflict do nothing;\n`;
  }
  sql+=`commit;\nselect count(*) as imported_runs, count(*) filter(where coverage->>'overviewOnly'='true') as overview_only, (select count(*) from public.activity_segments where owner_id='${bundle.owner}') as splits, (select count(*) from public.raw_assets where owner_id='${bundle.owner}') as archived_assets from public.activities where owner_id='${bundle.owner}';\n`;
  return sql;
}

// Compare typed SQL rows to the portable publication, including all source
// values/evidence and nullable fields. Server creation timestamps are excluded.
export function verificationSQL(bundle){
  publicationSQL(bundle); // Reuse table/column/owner validation.
  const checks=Object.entries(bundle.tables).map(([table,rows])=>{
    const keys=table==='activity_source_assets'?['owner_id','source_id','asset_id']:['owner_id','id'];
    return `select '${table}' as table_name,count(*)::int as expected_rows,count(a.owner_id)::int as stored_rows,bool_and((to_jsonb(a)-'created_at')=(to_jsonb(e)-'created_at')) as exact_match from jsonb_populate_recordset(null::public.${table},${literal(rows)}) e left join public.${table} a on ${keys.map(k=>'a.'+k+'=e.'+k).join(' and ')}`;
  });
  return checks.join('\nunion all\n')+';\n';
}
