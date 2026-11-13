import {privateJson,refreshView} from './session.js';
import { entryMarkup,mountWeightEntry,editWeight } from './journal-entry.js';
import { journalView } from './journal-view.js';
import { chartMarkup } from './journal-chart.js';
import { mountWeightInsight } from './weight-insight.js';
import { mountStrength } from './strength-entry.js';
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf=new Intl.NumberFormat('en-AU',{maximumFractionDigits:2}),kg=v=>Number.isFinite(v)?nf.format(v):'—',signed=v=>Number.isFinite(v)?(v>0?'+':'')+nf.format(v):'—';
const day=value=>new Date(value+'T12:00:00Z').toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}),dateMs=d=>Date.parse(d+'T12:00:00Z');
const arrow='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>';
export function mountJournal({root,route,data:initial,signal}){
const $=selector=>root.querySelector(selector);
const $$=selector=>root.querySelectorAll(selector);
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const api=privateJson;
let data=initial,windowChoice=route.window,selection=lastPoint(initial),chart,preview,busy=false,shown=12,writingWeight=false;
function lastPoint(value){return Math.max(0,(value.trend?.points||value.points).length-1);}
function graph(){const result=chartMarkup({data,selection,kg,day,width:innerWidth<1000?500:900});chart=result.geometry;return result.markup;}
function updateCursor(announce=false){const point=chart?.points[selection];if(!point)return;
 $('#selected-kg').textContent=kg(Math.round(point.trendKg*10)/10);
 $('#selected-date').textContent=day(point.date)+' · '+(point.held?'Held since '+day(point.heldSince):point.estimated?'Estimated between weigh-ins':'Smoothed trend');
 $('#scale-readout').textContent=point.held&&data.latestReading?'Last scale '+kg(data.latestReading.kg)+' kg · '+day(data.latestReading.dateKey):point.kg===null?'No weigh-in recorded on this date.':'Scale reading '+kg(point.kg)+' kg';
 $('#previous-reading').disabled=selection===0;$('#next-reading').disabled=selection===chart.points.length-1;
 if(announce)$('#chart-announcement').textContent=day(point.date)+', trend '+kg(point.trendKg)+' kilograms. '+(point.estimated?'No weigh-in recorded.':'Scale '+kg(point.kg)+' kilograms.');
 const cursor=$('#chart-cursor');cursor.querySelector('path').setAttribute('d',`M${chart.x(point)} 24V280`);cursor.querySelector('circle').setAttribute('cx',chart.x(point));cursor.querySelector('circle').setAttribute('cy',chart.y(point.trendKg));
}
function renderReview(message=''){if(signal.aborted)return;const count=kind=>preview.counts[kind];$('#review-content').innerHTML=`<h2 id="review-title" tabindex="-1">Bring this history in?</h2><p class="jr-import-name">${escape(preview.name)}</p><p>${preview.dateRange?day(preview.dateRange[0])+' → '+day(preview.dateRange[1]):'No dated rows'} · exported ${new Date(preview.exportedAt).toLocaleDateString('en-AU')}</p><div class="jr-preview-counts">${[['weights','Weigh-ins'],['sessions','MASS sessions']].map(([key,label])=>`<div><strong>${label}</strong><dl>${[['added','New'],['updated','Updated'],['deleted','Deletion markers'],['unchanged','Unchanged'],['older','Older versions skipped'],['excluded','Before July 2026']].map(([field,title])=>`<div><dt>${title}</dt><dd>${count(key)[field]||0}</dd></div>`).join('')}</dl></div>`).join('')}</div><p>After import: ${preview.result.weights} active MASS weight readings and ${preview.result.sessions} active MASS sessions. Manual weigh-ins stay separate. Missing rows in this file will not delete existing history.</p><p class="jr-section-note">Only weight and session records enter the journal. The original file is kept privately for backup.</p>${message?`<p role="alert" class="tr-error">${escape(message)}</p>`:''}${(preview.overlapDates?.length||preview.overlapSessionDates?.length)&&!preview.duplicate?`<div class="je-same-day"><p>MASS and manual entries overlap on ${preview.overlapDates?.length||0} weigh-in date(s) and ${preview.overlapSessionDates?.length||0} session date(s). Import only if these are separate readings or workouts.</p><label><input type="checkbox" id="confirm-import-overlap" ${preview.confirmSameDay?'checked':''}>These are separate readings or workouts</label></div>`:''}<button class="primary-button" id="commit-import" ${busy?'disabled':''}>${busy?'Saving your history…':'Import records'}</button>${message?'<button class="secondary-button" id="refresh-import-review">Refresh this review</button>':''}<button class="text-button" id="cancel-import" ${busy?'disabled':''}>Cancel</button>`;$('#confirm-import-overlap')?.addEventListener('change',e=>preview.confirmSameDay=e.target.checked);$('#commit-import').addEventListener('click',commitImport);$('#cancel-import').addEventListener('click',closeReview);$('#refresh-import-review')?.addEventListener('click',async()=>{if(busy)return;busy=true;const prior=preview;try{const next=await api('/api/mass/preview',{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:prior.raw});preview={...next,name:prior.name,raw:prior.raw};busy=false;renderReview();}catch(e){busy=false;renderReview(e.message);}});$('#close-review').disabled=busy;}

function render(){
 document.body.dataset.hasJournal=String(data.entries.length>0);
 if(signal.aborted)return;
 root.innerHTML=journalView({data,windowChoice,graph,entry:entryMarkup(data),kg,signed,day,escape,arrow,shown});
 bind();
}
async function load(window=windowChoice){
 const next=await refreshView('/api/journal?window='+window,'journal',{force:true});
 if(signal.aborted)return;
 data=next;
 windowChoice=window;
 const url=new URL(location.href);
 url.searchParams.set('window',window);
 history.replaceState(history.state,'',url);
 selection=lastPoint(data);
 render();
}
function error(message){const status=$('#import-error');if(status)status.textContent=message;}
function notice(message){const node=$('#journal-status');if(!node||signal.aborted)return;node.textContent=message;node.tabIndex=-1;node.focus();}
function offerJournalRefresh(message){
 if(signal.aborted)return;
 notice(message+' The journal could not refresh.');
 const button=document.createElement('button');button.type='button';button.className='secondary-button';button.textContent='Refresh journal';
 $('#journal-status').after(button);
 button.addEventListener('click',async()=>{
  button.disabled=true;
  try{await load(windowChoice);notice('Journal updated.');}catch{if(!signal.aborted){button.disabled=false;button.focus();}}
 });
}
function setBusy(value){writingWeight=value;if(signal.aborted)return;$$('[data-window],#choose-file,#more-readings,#log-strength,[data-edit-session],[data-restore-session]').forEach(b=>b.disabled=value);}
function bind(){
 const inspect=(index,announce=true)=>{const next=Math.max(0,Math.min(chart.points.length-1,index));if(selection!==next||announce){selection=next;updateCursor(announce);}};
 $('#previous-reading')?.addEventListener('click',()=>inspect(selection-1));$('#next-reading')?.addEventListener('click',()=>inspect(selection+1));
 $('#weight-chart')?.addEventListener('keydown',e=>{const next={ArrowLeft:selection-1,ArrowRight:selection+1,Home:0,End:chart.points.length-1}[e.key];if(next!==undefined){e.preventDefault();inspect(next);}});
 $$('[data-date]').forEach(b=>b.addEventListener('click',()=>{inspect(chart.points.findIndex(p=>p.date===b.dataset.date));$('#weight-chart')?.focus();}));
 $$('[data-window]').forEach(b=>b.addEventListener('click',async()=>{if(writingWeight||b.getAttribute('aria-pressed')==='true')return;$$('[data-window]').forEach(x=>x.disabled=true);try{await load(b.dataset.window);$(`[data-window="${windowChoice}"]`)?.focus({preventScroll:true});}catch(e){if(!signal.aborted){setBusy(false);notice(e.message);}}}));
 $('#choose-file')?.addEventListener('click',()=>$('#mass-file').click());$('#mass-file')?.addEventListener('change',previewFile);
 const exportLink=$('a[href="/api/export"]');let exporting=false;
 exportLink?.addEventListener('click',async e=>{if(!data.cloud)return;e.preventDefault();if(exporting)return;exporting=true;const html=exportLink.innerHTML,status=$('#import-status');exportLink.setAttribute('aria-disabled','true');exportLink.textContent='Preparing verified backup…';status.textContent='Checking your original files. The download starts when your backup is ready.';try{const result=await api('/api/export?prepare=1');location.assign(result.url);status.textContent='Backup ready. Your browser will download it.';}catch(error){status.textContent=error.message;}finally{exporting=false;exportLink.removeAttribute('aria-disabled');exportLink.innerHTML=html;}});
 $('#close-review').addEventListener('click',closeReview);$('#mass-review').addEventListener('cancel',e=>{if(busy)e.preventDefault();else closeReview();});
 $('#more-readings')?.addEventListener('click',()=>{shown+=20;render();$('#more-readings')?.focus({preventScroll:true});});
 for(const button of $$('[data-edit-weight],[data-restore-weight]'))button.addEventListener('click',()=>{
  if(writingWeight)return;const restore=Boolean(button.dataset.restoreWeight),entry=(restore?data.removed:data.entries).find(r=>r.entryKey===(button.dataset.editWeight||button.dataset.restoreWeight)&&r.source==='manual');
  if(!entry)return;editWeight(entry,data);render();$('#quick-log').scrollIntoView({block:'center',behavior:reduced.matches?'instant':'smooth'});$('#weight-kg').focus({preventScroll:true});
 });
 mountWeightInsight({data,request:api});
 mountStrength({data,signal,request:api,onBusy:setBusy,refreshData:()=>api('/api/journal?window='+windowChoice),async onSaved(message){try{await load(windowChoice);notice(message);}catch{offerJournalRefresh(message);}}});
 mountWeightEntry({data,signal,request:api,onBusy:setBusy,onReset(){render();$('#weight-kg')?.focus({preventScroll:true});},refreshData:()=>api('/api/journal?window='+windowChoice),async onSaved(message){await load(windowChoice);notice(message);}});
 const svg=$('.jr-chart-frame svg');
 let frame=0,pointerX;
 const inspectPointer=(clientX,announce)=>{
  const rect=svg.getBoundingClientRect(),position=(clientX-rect.left)/rect.width*chart.width;
  let lo=0,hi=chart.points.length-1;
  while(lo<hi){const mid=(lo+hi)>>1;if(chart.x(chart.points[mid])<position)lo=mid+1;else hi=mid;}
  inspect(lo&&position-chart.x(chart.points[lo-1])<chart.x(chart.points[lo])-position?lo-1:lo,announce);
 };
 svg?.addEventListener('click',e=>inspectPointer(e.clientX,true));
 svg?.addEventListener('pointermove',e=>{
  if(e.pointerType!=='mouse')return;
  pointerX=e.clientX;
  if(!frame)frame=requestAnimationFrame(()=>{frame=0;if(svg.isConnected)inspectPointer(pointerX,false);});
 });
}
matchMedia('(max-width:999px)').addEventListener('change',()=>{
 if(!writingWeight&&!busy&&!$('dialog[open]'))render();
},{signal});
async function previewFile(e){
 const file=e.target.files[0];if(!file)return;e.target.value='';error('');const button=$('#choose-file');button.disabled=true;$('#import-status').textContent='Reading your MASS backup…';
 try{const max=data.importLimitMB||10;if(file.size>max*1024*1024)throw new Error('Choose a MASS export smaller than '+max+' MB.');const raw=await file.arrayBuffer();const next=await api('/api/mass/preview',{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:raw});if(signal.aborted)return;preview=next;preview.name=file.name;preview.raw=raw;renderReview();$('#mass-review').showModal();$('#review-title').focus({preventScroll:true});$('#import-status').textContent='Ready to review. No records saved yet.';}
 catch(e){if(signal.aborted)return;error(e.message);$('#import-status').textContent='Import did not start. Your saved data is unchanged.';}finally{button.disabled=false;}
}
function closeReview(){if(busy)return;$('#mass-review').close();preview=null;$('#choose-file')?.focus();}
async function commitImport(){
 if(busy||!preview)return;if((preview.overlapDates?.length||preview.overlapSessionDates?.length)&&!preview.duplicate&&!preview.confirmSameDay){renderReview('Confirm that overlapping entries are separate readings or workouts.');$('#confirm-import-overlap').focus();return;}busy=true;renderReview();
 try{const options=data.cloud?{headers:{'Content-Type':'application/octet-stream','x-journal-revision':String(preview.headRevision),'x-import-hash':preview.hash,'x-confirm-same-day':preview.confirmSameDay?'1':'0'},body:preview.raw}:{headers:{'Content-Type':'application/json'},body:JSON.stringify({token:preview.token})};
  const result=await api('/api/mass/commit',{method:'POST',...options});if(signal.aborted)return;$('#mass-review').close();busy=false;preview=null;
  const changed=Object.values(result.counts).reduce((n,c)=>n+c.added+c.updated+c.deleted,0);const message=result.duplicate||!changed?'Already up to date. No duplicate records added.':'MASS history saved '+(data.cloud?'to your private account.':'on this computer.');
  try{await load(windowChoice);if(!signal.aborted){$('#import-status').textContent=message;notice(message);}}catch{offerJournalRefresh(message);}
 }catch(e){busy=false;if(preview)renderReview(e.message);else error(e.message);}
}
render();
}
