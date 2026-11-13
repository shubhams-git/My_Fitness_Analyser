import {privateJson,viewSnapshot,refreshView} from './session.js';
import { entryMarkup,mountWeightEntry,clearWeightDraft,editWeight } from './journal-entry.js';
import { journalView } from './journal-view.js';
import { chartMarkup } from './journal-chart.js';
import { mountWeightInsight } from './weight-insight.js';
import { mountStrength } from './strength-entry.js';
const root=document.querySelector('#journal-root'),escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf=new Intl.NumberFormat('en-AU',{maximumFractionDigits:2}),kg=v=>Number.isFinite(v)?nf.format(v):'—',signed=v=>Number.isFinite(v)?(v>0?'+':'')+nf.format(v):'—';
const day=value=>new Date(value+'T12:00:00Z').toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}),dateMs=d=>Date.parse(d+'T12:00:00Z');
const arrow='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>',logo='<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 25 11 7h5L8 25m9 0 8-18h4l-8 18"/></svg>';
const journalParams=new URLSearchParams(location.search);
let data,windowChoice=['30','all'].includes(journalParams.get('window'))?journalParams.get('window'):'90',selection=0,chart,preview,busy=false,animation,motion=true,shown=12,writingWeight=false;
try{motion=localStorage.getItem('mfa-visual-motion')!=='off';}catch{}
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const api=privateJson;
function graph(){const result=chartMarkup({data,selection,kg,day,width:innerWidth<1000?500:900});chart=result.geometry;return result.markup;}
function updateCursor(announce=false){const point=chart?.points[selection];if(!point)return;
 document.querySelector('#selected-kg').textContent=kg(Math.round(point.trendKg*10)/10);
 document.querySelector('#selected-date').textContent=day(point.date)+' · '+(point.held?'Held since '+day(point.heldSince):point.estimated?'Estimated between weigh-ins':'Smoothed trend');
 document.querySelector('#scale-readout').textContent=point.held&&data.latestReading?'Last scale '+kg(data.latestReading.kg)+' kg · '+day(data.latestReading.dateKey):point.kg===null?'No weigh-in recorded on this date.':'Scale reading '+kg(point.kg)+' kg';
 document.querySelector('#previous-reading').disabled=selection===0;document.querySelector('#next-reading').disabled=selection===chart.points.length-1;
 if(announce)document.querySelector('#chart-announcement').textContent=day(point.date)+', trend '+kg(point.trendKg)+' kilograms. '+(point.estimated?'No weigh-in recorded.':'Scale '+kg(point.kg)+' kilograms.');
 const cursor=document.querySelector('#chart-cursor');cursor.querySelector('path').setAttribute('d',`M${chart.x(point)} 24V280`);cursor.querySelector('circle').setAttribute('cx',chart.x(point));cursor.querySelector('circle').setAttribute('cy',chart.y(point.trendKg));
}
function renderReview(message=''){const count=kind=>preview.counts[kind];document.querySelector('#review-content').innerHTML=`<h2 id="review-title" tabindex="-1">Bring this history in?</h2><p class="jr-import-name">${escape(preview.name)}</p><p>${preview.dateRange?day(preview.dateRange[0])+' → '+day(preview.dateRange[1]):'No dated rows'} · exported ${new Date(preview.exportedAt).toLocaleDateString('en-AU')}</p><div class="jr-preview-counts">${[['weights','Weigh-ins'],['sessions','MASS sessions']].map(([key,label])=>`<div><strong>${label}</strong><dl>${[['added','New'],['updated','Updated'],['deleted','Deletion markers'],['unchanged','Unchanged'],['older','Older versions skipped'],['excluded','Before July 2026']].map(([field,title])=>`<div><dt>${title}</dt><dd>${count(key)[field]||0}</dd></div>`).join('')}</dl></div>`).join('')}</div><p>After import: ${preview.result.weights} active MASS weight readings and ${preview.result.sessions} active MASS sessions. Manual weigh-ins stay separate. Missing rows in this file will not delete existing history.</p><p class="jr-section-note">Only weight and session records enter the journal. The original file is kept privately for backup.</p>${message?`<p role="alert" class="tr-error">${escape(message)}</p>`:''}${(preview.overlapDates?.length||preview.overlapSessionDates?.length)&&!preview.duplicate?`<div class="je-same-day"><p>MASS and manual entries overlap on ${preview.overlapDates?.length||0} weigh-in date(s) and ${preview.overlapSessionDates?.length||0} session date(s). Import only if these are separate readings or workouts.</p><label><input type="checkbox" id="confirm-import-overlap" ${preview.confirmSameDay?'checked':''}>These are separate readings or workouts</label></div>`:''}<button class="primary-button" id="commit-import" ${busy?'disabled':''}>${busy?'Saving your history…':'Import records'}</button>${message?'<button class="secondary-button" id="refresh-import-review">Refresh this review</button>':''}<button class="text-button" id="cancel-import" ${busy?'disabled':''}>Cancel</button>`;document.querySelector('#confirm-import-overlap')?.addEventListener('change',e=>preview.confirmSameDay=e.target.checked);document.querySelector('#commit-import').addEventListener('click',commitImport);document.querySelector('#cancel-import').addEventListener('click',closeReview);document.querySelector('#refresh-import-review')?.addEventListener('click',async()=>{if(busy)return;busy=true;const prior=preview;try{const next=await api('/api/mass/preview',{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:prior.raw});preview={...next,name:prior.name,raw:prior.raw};busy=false;renderReview();}catch(e){busy=false;renderReview(e.message);}});document.querySelector('#close-review').disabled=busy;}

function render(animateView=true){
 animation?.revert();document.body.dataset.hasJournal=String(data.entries.length>0);
 root.innerHTML=journalView({data,windowChoice,graph,entry:entryMarkup(data),kg,signed,day,escape,arrow,logo,motion:motion&&!reduced.matches,shown});
 bind();if(animateView)animate();
}
async function load(window=windowChoice,animateView=true){const next=await refreshView('/api/journal?window='+window,{force:true});data=next;windowChoice=window;journalParams.set('window',window);history.replaceState(null,'',location.pathname+'?'+journalParams+location.hash);selection=Math.max(0,(data.trend?.points||data.points).length-1);render(animateView);}
function error(message){document.querySelector('#import-error').textContent=message;}
function notice(message){const node=document.querySelector('#journal-status');node.textContent=message;node.tabIndex=-1;node.focus({preventScroll:true});}
function setBusy(value){writingWeight=value;document.querySelectorAll('[data-window],#choose-file,#more-readings,#log-strength,[data-edit-session],[data-restore-session]').forEach(b=>b.disabled=value);}
function bind(){
 const inspect=(index,announce=true)=>{selection=Math.max(0,Math.min(chart.points.length-1,index));updateCursor(announce);};
 document.querySelector('#previous-reading')?.addEventListener('click',()=>inspect(selection-1));document.querySelector('#next-reading')?.addEventListener('click',()=>inspect(selection+1));
 document.querySelector('#weight-chart')?.addEventListener('keydown',e=>{const next={ArrowLeft:selection-1,ArrowRight:selection+1,Home:0,End:chart.points.length-1}[e.key];if(next!==undefined){e.preventDefault();inspect(next);}});
 document.querySelectorAll('[data-date]').forEach(b=>b.addEventListener('click',()=>{inspect(chart.points.findIndex(p=>p.date===b.dataset.date));document.querySelector('#weight-chart')?.focus();}));
 document.querySelectorAll('[data-window]').forEach(b=>b.addEventListener('click',async()=>{if(writingWeight||b.getAttribute('aria-pressed')==='true')return;document.querySelectorAll('[data-window]').forEach(x=>x.disabled=true);try{await load(b.dataset.window,false);document.querySelector(`[data-window="${windowChoice}"]`).focus({preventScroll:true});}catch(e){setBusy(false);error(e.message);}}));
 document.querySelector('#choose-file')?.addEventListener('click',()=>document.querySelector('#mass-file').click());document.querySelector('#mass-file')?.addEventListener('change',previewFile);
 const exportLink=document.querySelector('a[href="/api/export"]');let exporting=false;
 exportLink?.addEventListener('click',async e=>{if(!data.cloud)return;e.preventDefault();if(exporting)return;exporting=true;const html=exportLink.innerHTML,status=document.querySelector('#import-status');exportLink.setAttribute('aria-disabled','true');exportLink.textContent='Preparing verified backup…';status.textContent='Checking your original files. The download starts when your backup is ready.';try{const result=await api('/api/export?prepare=1');location.assign(result.url);status.textContent='Backup ready. Your browser will download it.';}catch(error){status.textContent=error.message;}finally{exporting=false;exportLink.removeAttribute('aria-disabled');exportLink.innerHTML=html;}});
 document.querySelector('#close-review').addEventListener('click',closeReview);document.querySelector('#mass-review').addEventListener('cancel',e=>{if(busy)e.preventDefault();else closeReview();});
 document.querySelector('#motion').addEventListener('click',()=>{motion=!motion;try{localStorage.setItem('mfa-visual-motion',motion?'on':'off');}catch{}animation?.revert();setMotion();});
 document.querySelector('#more-readings')?.addEventListener('click',()=>{shown+=20;render(false);document.querySelector('#more-readings')?.focus({preventScroll:true});});
 for(const button of document.querySelectorAll('[data-edit-weight],[data-restore-weight]'))button.addEventListener('click',()=>{
  if(writingWeight)return;const restore=Boolean(button.dataset.restoreWeight),entry=(restore?data.removed:data.entries).find(r=>r.entryKey===(button.dataset.editWeight||button.dataset.restoreWeight)&&r.source==='manual');
  if(!entry)return;editWeight(entry,data);render(false);document.querySelector('#quick-log').scrollIntoView({block:'center',behavior:reduced.matches?'instant':'smooth'});document.querySelector('#weight-kg').focus({preventScroll:true});
 });
 mountWeightInsight({data,request:api});
 mountStrength({data,request:api,onBusy:setBusy,refreshData:()=>api('/api/journal?window='+windowChoice),async onSaved(message){await load(windowChoice,false);notice(message);}});
 mountWeightEntry({data,request:api,onBusy:setBusy,onReset(){render(false);document.querySelector('#weight-kg')?.focus({preventScroll:true});},refreshData:()=>api('/api/journal?window='+windowChoice),async onSaved(message){await load(windowChoice,false);notice(message);}});
 const svg=document.querySelector('.jr-chart-frame svg');
 const inspectPointer=e=>{const rect=svg.getBoundingClientRect(),position=(e.clientX-rect.left)/rect.width*chart.width;let nearest=0,best=Infinity;chart.points.forEach((p,i)=>{const distance=Math.abs(chart.x(p)-position);if(distance<best){best=distance;nearest=i;}});inspect(nearest,e.type==='click');};
 svg?.addEventListener('click',inspectPointer);svg?.addEventListener('pointermove',e=>{if(e.pointerType==='mouse')inspectPointer(e);});
 setMotion();
}
function setMotion(){const enabled=motion&&!reduced.matches;document.body.dataset.motion=enabled?'on':'off';document.querySelector('#motion').setAttribute('aria-pressed',String(enabled));document.querySelector('#motion span').textContent=enabled?'on':'off';}
function animate(){if(!motion||reduced.matches||!window.gsap)return;animation=gsap.context(()=>{gsap.from('.jr-title,.jr-entry-panel',{opacity:0,y:14,duration:.55,stagger:.08,ease:'power3.out',clearProps:'all'});const path=document.querySelector('.jr-weight-line');if(path?.getAttribute('d')){const length=path.getTotalLength();gsap.fromTo(path,{strokeDasharray:length,strokeDashoffset:length},{strokeDashoffset:0,duration:.9,ease:'power2.out',clearProps:'strokeDasharray,strokeDashoffset'});}});}
matchMedia('(max-width:999px)').addEventListener('change',()=>{if(data&&!writingWeight&&!busy&&!document.querySelector('#strength-dialog')?.open)render(false);});
reduced.addEventListener('change',()=>{animation?.revert();if(data)setMotion();});
async function previewFile(e){
 const file=e.target.files[0];if(!file)return;e.target.value='';error('');const button=document.querySelector('#choose-file');button.disabled=true;document.querySelector('#import-status').textContent='Reading your MASS backup…';
 try{const max=data.importLimitMB||10;if(file.size>max*1024*1024)throw new Error('Choose a MASS export smaller than '+max+' MB.');const raw=await file.arrayBuffer();preview=await api('/api/mass/preview',{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:raw});preview.name=file.name;preview.raw=raw;renderReview();document.querySelector('#mass-review').showModal();document.querySelector('#review-title').focus({preventScroll:true});document.querySelector('#import-status').textContent='Ready to review. No records saved yet.';}
 catch(e){error(e.message);document.querySelector('#import-status').textContent='Import did not start. Your saved data is unchanged.';}finally{button.disabled=false;}
}
function closeReview(){if(busy)return;document.querySelector('#mass-review').close();preview=null;document.querySelector('#choose-file')?.focus();}
async function commitImport(){
 if(busy||!preview)return;if((preview.overlapDates?.length||preview.overlapSessionDates?.length)&&!preview.duplicate&&!preview.confirmSameDay){renderReview('Confirm that overlapping entries are separate readings or workouts.');document.querySelector('#confirm-import-overlap').focus();return;}busy=true;renderReview();
 try{const options=data.cloud?{headers:{'Content-Type':'application/octet-stream','x-journal-revision':String(preview.headRevision),'x-import-hash':preview.hash,'x-confirm-same-day':preview.confirmSameDay?'1':'0'},body:preview.raw}:{headers:{'Content-Type':'application/json'},body:JSON.stringify({token:preview.token})};
  const result=await api('/api/mass/commit',{method:'POST',...options});document.querySelector('#mass-review').close();busy=false;preview=null;await load(windowChoice,false);
  const changed=Object.values(result.counts).reduce((n,c)=>n+c.added+c.updated+c.deleted,0);const message=result.duplicate||!changed?'Already up to date. No duplicate records added.':'MASS history saved '+(data.cloud?'to your private account.':'on this computer.');document.querySelector('#import-status').textContent=message;notice(message);
 }catch(e){busy=false;if(preview)renderReview(e.message);else error(e.message);}
}
const endpoint='/api/journal?window='+windowChoice;
const cached=viewSnapshot(endpoint)?.value;
if(cached){data=cached;selection=Math.max(0,(data.trend?.points||data.points).length-1);render(false);}
try{
 const next=await refreshView(endpoint);
 // Leave active forms and chart selections in place while refreshing the cache.
 if(!cached||(!busy&&!writingWeight&&!root.contains(document.activeElement)&&data===cached&&JSON.stringify(cached)!==JSON.stringify(next))){
  data=next;selection=Math.max(0,(next.trend?.points||next.points).length-1);render(false);
 }
}catch(e){if(cached){document.querySelector('#journal-status').textContent='Showing saved journal data. Refresh to try again.';}else{root.innerHTML=`<main class="training-loading"><h1>Your journal couldn’t load.</h1><p>${escape(e.message)}</p><button class="primary-button" id="retry">Retry</button><a href="/training" class="text-button">Back to training</a></main>`;document.querySelector('#retry').addEventListener('click',()=>location.reload());}}
