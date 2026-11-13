import {activityKind} from './activity-kind.js';
import { distributionMarkup } from './effort-distribution.js';
import { seriesChart,metricValue,metricHeadline,MEASURES } from './activity-analysis.js';
import { activityChartPanel,metricSvg,metricText } from './activity-visuals.js';
import { logout,privateResponse as apiFetch,refreshView } from './session.js';
import { fieldNotesView } from './field-notes.js';
import { mountPremiumMotion } from './premium-motion.js';
import { routeView } from './route-view.js';
import { geographicRoute } from './route-geometry.js';
import { mountRouteMaps } from './route-maps.js';
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths = { play:'m9 5 11 7-11 7V5Z', arrow:'m5 12 14 0m-6-6 6 6-6 6', back:'m14 5-7 7 7 7', close:'m6 6 12 12M6 18 18 6', plus:'M12 5v14M5 12h14', minus:'M5 12h14', layers:'m3 8 9-5 9 5-9 5-9-5Zm0 5 9 5 9-5m-18 5 9 5 9-5', route:'M5 18c0-6 14-3 14-10M5 18h.01M19 6h.01', clock:'M12 8v5l3 2m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0', check:'m5 12 4 4L19 6', menu:'M4 7h16M4 12h16M4 17h16', heart:'M20.5 5.5a5 5 0 0 0-7 0L12 7l-1.5-1.5a5 5 0 0 0-7 7L12 21l8.5-8.5a5 5 0 0 0 0-7Z', info:'M12 11v6m0-10h.01m9 5a9 9 0 1 1-18 0 9 9 0 0 1 18 0', chevron:'m9 5 7 7-7 7', chevrondown:'m5 9 7 7 7-7', target:'M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5', journal:'M5 3h14v18H5zM9 7h6m-6 5h6m-6 5h3', logout:'M14 4H5v16h9m-3-8h10m-4-4 4 4-4 4', cloud:'M7 18a5 5 0 1 1 0-10 6 6 0 0 1 11-1 5 5 0 0 1 0 11', refresh:'M20 11a8 8 0 0 0-14-5L3 9m0-5v5h5m-4 4a8 8 0 0 0 14 5l3-3m0 5v-5h-5', mountain:'m2 20 7-14 5 8 3-5 5 11H2Z', flag:'M6 21V3h12l-3 5 3 5H6', settings:'M4 7h16M4 17h16M9 4v6m6 4v6' };
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.info}"/></svg>`;
const duration = seconds => seconds == null ? '—' : `${Math.floor(Math.round(seconds)/60)}:${String(Math.round(seconds)%60).padStart(2,'0')}`;
const paceText = seconds => seconds == null || !Number.isFinite(seconds) || seconds>3600 ? '—' : duration(seconds);
const distance = metres => metres == null ? '—' : (metres/1000).toFixed(2);
const dateText = date => date ? new Date(date+'T12:00:00Z').toLocaleDateString('en-AU',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}) : 'Date to confirm';
const round = value => value == null ? '—' : String(Math.round(value));
export function mountActivity({root,data,signal,navigate,toggleMotion}){
root.innerHTML='<div id="app"></div><div id="dialogs"></div><div id="announcer" class="sr-only" role="status" aria-live="polite"></div>';
const $=(selector,scope=root)=>scope.querySelector(selector);
const $$=(selector,scope=root)=>[...scope.querySelectorAll(selector)];
const params=new URLSearchParams(location.search);
const archiveQuery=new URLSearchParams(params.get('from')||'');
const archiveParams=new URLSearchParams({view:'sessions'});
if(archiveQuery.get('window')==='all')archiveParams.set('window','all');
if(['run','other'].includes(archiveQuery.get('type')))archiveParams.set('type',archiveQuery.get('type'));
if(/^\d{1,5}$/.test(archiveQuery.get('shown')||''))archiveParams.set('shown',archiveQuery.get('shown'));
const reducedMotion=()=>document.documentElement.classList.contains('reduce-motion')||matchMedia('(prefers-reduced-motion:reduce)').matches;
const state = {direction:'field-notes',scenario:params.get('scenario')||'normal',activityId:params.get('activity')||null,selected:null,expandedBlocks:false,series:'pace',chartAxis:'distance',fullPaceRange:false,cursor:null,zoom:1,feedbackError:'',pending:false};
let payload=data, activity, draft, premiumMotion, routeMaps, satelliteReplay, savingFeedback=false;
let syncingGarmin=false;
async function syncGarmin(){
  if(syncingGarmin)return;syncingGarmin=true;const button=$('[data-action="sync-garmin"]'),status=$('#library-status');if(button){button.disabled=true;button.textContent='Syncing Garmin…';}if(status)status.textContent='Fetching activities from Garmin…';
  try{const response=await apiFetch('/api/garmin/sync',{method:'POST'}),result=await response.json();if(signal.aborted)return;payload=await refreshView('/api/data?activity=','activity',{force:true});if(signal.aborted)return;const next=activity.provider&&payload.activities.some(row=>row.id===activity.id)?activity.id:payload.defaultId;
   if(next)setActivity(next);
   const out=$('#library-status');if(out)out.textContent=result.error||`${result.imported||0} added · ${result.updated||0} updated · ${result.unchanged||0} unchanged · ${result.skipped||0} unsupported · ${result.failed||0} failed.${result.complete?' Sync complete.':' '+(result.errors?.[0]?.message||'Retry sync to continue.')}`;}
  catch{const out=$('#library-status');if(out)out.textContent='Sync could not finish. Your saved activities are still available; try again.';}
  finally{syncingGarmin=false;const b=$('[data-action="sync-garmin"]');if(b){b.disabled=false;b.textContent='Sync Garmin';}}
}
const savedActivity=()=>payload.localLibrary&&(activity.canSaveFeedback===true||activity.parserVersion==='fit-local-v1');
const legacyEvidence=new Map([['nrc',[4,5,6]],['strava',[1,2,3]]]);
const previewEvidence=()=>!payload.cloudLibrary&&activity.sourceFile==='Owner-supplied screenshots'?(legacyEvidence.get(activity.id)||[]):[];
const storageCopy=()=>payload.cloudLibrary?'your private online library':'the private library on this computer';
let routeCache={records:null,value:null},chartCache={records:null,value:null,series:null,width:null},pointerFrame=0,pointerX=0;
const emptyDraft = () => ({answers:{effort:null,breathing:null,discomfort:null,finish:null},location:null,note:'',context:[],complete:false,pending:false});
const draftKey=()=>payload.cloudLibrary?'mfa-private:'+payload.viewer.id+':draft:'+activity.id:'mfa-prototype:'+activity.id;
function readDraft() {try{const local=JSON.parse(localStorage.getItem(draftKey())||'null'),saved=payload.feedback?.[activity.id];return {...emptyDraft(),...(local?.complete===false&&(!saved||local.revision===saved.revision)?local:saved||local)};}catch{return {...emptyDraft(),...payload.feedback?.[activity.id]};}}
function storeDraft() {try{localStorage.setItem(draftKey(),JSON.stringify(draft));}catch{$('#announcer').textContent='Browser storage is unavailable. Keep this preview open to retain your answers.';}}
function currentActivity() {const original=payload.activity||payload.activities.find(x=>x.id===state.activityId)||payload.activities.find(x=>x.id===payload.defaultId)||{id:'empty-library',title:'Your training',sport:'Run',date:null,distance:null,timer:null,moving:null,elapsed:null,hr:null,maxHr:null,elevationGain:null,records:[],blocks:[],laps:[],splits:[],source:'Your private library',sourceIssues:[],observation:{title:'Your first session starts here.',evidence:'Sync Garmin or import an activity.'}};return state.scenario==='partial'?{...original,hr:null,maxHr:null,records:original.records.map(r=>({...r,hr:null,lat:null,lon:null})),blocks:original.blocks.map(b=>({...b,hr:null}))}:original;}
function setActivity(id){
 const url=new URL(location.href);
 if(id)url.searchParams.set('activity',id);
 else url.searchParams.delete('activity');
 url.hash='';
 navigate(url,{reload:id===state.activityId});
}
function summaryPace(){return activity.displayedPace??(activity.distance>=10&&Number.isFinite(activity.timer)&&activity.timer>0?activity.timer/activity.distance*1000:null);}
function metric(value,unit,label,small=''){return `<div class="metric"><div class="metric-value">${value}<span>${unit}</span></div><div class="metric-label">${label}</div>${small?`<div class="metric-hint">${small}</div>`:''}</div>`;}
function stats(){if(activityKind(activity)!=='run'){const time=activity.timer??activity.moving??activity.elapsed??activity.running;return `<section class="metric-rail" aria-label="Workout summary">${metric(duration(time),'','Recorded time')}</section>`;}return `<section class="metric-rail" aria-label="Session summary">${metric(distance(activity.distance),'km','Distance')}${metric(duration(activity.timer??activity.running??activity.moving),'',activity.timer!=null?'Timer time':activity.running!=null?'Running time':'Moving time')}${metric(paceText(summaryPace()),'/km','Average pace')}${metric(round(activity.hr),'bpm','Average heart rate',activity.hr==null?'Not recorded':'')}${metric(round(activity.elevationGain),'m','Elevation gain')}</section>`;}
function routeGeometry(){
  if(activityKind(activity)!=='run')return null;
  if(routeCache.records===activity.records)return routeCache.value;
  const value=geographicRoute(activity.records);
  routeCache={records:activity.records,value:value.points.length?value:null};return routeCache.value;
}
function mapView(name='main'){
  const g=routeGeometry();if(!g)return '';
  return routeView(g,activity.records,state,name,state.selected===null?null:activity.blocks[state.selected],state.cursor===null?null:activity.records[state.cursor],state.selected===null?null:activity.blocks[state.selected]);
}
function routePanel(){
  const hasGPS=Boolean(routeGeometry());
  return `<section class="route-panel ${hasGPS?'':'route-unavailable'}" aria-label="Activity route"><div class="map-topline"><span>${icon('route')} ${hasGPS?'Recorded route':'Route'}</span><button class="icon-button" data-action="source" aria-label="Route source and method">${icon('info')}</button></div>${hasGPS?`<div class="route-svg">${mapView()}</div><div class="map-bottom"><span class="map-legend"><i></i>Start <b></b>Finish</span><span class="route-selection">${state.selected===null?'Full activity':`Time block ${state.selected+1}`}</span><div class="map-controls"><button class="icon-button" data-action="zoom-out" aria-label="Zoom route out">${icon('minus')}</button><button class="icon-button" data-action="zoom-in" aria-label="Zoom route in">${icon('plus')}</button><button class="icon-button" data-action="fit-route" aria-label="Fit full route">${icon('target')}</button></div></div><span class="route-caption">Drag to explore · Ctrl / ⌘ + scroll to zoom · Two fingers on touch</span>`:`<div class="no-route-visual">${icon('route')}<h3>${activity.sourceFile==='Owner-supplied screenshots'?'No GPS in this import':'No GPS recorded'}</h3><p>${activity.sourceFile==='Owner-supplied screenshots'?'Your summary and splits are preserved from the screenshots.':'Your session details still have their place.'}</p></div>`}</section>`;
}
function observationPanel(){return `<section class="observation"><div class="section-kicker">${icon('journal')} Session observation</div><h2>${escape(activity.observation.title)}</h2><p>${escape(activity.observation.evidence)}</p><button class="text-button" data-action="method">How this is calculated ${icon('plus')}</button></section>`;}
function quickCard(){const count=Object.values(draft.answers).filter(x=>x!==null).length;return `<section class="quick-card"><div class="quick-title">${icon('journal')}<span>Your check-in</span><span class="answer-count">${draft.complete?'Complete':`${count} / 4`}</span></div><h2>${draft.complete?'The context is yours.':'How did it feel?'}</h2><p>Effort, breathing, discomfort and finish.<br>A little context for the next run.</p><button class="primary-button" data-action="checkin">${draft.complete?'Edit check-in':'Quick check-in'} ${icon(draft.complete?'check':'arrow')}</button><span class="small-copy">Usually about 30 seconds</span></section>`;}
function seriesValue(row){return metricValue(row,state.series);}
const seriesName=()=>MEASURES[state.series].label;
function chartReadout(){const block=state.selected===null?null:activity.blocks[state.selected],headline=metricHeadline(activity,state.series),value=block&&state.series==='pace'?block.pace:block&&state.series==='heart'?block.hr:headline.value;return {time:block?`${duration(block.start)} – ${duration(block.end)}`:headline.label,value:metricText(value,state.series)+' '+MEASURES[state.series].unit};}
function chartModel(){
 const key=[state.series,state.chartAxis,state.fullPaceRange,innerWidth].join('|');
 if(chartCache.records===activity.records&&chartCache.key===key)return chartCache.value;
 const value=seriesChart(activity,{kind:state.series,axis:state.chartAxis,full:state.fullPaceRange,width:innerWidth<=600?Math.max(300,innerWidth-32):630});chartCache={records:activity.records,key,value};return value;
}
function chartSvg(){return metricSvg(chartModel(),state.series,state.cursor===null?null:activity.records[state.cursor],state.selected===null?null:activity.blocks[state.selected]);}
function analysisPanel(){
 const available=Object.keys(MEASURES).filter(k=>(k!=='pace'||activity.distance>=10)&&activity.records.some(r=>metricValue(r,k)!==null));if(!available.includes(state.series))state.series=available[0]||'pace';
 return activityChartPanel(activity,state,chartModel(),chartSvg(),distributionMarkup(activity,{kind:state.series,versions:payload.zoneVersions||[]}));
}
function blocksPanel(){
  const historical=activity.records.length===0;
  const rows=historical?activity.splits||[]:activity.blocks;
  const body=rows.map((row,i)=>{
    const p=historical?row.paceSecondsPerKm:row.distance>=10?row.pace:null;
    const d=historical?(row.distanceM??row.displayedDistanceKm*1000):row.distance;
    const time=historical?(row.displayedDistanceKm===1||row.distanceM===1000?String(row.index??i+1):'Final'):`${duration(row.start)}<small>to ${duration(row.end)}</small>`;
    const label=`Block ${i+1}, ${duration(row.start)} to ${duration(row.end)}, ${d==null?'distance unavailable':Math.round(d)+' metres'}, pace ${paceText(p)} per kilometre, heart rate ${row.hr==null?'unavailable':round(row.hr)+' bpm'}`;
    return `<div class="block-row ${!historical&&state.selected===i?'selected':''}" role="row" ${!historical&&i>=6&&!state.expandedBlocks?'hidden':''} ${historical?'':`data-select-block="${i}"`}><span role="cell">${historical?time:`<button type="button" class="block-choice" data-block="${i}" aria-pressed="${state.selected===i}" aria-label="${label}">${time}</button>`}</span><span role="cell">${historical&&(row.approximate||row.distanceM===null)?'≈ ':''}${d==null?'—':Math.round(d)}<small>m</small></span><span role="cell" class="block-pace">${paceText(p)}<i class="pace-bar" style="--bar:${p?Math.max(15,Math.min(100,100-(p-300)/8)):15}%"></i></span><span role="cell">${historical?row.elevationChangeM:round(row.hr)}<small>${historical?'m':'bpm'}</small></span></div>`;
  }).join('');
  return `<section class="blocks-panel section" aria-labelledby="blocks-title"><div class="section-heading"><div><p class="section-caption">${historical?'From your screenshots':'Explore the recorded effort'}</p><h2 id="blocks-title">${historical?'Your splits':activity.blockLabel==='1-minute blocks'?'Minute by minute':'Time blocks'}</h2></div>${!historical?`<button class="text-button" data-action="clear-selection">Full activity</button>`:''}</div><p class="table-note">${historical?'Displayed kilometre paces. Final distance is rounded.':`${activity.blockLabel}. Select a row to link the route and chart.`}</p>${!historical&&rows.length>6?`<button class="text-button expand-blocks" data-action="expand-blocks" aria-expanded="${state.expandedBlocks}">${state.expandedBlocks?'Show fewer blocks':`Show all ${rows.length} blocks`}</button>`:''}<div class="block-table" role="table" aria-label="${historical?'Screenshot kilometre splits':'Sampled time blocks'}"><div class="block-row table-header" role="row"><span role="columnheader">${historical?'Kilometre':'Time'}</span><span role="columnheader">Distance</span><span role="columnheader">Pace /km</span><span role="columnheader">${historical?'Elev.':'HR¹'}</span></div>${body}</div>${!historical?`<p class="table-footnote">¹ Mean of available HR samples in each block.</p><details class="recorded-laps"><summary>Recorded laps <span>${activity.laps.length}</span>${icon('chevrondown')}</summary>${activity.laps.map((lap,i)=>`<div><span>Lap ${i+1}</span><strong>${distance(lap.distance)} km</strong><span>${duration(lap.duration)}</span></div>`).join('')}<p>Device laps; these need not be kilometre splits.</p></details>`:''}</section>`;
}
function sourceNote(){return activity.sourceNote?`<section class="source-note"><span class="section-kicker">Your original note</span><blockquote>${escape(activity.sourceNote)}</blockquote><p>From ${escape(activity.source)} · ${dateText(activity.date)}</p></section>`:'';}
const options={effort:Array.from({length:10},(_,i)=>[String(i+1),String(i+1)]),breathing:[['sentences','Sentences'],['phrases','Phrases'],['few-words','Few words']],discomfort:[['none','None'],['mild','Mild'],['affected','Affected the run']],finish:[['plenty','Plenty left'],['right','About right'],['limit','Near limit']]};
function question(name,title,description,number){return `<fieldset class="question" data-question="${name}"><legend><span class="question-number">${number}</span>${title}</legend>${description?`<p class="question-helper">${description}</p>`:''}<div class="choice-grid ${name==='effort'?'effort-grid':''}">${options[name].map(([value,label])=>`<label class="choice"><input type="radio" name="${name}" value="${value}" ${String(draft.answers[name])===value?'checked':''}><span>${name==='discomfort'&&value==='affected'&&activity.sport==='Walk'?'Affected the walk':label}</span></label>`).join('')}</div>${name==='effort'?'<div class="scale-labels"><span>Very easy</span><span>Maximum</span></div>':''}<p class="question-error" id="error-${name}"></p></fieldset>`;}
function feedbackForm(){
  if((draft.complete&&!['offline','save-error'].includes(state.scenario))||state.scenario==='success')return `<div class="checkin-complete"><span class="completion-symbol">${icon('check')}</span><p class="section-caption">${state.scenario==='success'?'Example completion state':'Your perspective, added'}</p><h2>${savedActivity()?'Check-in saved.':'Check-in preview complete.'}</h2><p>${savedActivity()?'Saved to '+storageCopy()+'. Export your library to keep a backup.':'Your activity data is unchanged. This demonstration stays in your browser.'}</p><button class="secondary-button" data-action="edit-feedback">Edit answers ${icon('arrow')}</button></div>`;
  const count=Object.values(draft.answers).filter(x=>x!==null).length;
  return `<form class="checkin-form" novalidate><div class="checkin-intro"><div><h2>How did this ${activity.sport==='Walk'?'walk':'run'} feel?</h2></div><span class="form-count">${count} of 4</span></div><p class="checkin-helper">Four quick answers. No right or wrong.</p><div class="form-progress" aria-hidden="true">${Object.values(draft.answers).map(x=>`<i class="${x!==null?'answered':''}"></i>`).join('')}</div>${question('effort','Whole-session effort','How hard did the session feel overall?',1)}${question('breathing','Could you hold a conversation?','',2)}${question('discomfort','Any discomfort?','',3)}<fieldset class="location-question question" data-question="location" ${!draft.answers.discomfort||draft.answers.discomfort==='none'?'hidden':''}><legend>Where did you feel it?</legend><div class="choice-grid location-grid">${['Shin','Knee','Ankle','Foot','Hip','Other'].map(label=>`<label class="choice"><input type="radio" name="location" value="${label.toLowerCase()}" ${draft.location===label.toLowerCase()?'checked':''}><span>${label}</span></label>`).join('')}</div><p class="question-error" id="error-location"></p></fieldset>${question('finish','How did you finish?','',4)}<details class="optional-context" ${draft.note||draft.context.length?'open':''}><summary>Add context or a note <span>Optional</span>${icon('plus')}</summary><div class="context-chips">${['Heat','Poor sleep','Busy day','New shoes'].map(label=>`<button type="button" data-context="${label}" aria-pressed="${draft.context.includes(label)}">${label}</button>`).join('')}</div><label class="note-label">Anything else?<textarea name="note" maxlength="500" rows="3" placeholder="A detail you want to remember…">${escape(draft.note)}</textarea></label></details><p class="form-error" role="alert">${escape(state.feedbackError)}</p>${state.pending||draft.pending?`<div class="pending-message" role="status">${icon('cloud')}<div><strong>Pending in this preview</strong><p>Your answers are kept here. Retry to preview completion.</p><button type="button" class="text-button" data-action="retry-feedback">Retry check-in ${icon('refresh')}</button></div></div>`:''}<div class="form-actions"><span>${savedActivity()?(payload.cloudLibrary?'Private online library':'Saved on this computer'):'Browser-only design preview'}</span><button type="submit" class="primary-button">Save check-in ${icon('check')}</button></div></form>`;
}
function inlineCheckin(){return `<section class="inline-checkin section" id="checkin" tabindex="-1">${feedbackForm()}</section>`;}
function connectionBanner(){if(!['expired','delayed','offline'].includes(state.scenario))return '';const text=state.scenario==='expired'?'Garmin connection expired. Imported activities are still here.':state.scenario==='delayed'?'New activities are delayed. Your last import is available.':'Offline preview. Your answers will stay in this browser.';return `<div class="connection-banner" role="status">${icon(state.scenario==='offline'?'cloud':'info')}<p>${text}</p>${state.scenario!=='offline'?`<button class="text-button" data-action="connection">${state.scenario==='expired'?'Review':'Retry'} ${icon('chevron')}</button>`:''}</div>`;}
function specialState(){
  if(state.scenario==='loading')return `<main id="main" class="special-state loading-state"><div class="skeleton long"></div><div class="skeleton title-skeleton"></div><div class="skeleton map-skeleton"></div><div class="skeleton long"></div><p>Loading your activity…</p><button class="secondary-button" data-action="normal">Show activity ${icon('arrow')}</button></main>`;
  if(state.scenario==='empty')return `<main id="main" class="special-state"><div class="empty-symbol">${icon('route')}</div><span class="section-caption">Your training log</span><h1>No activities<br>yet.</h1><p>Bring in an activity to inspect the details<br>and add your check-in.</p><button class="primary-button" data-action="normal">Explore a sample ${icon('arrow')}</button></main>`;
  if(state.scenario==='error')return `<main id="main" class="special-state"><div class="empty-symbol">${icon('cloud')}</div><span class="section-caption">Activity unavailable</span><h1>Let’s try<br>that again.</h1><p>This activity couldn’t load.<br>Your check-in draft is still here.</p><button class="primary-button" data-action="normal">Retry activity ${icon('refresh')}</button></main>`;
  return null;
}
function render(){
  satelliteReplay?.destroy();premiumMotion?.destroy();routeMaps?.destroy();
  if(activity.distance<10&&activity.hr!==null&&state.series==='pace')state.series='heart';if(activity.hr===null&&state.series==='heart')state.series='pace';
  if(signal.aborted)return;document.title=`${activity.title} — My Fitness Analyser`;
  const view=fieldNotesView({activity,archiveUrl:'/training?'+archiveParams,previewLibrary:!payload.cloudLibrary,persisted:savedActivity(),icon,dateText,distance,duration,paceText,summaryPace,escape,routePanel,stats,observationPanel,analysisPanel,blocksPanel,sourceNote,inlineCheckin,miniRoute:mapView('detail')});
  const special=payload.cloudLibrary&&!payload.activities.length?`<main id="main" class="special-state"><h1>Your training<br>starts here.</h1><p>Import an original FIT file, or use Sync Garmin to bring in your activities.</p><a class="primary-button" href="/account">Import an activity</a></main>`:specialState();
  $('#app').innerHTML=`<div class="app-shell"><div class="workspace">${special?view.slice(0,view.indexOf('<main id="main"'))+special:view}${connectionBanner()}</div></div>`;
  $('#dialogs').innerHTML=`<dialog id="detail-dialog" class="detail-dialog"></dialog>`;
  if(payload.localLibrary&&!payload.cloudLibrary)$('.fn-header').insertAdjacentHTML('afterend',`<div class="library-bar"><span>${payload.cloudLibrary?'Your library':'Local alpha'} <small>${payload.cloudLibrary?'Private online access':'Saved on this computer'}</small></span><div><button class="secondary-button" data-action="sync-garmin" ${syncingGarmin?'disabled':''}>Sync Garmin</button><label class="secondary-button import-label">${icon('plus')} Import FIT<input id="fit-import" type="file" accept=".fit" class="sr-only"></label><label class="text-button import-label">Restore<input id="library-restore" type="file" accept=".json" class="sr-only"></label><a class="text-button" href="/api/export" download>Export library ${icon('logout')}</a>${payload.cloudLibrary?'<button class="text-button" data-action="sign-out">Sign out</button>':''}</div><p id="library-status" role="status">${payload.garmin?.lastSuccessAt?'Garmin synced '+new Date(payload.garmin.lastSuccessAt).toLocaleString():payload.garmin?.configured?'Garmin is ready to sync.':''}</p></div>`);
  showSavedCopy();
  if(payload.cloudLibrary&&!payload.activities.length){$$('.activity-tools button').forEach(button=>button.disabled=true);}
  if(routeGeometry())$('.fn-art .map-topline')?.insertAdjacentHTML('beforeend','<button class="text-button" data-action="expand-map">Explore map</button>');
  if(!special&&routeGeometry())routeMaps=mountRouteMaps({records:activity.records,reduced:reducedMotion(),onSelect(index){updateCursor(index);}});
  if(!special)premiumMotion=mountPremiumMotion();
}
function openDetail(title,html){const dialog=$('#detail-dialog');dialog.classList.remove('map-dialog');dialog.setAttribute('aria-label',title);dialog.innerHTML=`<header><h2>${title}</h2><button class="icon-button" data-action="close-dialog" aria-label="Close details">${icon('close')}</button></header><div class="dialog-content">${html}</div>`;dialog.showModal();routeMaps?.prune();}
function showSavedCopy(){if(draft.complete){const action=$('.fn-session-actions [data-action="checkin"]');if(action)action.innerHTML='Edit check-in '+icon('arrow');}if(savedActivity()&&draft.complete)$$('.checkin-complete').forEach(el=>{el.querySelector('h2').textContent='Check-in saved.';el.querySelector('h2+p').textContent='Saved to '+storageCopy()+'. Export your library to keep a backup.';});}
function openCheckin(){const target=$('#checkin');if(!target)return;target.scrollIntoView({behavior:reducedMotion()?'instant':'smooth',block:'start'});target.focus({preventScroll:true});}
function refreshForm(){const form=$('#checkin');if(form)form.innerHTML=feedbackForm();}
function selectBlock(index){state.selected=index;state.cursor=null;updateExploration();$('#announcer').textContent=index===null?'Full activity selected':`Block ${index+1} selected in the route and chart.`;}
function updateExploration(){routeMaps?.update(state.selected===null?null:activity.blocks[state.selected],state.cursor);const chart=$('.chart-canvas');if(chart)chart.innerHTML=chartSvg();$$('[data-block]').forEach(b=>{b.setAttribute('aria-pressed',String(Number(b.dataset.block)===state.selected));b.closest('.block-row').classList.toggle('selected',Number(b.dataset.block)===state.selected);});$$('.route-selection').forEach(selection=>selection.textContent=state.selected===null?'Full activity':`Time block ${state.selected+1}`);const readout=chartReadout();if($('#chart-time'))$('#chart-time').textContent=readout.time;if($('#chart-value'))$('#chart-value').textContent=readout.value;if(chart){chart.setAttribute('aria-valuenow',String(state.cursor??0));chart.setAttribute('aria-valuetext',readout.time+', '+readout.value);}}
function updateCursor(index){
  if(index<0||index>=activity.records.length)return;
  state.cursor=index;const row=activity.records[index],c=chartModel();
  const replayTime=$('#replay-time'),replayPace=$('#replay-pace'),replaySlider=$('#replay-position'),traceCursor=$('.fn-trace-cursor');
  if(replayTime)replayTime.textContent=duration(row.t);
  if(replayPace)replayPace.textContent=(row.speed>0?paceText(1000/row.speed)+' /km':'Pace unavailable');
  if(replaySlider){replaySlider.value=index;replaySlider.setAttribute('aria-valuetext',`${duration(row.t)}, ${replayPace?.textContent}`);}
  if(traceCursor)traceCursor.setAttribute('d',`M${row.t/activity.records.at(-1).t*600} 0V84`);
  const circle=(parent,cls,r)=>{let el=parent.querySelector('.'+cls);if(!el){el=document.createElementNS('http://www.w3.org/2000/svg','circle');el.setAttribute('class',cls);el.setAttribute('r',r);parent.append(el);}return el;};
  routeMaps?.update(state.selected===null?null:activity.blocks[state.selected],index);
  const inspection=$('#map-inspection');if(inspection)inspection.textContent=duration(row.t)+' · '+(row.speed>0?paceText(1000/row.speed)+' /km':'Pace unavailable')+' · '+(row.hr!=null?round(row.hr)+' bpm':'HR unavailable');
  const mapSlider=$('#map-position');if(mapSlider){mapSlider.value=index;mapSlider.setAttribute('aria-valuetext',inspection?.textContent||duration(row.t));}
  const live=$('.chart-live-cursor');if(live&&c){const v=seriesValue(row);if(!Number.isFinite(v)||v<c.min||v>c.max){live.replaceChildren();}else{let line=$('.chart-cursor-line',live);if(!line){line=document.createElementNS('http://www.w3.org/2000/svg','path');line.setAttribute('class','chart-cursor-line');live.append(line);}line.setAttribute('d',`M${c.x(row)} ${c.top}V${c.bottom}`);const dot=circle(live,'chart-cursor-dot',4);dot.setAttribute('cx',c.x(row));dot.setAttribute('cy',c.y(v));}}
  const time=$('#chart-time'),value=$('#chart-value'),slider=$('#chart-position');if(time)time.textContent=(c?.axis==='distance'&&Number.isFinite(row.distance)?((row.distance-activity.records.find(r=>Number.isFinite(r.distance)).distance)/1000).toFixed(2)+' km · ':'')+duration(row.t);if(value)value.textContent=metricText(seriesValue(row),state.series)+' '+MEASURES[state.series].unit;const canvas=$('.chart-canvas');if(canvas){canvas.setAttribute('aria-valuenow',String(index));canvas.setAttribute('aria-valuetext',`${time?.textContent}, ${value?.textContent}`);}if(slider){slider.value=index;slider.setAttribute('aria-valuetext',`${duration(row.t)}, ${value?.textContent}`);}}
function focusFeedbackResult(selector){const form=$('#checkin');const result=form&&$(selector,form);if(result){result.tabIndex=-1;result.focus({preventScroll:true});result.scrollIntoView({block:'center',behavior:'instant'});}}
function markMissing(name,message){
 state.feedbackError=message;
 $$('.form-error').forEach(node=>node.textContent=message);
 const group=$(`[data-question="${name}"]`);
 if(!group)return;
 const error=group.querySelector('.question-error');error.textContent=message;
 group.classList.add('missing');
 group.querySelectorAll('input').forEach(field=>{field.setAttribute('aria-invalid','true');field.setAttribute('aria-describedby',error.id);});
 group.querySelector('input')?.focus();
}
async function saveFeedback(){
  if(savingFeedback||!$('#checkin'))return;
  if(['offline','save-error'].includes(state.scenario))draft.complete=false;
  const missing=Object.keys(draft.answers).find(key=>draft.answers[key]===null);
  if(missing){markMissing(missing,'Choose an answer for this question.');return;}
  if(draft.answers.discomfort!=='none'&&!draft.location){markMissing('location','Choose where you felt the discomfort.');return;}
  if(state.scenario==='offline'){draft.pending=true;state.pending=true;state.feedbackError='';storeDraft();refreshForm();focusFeedbackResult('.pending-message');return;}
  if(state.scenario==='save-error'){state.feedbackError='Couldn’t complete the preview. Your answers are still here; try again.';state.scenario='normal';storeDraft();refreshForm();focusFeedbackResult('.form-error');return;}
  if(savedActivity()){
    const saveId=activity.id;const form=$('#checkin form');savingFeedback=true;
    form?.setAttribute('aria-busy','true');
    if(form){for(const field of form.elements)field.disabled=true;form.querySelector('[type=submit]').textContent='Saving…';}
    $('#announcer').textContent='Saving check-in…';
    try{
      const response=await apiFetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:saveId,draft})});
      const value=await response.json();if(!response.ok)throw new Error(value.error);
      payload.feedback[saveId]=value;if(signal.aborted||activity.id!==saveId)return;draft=value;
    }catch(e){
      if(signal.aborted||activity.id!==saveId)return;
      state.feedbackError=e.message==='Failed to fetch'?'Couldn’t connect. Your answers are still here; try again.':e.message||'Could not save. Your answers are still here.';
      refreshForm();focusFeedbackResult('.form-error');return;
    }finally{savingFeedback=false;}
  }
  draft.complete=true;draft.pending=false;state.pending=false;state.feedbackError='';storeDraft();refreshForm();showSavedCopy();focusFeedbackResult('.checkin-complete h2');$('#announcer').textContent=savedActivity()?(payload.cloudLibrary?'Check-in saved to your private account.':'Check-in saved to your local library.'):'Check-in preview complete.';
}
root.addEventListener('close',()=>routeMaps?.prune(),true);
root.addEventListener('click',async event=>{

  const block=event.target.closest('[data-block],[data-select-block]');if(block){const index=Number(block.dataset.block??block.dataset.selectBlock);selectBlock(state.selected===index?null:index);return;}
  const axis=event.target.closest('[data-chart-axis]');if(axis){state.chartAxis=axis.dataset.chartAxis;$('.analysis-panel').outerHTML=analysisPanel();if(state.cursor!==null)updateCursor(state.cursor);$(`[data-chart-axis="${state.chartAxis}"]`)?.focus({preventScroll:true});return;}
  const series=event.target.closest('[data-series]');if(series){state.series=series.dataset.series;const panel=$('.analysis-panel');panel.outerHTML=analysisPanel();if(state.cursor!==null)updateCursor(state.cursor);$(`[data-series="${state.series}"]`)?.focus();return;}
  const choice=event.target.closest('[data-context]');if(choice){const context=choice.dataset.context;draft.context=draft.context.includes(context)?draft.context.filter(x=>x!==context):[...draft.context,context];choice.setAttribute('aria-pressed',String(draft.context.includes(context)));storeDraft();return;}
  const activityButton=event.target.closest('[data-activity]');if(activityButton){$('#detail-dialog').close();setActivity(activityButton.dataset.activity);return;}
  const target=event.target.closest('[data-action]');if(!target)return;
  const action=target.dataset.action;
  if(action==='chart-range'){state.fullPaceRange=!state.fullPaceRange;$('.analysis-panel').outerHTML=analysisPanel();$('[data-action="chart-range"]')?.focus({preventScroll:true});return;}
  if(action==='checkin'){openCheckin();}
  if(action==='sync-garmin')void syncGarmin();
  if(action==='import-file')$('#fit-import')?.click();
  if(action==='sign-out'){void logout().catch(error=>openDetail('Sign out',`<p>${escape(error.message)}</p>`));return;}
  if(action==='route-replay'&&routeGeometry()){
    target.disabled=true;
    try{
      const {openSatelliteReplay}=await import('./satellite-replay.js');
      if(signal.aborted||!target.isConnected)return;
      satelliteReplay?.destroy();
      routeMaps?.suspend();
      satelliteReplay=openSatelliteReplay({activity,reduced:reducedMotion(),onClose:()=>routeMaps?.resume()});
      if(!satelliteReplay)routeMaps?.resume();
    }catch{if(!signal.aborted)openDetail('Replay unavailable','<p>Check your connection, then try Replay route again.</p>');}
    finally{target.disabled=false;}
  }
  if(action==='expand-map'){
    openDetail('Route explorer',`<div class="route-explorer"><div class="explorer-summary"><p><strong>${escape(activity.title)}</strong><br>${distance(activity.distance)} km · ${dateText(activity.date)}</p><span class="map-legend"><i></i>Start <b></b>Finish</span></div><div class="route-svg">${mapView('expanded')}</div><div class="explorer-inspector"><div class="map-moments"><span>Inspect your effort</span><output id="map-inspection" for="map-position">Select the route or move through time</output></div><label>Session time<input class="chart-slider" id="map-position" type="range" min="0" max="${activity.records.length-1}" value="${state.cursor??0}" aria-label="Inspect map by time"></label><p>Tap near the route to inspect a recorded moment. S: start · F: finish · Numbers: kilometre crossings. GPS gaps stay open.</p></div></div>`);
    $('#detail-dialog').classList.add('map-dialog');routeMaps?.scan();if(state.cursor!==null)updateCursor(state.cursor);
  }
  if(action==='motion'){toggleMotion();target.textContent=reducedMotion()?'Enable visual motion':'Reduce visual motion';}
  if(action==='close-dialog'){target.closest('dialog').close();routeMaps?.prune();}
  if(action==='source')openDetail('Where the details come from',`<div class="source-identity">${icon('layers')}<div><h3>${escape(activity.source)}</h3><p>${escape(activity.device)}</p></div></div><dl><div><dt>Recorded date</dt><dd>${dateText(activity.date)}</dd></div>${activity.running!=null?`<div><dt>Running time</dt><dd>${duration(activity.running)}</dd></div>`:''}<div><dt>Timer time</dt><dd>${duration(activity.timer)}</dd></div><div><dt>Moving time</dt><dd>${duration(activity.moving)}</dd></div><div><dt>Elapsed time</dt><dd>${duration(activity.elapsed)}</dd></div>${activityKind(activity)==='run'?`<div><dt>GPS samples</dt><dd>${activity.records.filter(r=>Number.isFinite(r.lat)&&Number.isFinite(r.lon)).length||'Not available'}</dd></div>`:''}</dl><p>${activity.synthetic?'This is generated demonstration data.':activity.records.length?activity.parserVersion?payload.cloudLibrary?'Decoded from your original FIT and saved in your private account.':'Decoded from your original FIT and saved in the local library.':'The original FIT and Garmin summary were inspected together. This preview uses a local capture, not a live refresh.':'Transcribed from your screenshots. Missing sensor data stays missing.'}</p><p>${activityKind(activity)!=='run'?'This workout is kept as a session record.':activity.records.length?'The route follows recorded GPS over real OpenStreetMap streets, parks and places, delivered by OpenFreeMap. Map requests reveal the viewed area to that provider; your GPS trace and training measurements are drawn on this device, not uploaded to the map service. Missing GPS stays missing. Charts are unsmoothed; HR in time blocks is a sample mean.':'Your screenshots preserve displayed summaries and splits. No GPS or chart series is reconstructed, and rounded distances stay approximate.'}</p>${previewEvidence().length?`<button class="secondary-button" data-action="evidence">View source screenshots</button>`:payload.cloudLibrary&&activity.sourceFile==='Owner-supplied screenshots'?'<p>Original screenshots are included in your private backup. <a href="/account#account-security">Open backup settings</a>.</p>':''}${activity.sourceIssues.length?`<details><summary>Source details to retain</summary><ul>${activity.sourceIssues.map(x=>`<li>${escape(x)}</li>`).join('')}</ul></details>`:''}`);
  if(action==='evidence'&&previewEvidence().length){const images=previewEvidence();$('#detail-dialog').close();openDetail('Your original screenshots',`<p>Source images only. No GPS or chart series has been reconstructed.</p>${images.map(id=>`<figure class="evidence-image"><img loading="lazy" src="/api/evidence/${id}" alt="Original ${escape(activity.source)} screenshot ${id}"><figcaption>Owner-supplied source image ${id}</figcaption></figure>`).join('')}`);}
  if(action==='method')openDetail('A finding you can inspect',`<p class="method-finding">${escape(activity.observation.title)}</p><p>${escape(activity.observation.method)}</p><p>Time blocks follow recorded timestamps, so the final block may be shorter. Recorded device laps are shown separately.</p><p>No readiness, injury risk or fitness improvement is inferred.</p>`);
  if(action==='activities')openDetail('Activities',`<p class="dialog-intro">Your Garmin activities and imported history.</p><div class="activity-list">${[...payload.activities].sort((a,b)=>Number(a.synthetic)-Number(b.synthetic)||(b.date||'').localeCompare(a.date||'')).map(a=>`<button data-activity="${escape(a.id)}" class="activity-option ${a.id===activity.id?'current':''}"><span class="activity-icon">${icon('route')}</span><span><strong>${escape(a.title)}</strong><small>${dateText(a.date)} · ${escape(a.source)}</small></span><span>${(a.kind||activityKind(a))==='run'?`${distance(a.distance)}<small>km</small>`:duration(a.timer??a.moving??a.elapsed)}</span>${icon('chevron')}</button>`).join('')}</div>`);
  if(['zoom-in','zoom-out','fit-route'].includes(action))routeMaps?.command(action,target);
  if(action==='clear-selection')selectBlock(null);
  if(action==='expand-blocks'){state.expandedBlocks=!state.expandedBlocks;$$('[data-select-block]').forEach(row=>row.hidden=Number(row.dataset.selectBlock)>=6&&!state.expandedBlocks);target.setAttribute('aria-expanded',String(state.expandedBlocks));target.textContent=state.expandedBlocks?'Show fewer blocks':`Show all ${activity.blocks.length} blocks`;if(!state.expandedBlocks&&state.selected>=6)selectBlock(null);}
  if(action==='normal'){state.scenario='normal';activity=currentActivity();render();}
  if(action==='edit-feedback'){state.scenario='normal';draft.complete=false;storeDraft();refreshForm();}
  if(action==='retry-feedback'){state.scenario='normal';saveFeedback();}
  if(action==='connection')openDetail(state.scenario==='expired'?'Reconnect Garmin':'Import status',`<p>${state.scenario==='expired'?'Your imported activities are still available. In the finished app, reconnecting will restore new imports.':'The last imported activity is available. In the finished app, this will show the last attempt and a retry action.'}</p><button class="primary-button" data-action="connection-preview">Return to connected preview ${icon('check')}</button>`);
  if(action==='connection-preview'){state.scenario='normal';$('#detail-dialog').close();render();}
  if(action==='reset-demo'&&activity.synthetic){draft=emptyDraft();state.scenario='normal';state.pending=false;state.feedbackError='';storeDraft();$('#detail-dialog').close();render();}
  if(action==='review'&&payload.cloudLibrary)openDetail('Preferences',`<button class="secondary-button" data-action="motion" ${matchMedia('(prefers-reduced-motion:reduce)').matches?'disabled':''}>${reducedMotion()?'Enable visual motion':'Reduce visual motion'}</button><button class="text-button" data-action="sign-out">Sign out</button>`);
  if(action==='review'&&!payload.cloudLibrary)openDetail('Review this direction',`<p>Field Notes design preview. Check-ins stay in this browser.</p><button class="secondary-button" data-action="motion" ${matchMedia('(prefers-reduced-motion:reduce)').matches?'disabled':''}>${reducedMotion()?'Enable visual motion':'Reduce visual motion'}</button>${activity.synthetic?`<button class="secondary-button" data-action="reset-demo">Reset demo check-in</button>`:''}<label class="review-state-label">Interface state<select id="local-scenario">${[['normal','Recorded activity'],['partial','Missing GPS & HR'],['empty','No activities'],['loading','Loading'],['error','Load failed'],['save-error','Check-in retry'],['offline','Offline / pending'],['delayed','Sync delayed'],['expired','Key expired'],['success','Completion preview']].map(([v,l])=>`<option value="${v}" ${state.scenario===v?'selected':''}>${l}</option>`).join('')}</select></label><a class="secondary-button" href="/studio">Open design studio ${icon('arrow')}</a>`);
});
root.addEventListener('change',async event=>{
  const input=event.target;
  if(input.id==='library-restore'){const file=input.files[0],status=$('#library-status');if(!file)return;if(file.size>(payload.cloudLibrary?3.5:50)*1024*1024){status.textContent=`Choose a backup smaller than ${payload.cloudLibrary?3.5:50} MB.`;return;}input.disabled=true;status.textContent='Checking your backup…';try{const response=await apiFetch('/api/restore',{method:'POST',headers:{'Content-Type':'application/json'},body:await file.text()}),result=await response.json();if(!response.ok)throw new Error(result.error);location.reload();}catch(e){status.textContent=e.message||'Restore failed. Your existing library is unchanged.';input.disabled=false;input.value='';}return;}
  if(input.id==='fit-import'){
    const file=input.files[0],status=$('#library-status');if(!file)return;if(file.size>(payload.importLimitMB||10)*1024*1024){status.textContent=`Choose a FIT file smaller than ${payload.importLimitMB||10} MB.`;return;}input.disabled=true;status.textContent='Importing your activity…';
    try{const response=await apiFetch('/api/import',{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:await file.arrayBuffer()}),result=await response.json();if(!response.ok)throw new Error(result.error);const index=payload.activities.findIndex(a=>a.id===result.activity.id||a.sourceHash===result.activity.sourceHash);if(index<0)payload.activities.push(result.activity);else payload.activities[index]=result.activity;if(!signal.aborted)setActivity(result.activity.id);}catch(e){status.textContent=e.message||'Import failed. Try the original FIT file.';}finally{input.disabled=false;input.value='';}return;
  }
  if(input.matches('.checkin-form input[type=radio]')){
    if(input.name==='location')draft.location=input.value;else draft.answers[input.name]=input.value;
    if(input.name==='discomfort'&&input.value==='none'){draft.location=null;$$('input[name="location"]').forEach(x=>x.checked=false);}
    state.feedbackError='';
    const group=input.closest('.question');
    if(group){group.classList.remove('missing');group.querySelector('.question-error').textContent='';group.querySelectorAll('input').forEach(field=>{field.removeAttribute('aria-invalid');field.removeAttribute('aria-describedby');});}
    $$('.location-question').forEach(x=>x.hidden=!draft.answers.discomfort||draft.answers.discomfort==='none');
    const count=Object.values(draft.answers).filter(x=>x!==null).length;$$('.form-count').forEach(x=>x.textContent=`${count} of 4`);$$('.form-progress').forEach(progress=>[...progress.children].forEach((x,i)=>x.classList.toggle('answered',Object.values(draft.answers)[i]!==null)));$$('.form-error').forEach(x=>x.textContent='');storeDraft();
  }
  if(input.id==='local-scenario'){state.scenario=input.value;activity=currentActivity();$('#detail-dialog').close();render();}
});
root.addEventListener('input',event=>{if(event.target.matches('.checkin-form [name=note]')){draft.note=event.target.value;storeDraft();}if(['chart-position','replay-position','map-position'].includes(event.target.id)){updateCursor(Number(event.target.value));}});
root.addEventListener('submit',event=>{if(event.target.matches('.checkin-form')){event.preventDefault();saveFeedback();}});
function inspectChart(event){const chart=event.target.closest('.chart-canvas');if(!chart)return;const c=chartModel();if(!c)return;const rect=chart.getBoundingClientRect();updateCursor(c.nearest(((event.clientX-rect.left)/rect.width*c.width-c.left)/(c.right-c.left)));}
root.addEventListener('pointerdown',event=>{if(event.target.closest('.chart-canvas'))inspectChart(event);});
root.addEventListener('pointermove',event=>{const chart=event.target.closest('.chart-canvas');if(!chart||event.pointerType==='touch'&&!event.buttons)return;pointerX=event.clientX;if(pointerFrame)return;pointerFrame=requestAnimationFrame(()=>{pointerFrame=0;if(chart.isConnected)inspectChart({target:chart,clientX:pointerX});});});
root.addEventListener('keydown',event=>{if(!event.target.matches('.chart-canvas'))return;const current=state.cursor??0,positions={ArrowLeft:current-1,ArrowDown:current-1,ArrowRight:current+1,ArrowUp:current+1,PageDown:current-15,PageUp:current+15,Home:0,End:activity.records.length-1};if(positions[event.key]!==undefined){event.preventDefault();updateCursor(Math.max(0,Math.min(activity.records.length-1,positions[event.key])));}});

window.addEventListener('storage',event=>{
 if(activity&&event.key===draftKey()&&!savingFeedback){draft=readDraft();refreshForm();}
},{signal});
signal.addEventListener('abort',()=>{
 satelliteReplay?.destroy();
 premiumMotion?.destroy();
 routeMaps?.destroy();
},{once:true});
if(payload.cloudLibrary){state.scenario='normal';params.delete('scenario');}
const aliases=payload.activityAliases||{};
state.activityId=payload.activity?.id||(Object.hasOwn(aliases,state.activityId)?aliases[state.activityId]:state.activityId)||payload.defaultId;
activity=currentActivity();
draft=readDraft();
state.pending=draft.pending;
render();
}
