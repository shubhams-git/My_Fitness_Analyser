import { insightText,reportHasSupportedLimits } from './insight-format.js';
import { privateJson } from './session.js';
if(!document.querySelector('link[href="/coaching.css"]')){const css=document.createElement('link');css.rel='stylesheet';css.href='/coaching.css';document.head.append(css);}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function formatFact(f){const v=f?.value;if(!Number.isFinite(v))return 'Unavailable';if(f.unit==='zone')return 'Zone '+Math.round(v);if(f.unit==='%')return new Intl.NumberFormat('en-AU',{maximumFractionDigits:1}).format(v)+'%';if(f.unit==='s/km'){const n=Math.round(Math.abs(v));return (v<0?'−':'')+Math.floor(n/60)+':'+String(n%60).padStart(2,'0')+' /km';}if(f.unit==='m')return new Intl.NumberFormat('en-AU',{maximumFractionDigits:2}).format(v/1000)+' km';if(f.unit==='s'){const n=Math.round(v);return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');}return new Intl.NumberFormat('en-AU',{maximumFractionDigits:1}).format(v)+(f.unit==='count'?'':f.unit==='bpm'?' bpm':f.unit==='spm'?' spm':f.unit==='/10'?' /10':' '+f.unit);}
const chartLabels={pace:'Pace comparison',distance:'Distance comparison',heart_rate:'Heart-rate comparison'};
const chartFacts={pace:'paceSPerKm',distance:'distanceM',heart_rate:'hrBpm'};

export function coachingContent(review){
 if(!review||review.stale||!reportHasSupportedLimits(review.report,review.evidence.facts))return '';
 const {verdict,findings,charts}=review.report;
 const facts=new Map(review.evidence.facts.map(f=>[f.id,f]));
 const prose=text=>esc(insightText(text,review.evidence.facts,formatFact));
 const proof=(ids,heading)=>{
  const measurements=ids.map(id=>facts.get(id)).filter(Boolean);
  const refs=[...new Set(measurements.flatMap(f=>f.sessionIds||[]))].filter(ref=>review.mapping[ref]);
  return `<details class="ai-evidence"><summary aria-label="Supporting evidence for ${prose(heading)}">Supporting evidence</summary>
   <dl class="ai-proof">${measurements.map(f=>`<div><dt>${esc(f.label)}</dt><dd>${esc(formatFact(f))}</dd></div>`).join('')}</dl>
   ${refs.length?`<div class="ai-source-links">${refs.map((ref,i)=>`<a href="/app.html?activity=${encodeURIComponent(review.mapping[ref])}">View cited run ${i+1}</a>`).join('')}</div>`:''}
  </details>`;
 };
 const comparison=chart=>`<details class="ai-evidence ai-comparison"><summary>${chartLabels[chart.type]}</summary>
  <table><caption class="sr-only">Recorded values for the cited runs</caption>
  <thead><tr><th scope="col">Run</th><th scope="col">Value</th></tr></thead>
  <tbody>${chart.sessionIds.map((ref,i)=>{
   const value=formatFact(facts.get(ref+'.'+chartFacts[chart.type]));
   const distance=facts.get(ref+'.distanceM');
   const label=`Run ${i+1}${distance&&chart.type!=='distance'?' · '+formatFact(distance):''}`;
   return `<tr><th scope="row">${review.mapping[ref]?`<a href="/app.html?activity=${encodeURIComponent(review.mapping[ref])}">${esc(label)}</a>`:esc(label)}</th><td>${esc(value)}</td></tr>`;
  }).join('')}</tbody></table></details>`;
 return `<div class="ai-verdict">
   <h3 tabindex="-1">${prose(verdict.text)}</h3><p class="ai-explanation">${prose(verdict.explanation)}</p>
   ${proof(verdict.factIds,verdict.text)}
  </div>
  ${findings.length?`<section class="ai-analysis" aria-labelledby="ai-analysis-heading">
   <h3 id="ai-analysis-heading">Training findings</h3>
   ${findings.map(f=>`<article><h4>${prose(f.headline)}</h4>
    <p>${prose(f.explanation)}</p><p class="ai-action-line">${prose(f.nextAction)}</p>
    ${proof(f.factIds,f.headline)}</article>`).join('')}
  </section>`:''}
  ${charts.map(comparison).join('')}
  <div class="ai-next"><h3>For your next run</h3><p>${prose(verdict.nextAction)}</p></div>
  <p class="ai-fine">Updated ${esc(new Date(review.generatedAt).toLocaleDateString('en-AU'))} · ${review.fallback?'Run record':esc(review.model)}</p>`;
}

export async function mountCoaching(root,{settings=false}={}){
 root.classList.add('ai-space');root.id=settings?'ai-settings':'coaching';root.innerHTML='<p role="status">Opening your coaching brief…</p>';
 let state,busy=false,message='',destroyed=false,request=0,startedAt=0,timer;
 const updateElapsed=()=>{const elapsed=root.querySelector('[data-ai-elapsed]');if(elapsed)elapsed.textContent=Math.floor((Date.now()-startedAt)/1000)+'s elapsed';};
 const notice=()=>`<details class="ai-sharing"><summary>What is shared with Gemini?</summary><p>Outdoor Garmin run metrics and check-ins, plus workout types, durations and strength focus from the last two weeks. Names, email, GPS routes, screenshots, free-text notes and credentials stay out.</p><p>Google’s free service may use requests to improve its products, including human review. Its unpaid-service terms restrict personal or sensitive submissions; your app permission does not change those terms. <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noopener noreferrer">Google’s data terms</a>.</p><p>Switching off stops new requests and hides saved briefings. Requests already sent cannot be recalled.</p></details>`;
 function render(){if(destroyed||!root.isConnected)return;const consent=state?.consent||{},enabled=consent.enabled===true,unanswered=consent.enabled==null,stored=state?.review,review=stored&&!reportHasSupportedLimits(stored.report)?{...stored,stale:true,unsupported:true}:stored,needsRuns=Number.isFinite(state?.runs)&&state.runs<(state.minRuns||2),recordedOnly=['coverage','discomfort'].includes(review?.fallback);
 root.innerHTML=`<div class="ai-header"><h2>${settings?'Your AI preferences':'Your coaching brief'}</h2><span class="ai-status">${enabled?(review?.fallback?'Run record':review&&!review.stale?'Gemini analysis':'AI enabled'):'AI off'}</span></div>
 ${enabled&&!settings&&['provider','cooldown'].includes(review?.fallback)?`<p class="ai-fine">${review.fallback==='cooldown'?'A new analysis will be available shortly.':'Gemini could not complete the analysis. You can retry below.'}</p>`:''}
 ${!enabled||settings?`<div class="ai-consent"><h3>${settings?'You choose what gets analysed.':unanswered?'Get advice for your next run.':'Your runs are ready when you are.'}</h3><p>${enabled?'Gemini reviews your outdoor runs and recent workouts when you ask.':unanswered?'Allow Gemini to use your outdoor run data and recent workout summaries, including strength sessions from your Journal.':'Your charts and logging stay available with AI off.'}</p>${notice()}<div class="ai-actions">${enabled?'<button class="secondary-button" data-ai="deny">Turn AI off</button>':`<button class="primary-button" data-ai="allow">Allow training analysis</button>${unanswered?'<button class="text-button" data-ai="deny">Not now</button>':''}`}</div></div>`:''}
 ${enabled&&!settings?(review&&!review.stale?coachingContent(review):`<div class="ai-ready"><h3>${needsRuns?'Start with an outdoor run.':review?'An updated analysis is available to request.':'Review your recent training.'}</h3><p>${needsRuns?'Sync an outdoor Garmin run to build your coaching brief.':review?'Review your outdoor runs alongside your recent workouts.':'Get an evidence-backed analysis of your recent runs and workouts, with a practical next step.'}</p></div>`):''}
 ${enabled&&!settings?`<div class="ai-actions">${recordedOnly?'':needsRuns?'<a class="primary-button" href="/account">Connect Garmin</a>':!review||review.stale||review.fallback?`<button class="primary-button" data-ai="generate" ${busy||!state.configured?'disabled':''}>${busy?'Reading your training…':review?'Update analysis':'Analyse my training'}</button>`:''}<a class="text-button" href="/account#ai-settings">AI settings</a></div>${!recordedOnly&&!state.configured?'<p class="ai-fine">Gemini is unavailable here. Your training stays ready to explore.</p>':''}${review?.stale&&!review.unsupported?`<details class="ai-previous"><summary>Previous brief · ${new Date(review.generatedAt).toLocaleDateString('en-AU')}</summary><p>${esc(review.report.verdict.text).replace(/\{([\w.]+)\}/g,(_,id)=>esc(formatFact(review.evidence.facts.find(f=>f.id===id))))}</p></details>`:''}`:''}
 ${startedAt&&busy?`<div class="ai-wait"><progress aria-label="Preparing your coaching brief"></progress><div><span>Reviewing your training</span><span data-ai-elapsed aria-hidden="true"></span></div><p>You can read your previous brief or explore the rest of Training while this runs.</p></div>`: ''}
 <p class="ai-message" role="status" aria-live="polite">${esc(message)}</p>`;
 root.querySelectorAll('[data-ai]').forEach(b=>{b.disabled=busy||(b.dataset.ai==='generate'&&!state.configured);b.addEventListener('click',()=>act(b.dataset.ai));});
 }
 async function load(){const token=++request,next=await privateJson('/api/private?route=ai-review');if(token===request){state=next;render();}}
 async function act(action){if(busy)return;let showVerdict=false;busy=true;message=action==='generate'?'':'Saving your choice…';if(action==='generate'){startedAt=Date.now();timer=setInterval(updateElapsed,1000);}render();updateElapsed();try{if(action==='generate'){state.review=await privateJson('/api/private?route=ai-review',{method:'POST'});showVerdict=true;message=['coverage','discomfort'].includes(state.review.fallback)?'Your recorded brief is ready.':state.review.fallback==='cooldown'?'Here’s your run summary. You can retry Gemini shortly.':state.review.fallback?'Gemini is temporarily unavailable. Here’s what your run record shows.':'Your coaching brief is ready.';}else{const consent=await privateJson('/api/private?route=ai-consent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:action==='allow'})});state={...state,consent,review:null};try{localStorage.setItem('mfa-ai-preference-changed',String(Date.now()));}catch{}message=consent.enabled?'Analysis is enabled. Request your brief when ready.':'AI is off.';await load();}}catch(e){message=e.message;}finally{clearInterval(timer);startedAt=0;busy=false;render();const verdict=showVerdict&&root.querySelector('.ai-verdict h3');if(verdict)verdict.focus();else{const status=root.querySelector('.ai-message');status?.setAttribute('tabindex','-1');status?.focus({preventScroll:true});}}}
 const changed=event=>{if(event.key==='mfa-ai-preference-changed')void load().catch(e=>{root.textContent=e.message;});};addEventListener('storage',changed);addEventListener('pagehide',()=>{destroyed=true;clearInterval(timer);removeEventListener('storage',changed);},{once:true});
 try{await load();}catch(e){root.innerHTML=`<h2>Your coaching brief</h2><p role="status">${esc(e.message)}</p><button class="text-button" id="retry-coach">Try again</button>`;root.querySelector('#retry-coach').addEventListener('click',()=>void load().catch(e=>root.querySelector('[role=status]').textContent=e.message));}
}
