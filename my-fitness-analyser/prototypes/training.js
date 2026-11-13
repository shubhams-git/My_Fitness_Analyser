import {goalMarkup} from './goals-view.js';
import { privateJson,refreshView } from './session.js';
import { mountCoaching } from './coaching.js';
import { mountProgress,recordedTime } from './progress.js';
import { activityLabels } from './activity-kind.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf=new Intl.NumberFormat('en-AU',{maximumFractionDigits:2});
const distance=v=>Number.isFinite(v)?(v<1000?nf.format(v)+' m':nf.format(v/1000)+' km'):'—';
const time=v=>{if(!Number.isFinite(v))return '—';const n=Math.round(v);return n>=3600?Math.floor(n/3600)+'h '+Math.floor(n%3600/60)+'m':Math.floor(n/60)+':'+String(n%60).padStart(2,'0');};
const pace=v=>Number.isFinite(v)?time(v):'—';
const date=v=>new Date(v+'T12:00Z').toLocaleDateString('en-AU',{day:'numeric',month:'short',timeZone:'UTC'});
const arrow='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>';
const activityUrl=s=>'/app.html?activity='+encodeURIComponent(s.id);
const label=kind=>activityLabels[kind]||'Workout';
export function mountTraining({root,route,data:initial,signal}){
const view=route.view;
const params=new URLSearchParams(location.search);
let data=initial,windowChoice=route.window,type=['run','other'].includes(params.get('type'))?params.get('type'):'all',shown=Math.max(12,Math.min(Number(params.get('shown'))||12,data.sessions.length||12)),busy=false;
const $=selector=>root.querySelector(selector);
function detail(s){
 if(view!=='sessions')return activityUrl(s);
 const returnTo=new URLSearchParams({view:'sessions',window:windowChoice});
 if(type!=='all')returnTo.set('type',type);
 if(shown>12)returnTo.set('shown',shown);
 return activityUrl(s)+'&from='+encodeURIComponent(returnTo);
}
function url(next){return next==='today'?'/training':'/training?view='+next;}
function rows(sessions){return sessions.map(s=>`<a class="td-session" href="${detail(s)}"><span class="td-date">${date(s.date)}</span><span class="td-session-name"><strong>${esc(s.title)}</strong><small>${label(s.kind)} · ${esc(s.source)}${s.sourceKind==='screenshot'?' summary':''}</small></span><span><strong>${distance(s.distanceM)}</strong><small>${time(s.durationS)}</small></span><span class="td-pace">${s.paceSPerKm===null?'':pace(s.paceSPerKm)+' <small>/km</small>'}</span>${arrow}</a>`).join('');}
function latest(){const s=data.sessions.find(session=>session.run)||data.sessions[0];if(!s)return `<section class="td-latest td-empty" aria-labelledby="latest-title"><h2 id="latest-title">Add your first activity</h2><p>Sync Garmin, import a FIT recording or send a screenshot from Nike Run Club or Strava for review.</p><a class="primary-button" href="/account#connections">Go to Garmin &amp; imports</a></section>`;
 const metrics=[s.distanceM>0&&['Distance',distance(s.distanceM)],s.paceSPerKm!=null&&['Average pace',pace(s.paceSPerKm)+' /km'],s.durationS!=null&&['Recorded time',recordedTime(s.durationS)]].filter(Boolean);
 const checkin=s.run&&!s.checkinComplete;
 return `<section class="td-latest" aria-labelledby="latest-title"><div class="td-section-top"><h2 id="latest-title">${s.run?'Latest run':'Latest activity'}</h2><time datetime="${esc(s.date)}">${date(s.date)}</time></div><div class="td-latest-title"><h3>${esc(s.title)}</h3></div>${metrics.length?`<dl class="td-latest-metrics">${metrics.map(([label,value])=>`<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>`:''}<div class="td-latest-actions">${checkin?`<a class="primary-button" href="${detail(s)}#checkin">Log how it felt</a><a class="text-button" href="${detail(s)}">View run</a>`:`<a class="primary-button" href="${detail(s)}">${s.run?'View run':'View activity'}</a>${s.run?`<a class="text-button" href="${detail(s)}#checkin">Edit check-in</a>`:''}`}</div></section>`;}
function week(){
 const {recent}=data.summary.periods[0],missing=[recent.distance.count<recent.runs?'distance':null,recent.duration.count<recent.runs?'time':null].filter(Boolean);
 return `<section class="td-week" aria-labelledby="week-title"><div class="td-section-top"><h2 id="week-title">Running · Last 7 days</h2><a href="${url('progress')}">See progress ${arrow}</a></div>${recent.runs?`<dl><div><dt>Runs logged</dt><dd>${recent.runs}</dd></div><div><dt>Distance</dt><dd>${distance(recent.distance.value)}</dd></div><div><dt>Recorded time</dt><dd>${recordedTime(recent.duration.value)}</dd></div></dl><p class="pr-note">${recent.days} ${recent.days===1?'day':'days'} with a run${missing.length?' · '+missing.join(' and ')+' missing from some records':''}</p>`:'<p class="pr-note">No runs in your record for this period.</p>'}</section>`;
}
function workouts(){
 const {modalities,activeDays}=data.summary,journal=data.journalStrength;
 if(!modalities.length&&!journal?.sessions)return '';
 const total=modalities.reduce((n,row)=>n+row.sessions,0);
 return `<section class="td-week td-workouts" aria-labelledby="workout-title"><div class="td-section-top"><h2 id="workout-title">Workout mix</h2><span>Last 28 days</span></div>
 ${total?`<p class="pr-note">${total} recorded ${total===1?'activity':'activities'} across ${activeDays} ${activeDays===1?'day':'days'}.</p><ul>${modalities.map(m=>`<li><span>${label(m.kind)}</span><span>${m.sessions} ${m.sessions===1?'session':'sessions'}${m.duration.value!==null?' · '+recordedTime(m.duration.value):''}${m.duration.count>0&&m.duration.count<m.sessions?' recorded':''}</span></li>`).join('')}</ul>`:''}
 ${journal?.sessions?`<p class="pr-note"><a href="/journal#strength">${journal.sessions} strength ${journal.sessions===1?'entry':'entries'} in Journal</a> over the last 14 days. These may also appear in your activity record.</p>`:''}</section>`;
}
function sessions(){const selected=data.sessions.filter(s=>type==='all'||(type==='run'?s.run:!s.run));return `<section class="td-all-sessions" aria-labelledby="sessions-title"><div class="td-section-top"><div><h1 id="sessions-title">Sessions</h1><p>${selected.length} ${selected.length===1?'activity':'activities'}</p></div><a class="secondary-button" href="/account#connections">Add an activity</a></div><div class="td-session-tools"><div class="tr-window" role="group" aria-label="Session type">${[['all','All'],['run','Running'],['other','Other workouts']].map(([key,label])=>`<button data-type="${key}" aria-pressed="${type===key}">${label}</button>`).join('')}</div>${windows()}</div><div class="td-session-list">${rows(selected.slice(0,shown))||'<div class="td-empty"><h2>No sessions in this view</h2><p>Try another activity type or date range.</p></div>'}</div>${selected.length>shown?'<button class="secondary-button" id="more-sessions">Show more sessions</button>':''}</section>`;}
function windows(){return `<div class="tr-window" role="group" aria-label="History window">${[['90','90 days'],['all','All history']].map(([key,label])=>`<button data-window="${key}" aria-pressed="${windowChoice===key}">${label}</button>`).join('')}</div>`;}
let coachingRoot,disposeProgress;
function render(){
 disposeProgress?.();
 root.innerHTML=`<main id="training-main" class="td-main" data-view="${view}">${view==='today'?`<div class="td-page-heading"><div><h1>Training</h1><p><time datetime="${esc(data.anchor)}">${new Date(data.anchor+'T12:00Z').toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'long',timeZone:'UTC'})}</time>${data.dataset==='synthetic'?' · Synthetic preview':''}</p></div></div><div class="td-home-grid">${latest()}${data.sessions.length?`<section class="td-coach" id="home-coach" aria-label="Coaching brief"></section><aside>${week()}${workouts()}${data.cloud&&data.goals?.weekly?.status&&data.goals.weekly.status!=='unset'?goalMarkup(data.goals.weekly,'weekly-distance'):''}</aside>`:''}</div>${data.sessions.length?`<section class="td-recent" aria-labelledby="recent-title"><div class="td-section-top"><h2 id="recent-title">Recent activities</h2><a href="${url('sessions')}">All sessions ${arrow}</a></div><div class="td-session-list">${rows(data.sessions.slice(0,4))}</div></section>`:''}`:view==='sessions'?sessions():`<div class="td-page-heading"><div><h1>Progress</h1><p>Compare recorded runs and explore your training by month.</p></div>${windows()}</div><section id="progress" class="pr-section" aria-label="Training progress"></section><details class="td-record-details"><summary>Sources and calculations</summary><p>Running totals include recorded runs and imported summaries. Treadmill and cycling distances stay separate. Recorded time can come from timer, running, moving or elapsed time. GPS efforts and zone charts require samples. Missing sessions are unknown.</p></details>`}<footer class="td-footer"><a href="/account#connections">Garmin &amp; imports</a><span id="sync-status" role="status"></span>${data.local||data.garminConfigured?'<button class="text-button" id="sync">Sync Garmin</button>':''}</footer></main><p class="td-notice" id="notice" role="status"></p>`;
 if(view==='progress')disposeProgress=mountProgress($('#progress'),data);
 if(view==='today'){const target=$('#home-coach');if(target&&data.cloud){if(coachingRoot)target.replaceWith(coachingRoot);else{coachingRoot=target;void mountCoaching(target,{signal});}}else target?.remove();}
 bind();
}
function bind(){
 root.querySelectorAll('[data-window]').forEach(button=>button.addEventListener('click',async()=>{
  if(button.getAttribute('aria-pressed')==='true'||busy)return;
  busy=true;
  root.querySelectorAll('[data-window]').forEach(control=>control.disabled=true);
  try{
   await load(button.dataset.window,{force:false});
   $(`[data-window="${windowChoice}"]`)?.focus({preventScroll:true});
  }catch(error){
   if(signal.aborted)return;
   $('#notice').textContent=error.message;
   root.querySelectorAll('[data-window]').forEach(control=>control.disabled=false);
  }finally{busy=false;}
 }));
 root.querySelectorAll('[data-type]').forEach(button=>button.addEventListener('click',()=>{
  type=button.dataset.type;
  shown=12;
  rememberSessions();
  render();
  $(`[data-type="${type}"]`).focus({preventScroll:true});
 }));
 $('#more-sessions')?.addEventListener('click',()=>{
  const firstNew=shown;
  shown+=12;
  rememberSessions();
  render();
  root.querySelectorAll('.td-session')[firstNew]?.focus();
 });
 $('#sync')?.addEventListener('click',async event=>{
  const button=event.currentTarget;
  button.disabled=true;
  $('#sync-status').textContent='Syncing your recordings…';
  try{
   const result=await privateJson('/api/garmin/sync',{method:'POST'});
   if(signal.aborted)return;
   await load(windowChoice,{force:true});
   if(!signal.aborted)$('#sync-status').textContent=`${result.imported||0} added · ${result.updated||0} updated`;
  }catch(error){
   if(signal.aborted)return;
   button.disabled=false;
   $('#sync-status').textContent=error.message;
  }
 });
}
function rememberSessions(){
 const url=new URL(location.href);
 if(type==='all')url.searchParams.delete('type');else url.searchParams.set('type',type);
 if(shown===12)url.searchParams.delete('shown');else url.searchParams.set('shown',shown);
 history.replaceState(history.state,'',url);
}
async function load(choice,{force}){
 const next=await refreshView('/api/training?window='+choice,'training',{force});
 if(signal.aborted)return;
 data=next;
 windowChoice=choice;
 const url=new URL(location.href);
 url.searchParams.set('window',choice);
 history.replaceState(history.state,'',url);
 render();
}
signal.addEventListener('abort',()=>disposeProgress?.(),{once:true});
render();
}
