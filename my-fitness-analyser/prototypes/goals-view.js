import {goalAt,nextGoal,weekStart,shiftDay,validateGoal,GOAL_KINDS,GOAL_DISTANCES,goalTime,parseGoalTime} from './goal-model.js';
import {privateJson} from './session.js';
const labels={'weekly-distance':'Weekly running distance','run-time':'Run time',weight:'Weight'};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=v=>new Date(v+'T12:00Z').toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
const km=v=>new Intl.NumberFormat('en-AU',{maximumFractionDigits:3}).format(v/1000)+' km';
const target=g=>g.kind==='weight'?g.target+' kg':g.kind==='run-time'?goalTime(g.target)+' for '+km(g.distanceM):km(g.target);
const link=kind=>'/account?goal='+kind+'#goals';
export function goalMarkup(p,kind){
 if(!p||p.status==='unset')return `<section class="goal-strip"><h2>${labels[kind]} goal</h2><a href="${link(kind)}" aria-label="Set ${labels[kind].toLowerCase()} goal">Set a goal</a></section>`;
 const g=p.goal;
 const summary=p.status==='paused'?'Goal paused':p.status==='planned'?`${target(g)} from ${date(g.effectiveFrom)}`:kind==='weekly-distance'?`${km(p.done)} of ${target(g)}`:kind==='run-time'?p.done==null?`Target ${target(g)}`:`${goalTime(p.done)} / ${target(g)}`:p.current==null?`Target ${target(g)}`:`${p.current} kg toward ${target(g)}`;
 const measured=p.status==='active'||p.status==='met';
 const detail=!measured?'':p.status==='met'?'Target reached.':kind==='weekly-distance'?`${km(p.remaining)} to go · week ends ${date(p.weekThrough)}`:kind==='run-time'?p.done==null?'An eligible recorded effort after your start date will count.':`${goalTime(p.remaining)} to target · best recorded elapsed effort`:p.current==null?'Your first weigh-in will start progress.':`${p.remaining} kg from target · trend measured ${date(p.measuredDate)}`;
 return `<section class="goal-strip" aria-label="${labels[kind]} goal"><h2>${labels[kind]} goal</h2><a href="${link(kind)}" aria-label="Edit ${labels[kind].toLowerCase()} goal">Edit goal</a><strong>${esc(summary)}</strong>${measured&&kind!=='run-time'&&Number.isFinite(p.percent)?`<progress aria-label="${labels[kind]} goal progress" max="100" value="${Math.min(100,p.percent)}"></progress>`:''}${detail?`<p>${esc(detail)}${g.deadline?' · target '+date(g.deadline):''}</p>`:''}</section>`;
}
export async function mountGoals(root){
 let pack,kind=new URLSearchParams(location.search).get('goal'),editing=false,busy=false,status='',pending;
 const drafts=new Map();
 if(!GOAL_KINDS.includes(kind))kind='weekly-distance';
 async function load(){try{pack=await privateJson('/api/private?route=goals');render();if(location.hash==='#goals')root.scrollIntoView();}catch(e){root.innerHTML=`<h2>Your goals</h2><p role="alert">${esc(e.message)}</p><button type="button" class="secondary-button">Retry</button>`;root.querySelector('button').onclick=load;}}
 function render(){
  const rows=pack.versions.filter(v=>v.kind===kind).toSorted((a,b)=>b.revision-a.revision),active=goalAt(rows,kind,pack.today),next=nextGoal(rows,kind,pack.today),seed=active||next,prior=seed?.target!=null?seed:rows.find(v=>v.target!=null);
  const weekly=kind==='weekly-distance',run=kind==='run-time',defaultDate=weekly?weekStart(pack.today):pack.today;
  root.innerHTML=`<div class="zn-heading"><h2>Your goals</h2><a href="${kind==='weight'?'/journal':'/training?view=progress'}">View progress</a></div><div class="zn-tabs goal-tabs" role="group" aria-label="Goal type">${GOAL_KINDS.map(k=>`<button type="button" data-goal-kind="${k}" aria-pressed="${kind===k}">${labels[k]}</button>`).join('')}</div>${editing?`<form class="zn-form"><fieldset><legend class="sr-only">${labels[kind]} goal</legend><div class="zn-form-top"><label>${weekly?'Week starting Monday':'Starts on'}<input name="effectiveFrom" type="date" min="2026-07-01" max="${shiftDay(pack.today,366)}" value="${next&&!active?next.effectiveFrom:defaultDate}" required></label>${run?`<label>Benchmark distance<select name="distanceM" required><option value="">Choose distance</option>${GOAL_DISTANCES.map(d=>`<option value="${d}" ${prior?.distanceM===d?'selected':''}>${km(d)}</option>`).join('')}</select></label>`:''}<label>${run?'Target time (m:ss or h:mm:ss)':weekly?'Target distance (km)':'Target weight (kg)'}<input name="target" type="text" inputmode="${run?'text':'decimal'}" value="${prior?(run?goalTime(prior.target):weekly?prior.target/1000:prior.target):''}" required></label>${weekly?'':`<label>Target date (optional)<input name="deadline" type="date" value="${prior?.deadline||''}"></label>`}</div><p class="zn-help">${weekly?'Counts recorded running distance each Monday to Sunday.':run?'Uses elapsed best efforts recorded on or after the start.':'Tracks your smoothed weight trend from the chosen start.'}</p><div class="zn-actions"><button class="primary-button" type="submit">Save goal</button><button type="button" class="text-button" data-cancel>Cancel</button>${seed?.target!=null?`<button type="button" class="text-button" data-pause>Pause from ${date(defaultDate)}</button>`:''}</div></fieldset><p id="goal-status" class="zn-status" role="alert"></p><button type="button" class="text-button" data-reload hidden>Discard edits and reload</button></form>`:`<p class="zn-empty">${seed?seed.target===null?'Goal paused.':esc(target(seed))+' · '+(active?'from ':'starts ')+date(seed.effectiveFrom):'Choose your own target. Your progress will appear beside your training or weight chart.'}</p><button type="button" class="secondary-button" data-edit>${seed?'Edit goal':'Set goal'}</button><p class="zn-status" role="status">${esc(status)}</p>`}${rows.length?`<details class="zn-history"><summary>Goal history</summary><ol>${rows.map(v=>`<li><span>${date(v.effectiveFrom)} · v${v.revision}</span><span>${v.target===null?'Paused':esc(target(v))}</span></li>`).join('')}</ol></details>`:''}`;
  const form=root.querySelector('form');
  if(form&&drafts.has(kind))for(const [name,value] of drafts.get(kind)){const field=form.elements.namedItem(name);if(field)field.value=value;}
  root.querySelectorAll('[data-goal-kind]').forEach(b=>b.onclick=()=>{
   if(busy||kind===b.dataset.goalKind)return;
   if(form)drafts.set(kind,[...new FormData(form)]);
   kind=b.dataset.goalKind;editing=drafts.has(kind);pending=null;status='';
   const url=new URL(location.href);url.searchParams.set('goal',kind);history.replaceState(history.state,'',url);
   render();root.querySelector('[data-goal-kind="'+kind+'"]').focus();
  });
  root.querySelector('[data-edit]')?.addEventListener('click',()=>{editing=true;render();root.querySelector('[name=target]').focus();});
  root.querySelector('[data-cancel]')?.addEventListener('click',()=>{drafts.delete(kind);editing=false;pending=null;render();root.querySelector('[data-edit]').focus();});
  if(!form)return;
  const out=form.querySelector('#goal-status'),reload=form.querySelector('[data-reload]');
  reload.onclick=async()=>{if(busy)return;busy=true;reload.disabled=true;form.querySelector('fieldset').disabled=true;drafts.delete(kind);editing=false;pending=null;status='Saved goals reloaded.';await load();busy=false;root.querySelector('[data-edit]')?.focus();};
  const save=async paused=>{
   if(busy)return;const f=new FormData(form),raw=String(f.get('target')||'').trim(),n=raw&&/^\d+(?:\.\d+)?$/.test(raw)?Number(raw):NaN;let value;
   try{value=validateGoal({kind,effectiveFrom:paused?defaultDate:f.get('effectiveFrom'),target:paused?null:run?parseGoalTime(raw):weekly?Math.round(n*1000):n,deadline:paused?null:f.get('deadline')||null,distanceM:paused||!run?null:Number(f.get('distanceM'))},pack.today);}catch(e){out.textContent=e.message;const field=form.elements.namedItem(e.field);field?.setAttribute('aria-invalid','true');field?.setAttribute('aria-describedby','goal-status');field?.focus();return;}
   const body={...value,expectedRevision:rows[0]?.revision||0},fingerprint=JSON.stringify(body);if(pending?.fingerprint!==fingerprint)pending={fingerprint,id:crypto.randomUUID()};
   busy=true;form.querySelector('fieldset').disabled=true;reload.disabled=true;out.textContent='Saving goal…';
   try{pack=await privateJson('/api/private?route=goals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,operationId:pending.id})});drafts.delete(kind);editing=false;pending=null;status='Saved from '+date(value.effectiveFrom)+'.';render();root.querySelector('[data-edit]').focus();}
   catch(e){out.textContent=e.message;form.querySelector('fieldset').disabled=false;reload.hidden=e.status!==409;reload.disabled=false;}finally{busy=false;}
  };
  form.onsubmit=e=>{e.preventDefault();void save(false);};form.querySelector('[data-pause]')?.addEventListener('click',()=>void save(true));
 }
 await load();
}
