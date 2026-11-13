import {goalMarkup} from './goals-view.js';
import { privateJson,viewSnapshot,refreshView } from './session.js';
import { mountCoaching } from './coaching.js';
import { mountProgress,recordedTime } from './progress.js';
import { activityLabels } from './activity-kind.js';
const root=document.querySelector('#training-root'),params=new URLSearchParams(location.search);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf=new Intl.NumberFormat('en-AU',{maximumFractionDigits:2});
const distance=v=>Number.isFinite(v)?(v<1000?nf.format(v)+' m':nf.format(v/1000)+' km'):'—';
const time=v=>{if(!Number.isFinite(v))return '—';const n=Math.round(v);return n>=3600?Math.floor(n/3600)+'h '+Math.floor(n%3600/60)+'m':Math.floor(n/60)+':'+String(n%60).padStart(2,'0');};
const pace=v=>Number.isFinite(v)?time(v):'—';
const date=v=>new Date(v+'T12:00Z').toLocaleDateString('en-AU',{day:'numeric',month:'short',timeZone:'UTC'});
const arrow='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>';
const logo='<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M3 25 11 7h5L8 25m9 0 8-18h4l-8 18"/></svg>';
const detail=s=>'/app.html?activity='+encodeURIComponent(s.id);
const label=kind=>activityLabels[kind]||'Workout';
let data,view=['progress','sessions'].includes(params.get('view'))?params.get('view'):location.hash==='#progress'?'progress':'today',windowChoice=params.get('window')==='all'?'all':'90',type='all',shown=12,busy=false,motion=true;
try{motion=localStorage.getItem('mfa-visual-motion')!=='off';}catch{}
const reduced=matchMedia('(prefers-reduced-motion:reduce)');
function url(next){return next==='today'?'/training':'/training?view='+next;}
function rows(sessions){return sessions.map(s=>`<a class="td-session" href="${detail(s)}"><span class="td-date">${date(s.date)}</span><span class="td-session-name"><strong>${esc(s.title)}</strong><small>${label(s.kind)} · ${esc(s.source)}${s.sourceKind==='screenshot'?' summary':''}</small></span><span><strong>${distance(s.distanceM)}</strong><small>${time(s.durationS)}</small></span><span class="td-pace">${s.paceSPerKm===null?'':pace(s.paceSPerKm)+' <small>/km</small>'}</span>${arrow}</a>`).join('');}
function latest(){const s=data.sessions[0];if(!s)return `<section class="td-latest td-empty"><h2>No activities recorded yet</h2><p>Sync Garmin or import past activities to start seeing your training here.</p><a class="primary-button" href="/account">Open connections ${arrow}</a></section>`;
return `<section class="td-latest" aria-labelledby="latest-title"><div class="td-section-top"><h2 id="latest-title">Latest activity</h2><span>${date(s.date)}</span></div><a class="td-latest-title" href="${detail(s)}"><h3>${esc(s.title)}</h3>${arrow}</a><dl class="td-latest-metrics"><div><dt>Type</dt><dd>${label(s.kind)}</dd></div><div><dt>Recorded time</dt><dd>${recordedTime(s.durationS)}</dd></div>${s.distanceM>0?`<div><dt>Distance</dt><dd>${distance(s.distanceM)}</dd></div>`:''}</dl><div class="td-latest-actions"><a class="primary-button" href="${detail(s)}">View activity ${arrow}</a>${s.run?`<a class="text-button" href="${detail(s)}#checkin">${s.checkinComplete?'Edit check-in':'Log how it felt'} ${arrow}</a>`:''}</div></section>`;}
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
 ${journal?.sessions?`<p class="pr-note"><a href="/journal">${journal.sessions} strength ${journal.sessions===1?'entry':'entries'} in Journal</a> over the last 14 days. These may also appear in your activity record.</p>`:''}</section>`;
}
function sessions(){const selected=data.sessions.filter(s=>type==='all'||(type==='run'?s.run:!s.run));return `<section class="td-all-sessions" aria-labelledby="sessions-title"><div class="td-section-top"><div><h1 id="sessions-title">Your sessions.</h1><p>${selected.length} activities</p></div><a class="secondary-button" href="/account">Add an activity ${arrow}</a></div><div class="td-session-tools"><div class="tr-window" role="group" aria-label="Session type">${[['all','All'],['run','Running'],['other','Other workouts']].map(([key,label])=>`<button data-type="${key}" aria-pressed="${type===key}">${label}</button>`).join('')}</div>${windows()}</div><div class="td-session-list">${rows(selected.slice(0,shown))||'<div class="td-empty"><h2>No sessions here yet.</h2><p>Choose another filter or add an activity from Account.</p></div>'}</div>${selected.length>shown?'<button class="secondary-button" id="more-sessions">Show more sessions</button>':''}</section>`;}
function windows(){return `<div class="tr-window" role="group" aria-label="History window">${[['90','90 days'],['all','All history']].map(([key,label])=>`<button data-window="${key}" aria-pressed="${windowChoice===key}">${label}</button>`).join('')}</div>`;}
let coachingRoot,loadVersion=0;
function render(){document.title=(view==='progress'?'Progress':view==='sessions'?'Sessions':'Training')+' — My Fitness Analyser';params.set('view',view);params.set('window',windowChoice);history.replaceState(null,'','/training?'+params+location.hash);root.innerHTML=`<header class="tr-header"><a class="tr-brand" href="/training" aria-label="My Fitness Analyser training">${logo}<span>My Fitness<br><strong>Analyser</strong></span></a><nav aria-label="Main"><a href="/training" ${view!=='progress'?'aria-current="page"':''}>Training</a><a href="/training?view=progress" ${view==='progress'?'aria-current="page"':''}>Progress</a><a href="/journal">Journal</a><a href="/account">Account</a></nav><button class="tr-motion" id="motion" aria-label="Toggle motion effects" aria-pressed="${motion&&!reduced.matches}">Motion <span>${motion&&!reduced.matches?'on':'off'}</span></button></header><main id="training-main" class="td-main" data-view="${view}">${view==='today'?`<div class="td-page-heading"><div><h1>Training</h1><p>${new Date(data.anchor+'T12:00Z').toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'long',timeZone:'UTC'})}${data.dataset==='synthetic'?' · Synthetic design preview':''}</p></div><a class="secondary-button" href="/journal#quick-log">Log your weight ${arrow}</a></div><div class="td-home-grid">${week()}<aside>${latest()}${workouts()}${data.cloud&&data.goals?.weekly?.status&&data.goals.weekly.status!=='unset'?goalMarkup(data.goals.weekly,'weekly-distance'):''}</aside><section class="td-coach" id="home-coach" aria-label="Your coaching brief"></section></div><section class="td-recent" aria-labelledby="recent-title"><div class="td-section-top"><h2 id="recent-title">Recent activities</h2><a href="${url('sessions')}">All sessions ${arrow}</a></div><div class="td-session-list">${rows(data.sessions.slice(0,4))||'<p>Your sessions will appear here.</p>'}</div></section>`:view==='sessions'?sessions():`<div class="td-page-heading"><div><h1>Progress</h1><p>Compare recorded runs and explore your training by month.</p></div>${windows()}</div><section id="progress" class="pr-section" aria-label="Training progress"></section><details class="td-record-details"><summary>Sources and calculations</summary><p>Running totals include recorded runs and imported summaries. Treadmill and cycling distances stay separate. Recorded time can come from timer, running, moving or elapsed time. GPS efforts and zone charts require samples. Missing sessions are unknown.</p><a href="/app.html">Open activity library ${arrow}</a></details>`}<footer class="td-footer"><a href="/app.html">Activity library</a><a href="/account">Connections & settings</a><span id="sync-status" role="status"></span>${data.local||data.garminConfigured?'<button class="text-button" id="sync">Sync Garmin</button>':''}</footer></main><p class="td-notice" id="notice" role="status"></p>`;
 if(view==='progress')mountProgress(document.querySelector('#progress'),data);
 if(view==='today'){const target=document.querySelector('#home-coach');if(data.cloud){if(coachingRoot)target.replaceWith(coachingRoot);else{coachingRoot=target;void mountCoaching(target);}}else target.innerHTML='<div class="td-preview"><h2>Your coaching brief</h2><p>'+(data.dataset==='synthetic'?'This design preview uses synthetic records.':'Your recorded training is available here. Gemini coaching is available in the signed-in app.')+'</p><a href="/account">Open your account</a></div>';}
 bind();
}
function bind(){document.querySelectorAll('[data-window]').forEach(b=>b.addEventListener('click',async()=>{if(b.getAttribute('aria-pressed')==='true'||busy)return;busy=true;document.querySelectorAll('[data-window]').forEach(b=>b.disabled=true);try{await load(b.dataset.window);document.querySelector(`[data-window="${windowChoice}"]`)?.focus({preventScroll:true});}catch(e){document.querySelector('#notice').textContent=e.message;document.querySelectorAll('[data-window]').forEach(b=>b.disabled=false);}finally{busy=false;}}));
 document.querySelectorAll('[data-type]').forEach(b=>b.addEventListener('click',()=>{type=b.dataset.type;shown=12;render();document.querySelector(`[data-type="${type}"]`).focus({preventScroll:true});}));document.querySelector('#more-sessions')?.addEventListener('click',()=>{shown+=12;render();document.querySelector('.td-session-list')?.scrollIntoView({block:'nearest'});});
 document.querySelector('#motion').addEventListener('click',()=>{motion=!motion;try{localStorage.setItem('mfa-visual-motion',motion?'on':'off');}catch{}document.querySelector('#motion').setAttribute('aria-pressed',String(motion&&!reduced.matches));document.querySelector('#motion span').textContent=motion&&!reduced.matches?'on':'off';});
 document.querySelector('#sync')?.addEventListener('click',async e=>{const b=e.currentTarget;b.disabled=true;document.querySelector('#sync-status').textContent='Syncing your recordings…';try{const result=await privateJson('/api/garmin/sync',{method:'POST'});await load(windowChoice);document.querySelector('#sync-status').textContent=`${result.imported||0} added · ${result.updated||0} updated`;}catch(e){b.disabled=false;document.querySelector('#sync-status').textContent=e.message;}});
}
async function load(choice=windowChoice){
 const version=++loadVersion;
 const endpoint='/api/training?window='+choice;
 const cached=viewSnapshot(endpoint)?.value;
 if(cached){data=cached;windowChoice=choice;render();}
 try{
  const next=await refreshView(endpoint);
  if(version!==loadVersion)return;
  if(!cached||JSON.stringify(cached)!==JSON.stringify(next)){
   data=next;windowChoice=choice;render();
  }
 }catch(error){
  if(version!==loadVersion)return;
  if(!cached)throw error;
  document.querySelector('#notice').textContent='Showing saved training. Refresh to try again.';
 }
}
function routeView(){return ['progress','sessions'].includes(params.get('view'))?params.get('view'):'today';}
root.addEventListener('click',event=>{
 const link=event.target.closest('a[href]');
 if(!data||!link||busy||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||link.target||link.origin!==location.origin||link.pathname!=='/training'||link.hash)return;
 const next=new URLSearchParams(link.search).get('view')||'today';
 if(!['today','progress','sessions'].includes(next))return;
 event.preventDefault();
 if(next===view)return;
 params.set('view',next);
 history.pushState(null,'','/training?'+params);
 view=next;render();scrollTo(0,0);
 const heading=root.querySelector('h1');heading.tabIndex=-1;heading.focus({preventScroll:true});
});
addEventListener('popstate',()=>{
 const current=new URLSearchParams(location.search);
 for(const name of [...params.keys()])params.delete(name);
 for(const [name,value] of current)params.append(name,value);
 view=routeView();
 if(data){const choice=params.get('window')==='all'?'all':'90';if(choice!==windowChoice)void load(choice).catch(e=>{document.querySelector('#notice').textContent=e.message;});else render();}
});
reduced.addEventListener('change',()=>{const b=document.querySelector('#motion');if(b){b.setAttribute('aria-pressed',String(motion&&!reduced.matches));b.querySelector('span').textContent=motion&&!reduced.matches?'on':'off';}});
const initialHeading=root.querySelector('h1');
if(initialHeading){initialHeading.textContent=view==='progress'?'Progress':view==='sessions'?'Sessions':'Training';if(view==='progress'){
 root.querySelector('nav [aria-current]')?.removeAttribute('aria-current');
 root.querySelector('nav a[href="/training?view=progress"]')?.setAttribute('aria-current','page');
}}
try{await load();}catch(e){root.innerHTML=`<main class="training-loading"><h1>Your training couldn’t load.</h1><p>${esc(e.message)}</p><button class="primary-button" id="retry">Try again</button></main>`;document.querySelector('#retry').addEventListener('click',()=>location.reload());}
