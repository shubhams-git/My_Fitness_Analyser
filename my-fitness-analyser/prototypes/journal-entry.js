const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let draft,owner;
const key=()=>`mfa-private:${owner}:weight-draft`;
function blank(data){return {id:crypto.randomUUID(),operationId:crypto.randomUUID(),revision:0,head:data.revision,dateKey:data.today,kg:'',note:'',deleted:false,confirmSameDay:false};}
function persist(){try{localStorage.setItem(key(),JSON.stringify(draft));}catch{}}
export function clearWeightDraft(){draft=null;try{localStorage.removeItem(key());}catch{}}
export function entryMarkup(data){
  if(!data.canLog)return `<div class="je-intro"><span class="tr-eyebrow">Your journal</span><h2>Import your weigh-ins</h2><p>Import your MASS backup below. Direct weigh-ins are available in your signed-in online account.</p></div>`;
  const changedOwner=owner!==data.viewer.id;owner=data.viewer.id;
  if(changedOwner||!draft){try{draft=JSON.parse(localStorage.getItem(key()));}catch{}if(!draft?.id||!draft.operationId||!Number.isSafeInteger(draft.head))draft=blank(data);}
  // Never silently upgrade an edit's revision after another device changed it.
  if(!draft.revision&&draft.kg==='')draft.head=data.revision;
  return `<form id="weight-form" novalidate><div class="je-intro"><span class="tr-eyebrow">${draft.restoring?'Restore your reading':draft.revision?'Edit your reading':'A moment for the record'}</span><h2>${draft.restoring?'Restore weigh-in':draft.revision?'Edit weigh-in':'New weigh-in'}</h2></div><label for="weight-kg">Body weight <span>kg</span></label><div class="je-weight"><input id="weight-kg" name="kg" type="text" inputmode="decimal" autocomplete="off" placeholder="—" maxlength="8" value="${esc(draft.kg)}" aria-describedby="weight-error"><span>kg</span></div><p id="weight-error" class="je-error" role="alert"></p>${data.latestReading?`<p class="je-last">Last recorded <strong>${esc(Number(data.latestReading.kg.toFixed(2)))} kg</strong><span> · ${new Date(data.latestReading.dateKey+'T12:00:00Z').toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'})}</span><button type="button" id="use-last-weight">Use this value</button></p>`:'<p class="je-last"></p>'}<label for="weight-date">Date</label><input id="weight-date" name="dateKey" type="date" min="2026-07-01" max="${data.today}" value="${esc(draft.dateKey)}" aria-describedby="date-error"><p id="date-error" class="je-error" role="alert"></p><div id="same-day-warning" class="je-same-day" hidden></div><details class="je-note" ${draft.note?'open':''}><summary>Add a note <span>Optional</span></summary><label class="sr-only" for="weight-note">Reading note</label><textarea id="weight-note" name="note" maxlength="2000" rows="2" placeholder="For example: before training">${esc(draft.note)}</textarea><span class="je-note-limit">Up to 2,000 characters</span></details><p id="weight-save-error" class="je-error" role="alert"></p><button class="primary-button je-save" type="submit">${draft.restoring?'Restore reading':draft.revision?'Save changes':'Save reading'}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg></button>${draft.revision?'<div class="je-edit-actions"><button type="button" class="text-button" id="cancel-weight-edit">Cancel edit</button><button type="button" class="text-button je-remove" id="remove-weight">Remove reading</button></div>':''}</form>`;
}
export function editWeight(entry,data){draft={id:entry.entryKey,operationId:crypto.randomUUID(),revision:entry.revision,head:data.revision,dateKey:entry.dateKey,kg:String(entry.kg),note:entry.note||'',deleted:false,confirmSameDay:false,restoring:entry.deletedAt!==null};persist();}
export function mountWeightEntry({data,signal,request,onSaved,onBusy,onReset,refreshData}){
  const form=document.querySelector('#weight-form');if(!form)return;if(draft.restoring)form.querySelector('#remove-weight')?.remove();
  const kg=form.querySelector('#weight-kg'),date=form.querySelector('#weight-date'),note=form.querySelector('#weight-note'),button=form.querySelector('.je-save'),error=form.querySelector('#weight-save-error'),warning=form.querySelector('#same-day-warning');let busy=false,removeArmed=false,saved=false;
  function conflicts(){const others=data.dayReadings.filter(r=>r.dateKey===date.value&&!(r.source==='manual'&&r.entryKey===draft.id));warning.hidden=!others.length;
    if(others.length){warning.innerHTML=`<p>${others.length===1?'Another reading is':'Other readings are'} already recorded on this date: <strong>${others.map(r=>esc(r.kg)+' kg ('+(r.source==='mass'?'MASS':'manual')+')').join(', ')}</strong>.</p><label><input type="checkbox" id="confirm-same-day" ${draft.confirmSameDay?'checked':''}>Keep this as a separate reading</label><p>Both remain in the record. The chart uses their daily average.</p>`;warning.querySelector('input').addEventListener('change',e=>{draft.confirmSameDay=e.target.checked;draft.operationId=crypto.randomUUID();persist();});}
  }
  function changed(){draft.kg=kg.value;draft.dateKey=date.value;draft.note=note.value;draft.operationId=crypto.randomUUID();draft.deleted=false;error.textContent='';persist();}
  kg.addEventListener('input',changed);note.addEventListener('input',changed);date.addEventListener('input',()=>{draft.confirmSameDay=false;changed();conflicts();});
  form.querySelector('#use-last-weight')?.addEventListener('click',()=>{kg.value=String(Number(data.latestReading.kg.toFixed(2)));changed();kg.focus();kg.select();});
  form.querySelector('#cancel-weight-edit')?.addEventListener('click',()=>{clearWeightDraft();onReset();});
  form.querySelector('#remove-weight')?.addEventListener('click',e=>{if(!removeArmed){removeArmed=true;e.target.textContent='Confirm removal';error.textContent='This entry will leave the chart. You can restore it from Removed entries.';return;}void save(true);});
  form.addEventListener('submit',e=>{e.preventDefault();void save(false);});
  async function save(deleted){
    if(busy||saved)return;
    const weight=Number(kg.value.trim().replace(',','.'));const valid=/^\d+(?:[.,]\d{1,2})?$/.test(kg.value.trim())&&weight>0&&weight<=1000;
    form.querySelector('#weight-error').textContent=valid?'':'Enter a weight above 0 and up to 1,000 kg (up to two decimal places).';kg.setAttribute('aria-invalid',String(!valid));
    const validDay=/^\d{4}-\d{2}-\d{2}$/.test(date.value)&&date.value>='2026-07-01'&&date.value<=data.today;
    form.querySelector('#date-error').textContent=validDay?'':'Choose a date from July 2026 through today.';date.setAttribute('aria-invalid',String(!validDay));
    if(!valid||!validDay){(valid?date:kg).focus();return;}
    if(!deleted&&!warning.hidden&&!draft.confirmSameDay){error.textContent='Review the existing reading and confirm that this is a separate entry.';warning.querySelector('input').focus();return;}
    if(draft.deleted!==deleted){draft.operationId=crypto.randomUUID();draft.deleted=deleted;}persist();
    const body={...draft,kg:weight};busy=true;onBusy(true);for(const el of form.elements)el.disabled=true;button.textContent=deleted?'Removing…':'Saving…';error.textContent='';
    let accepted=false;
    try{await request('/api/private?route=weigh-in',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});accepted=true;saved=true;if(draft?.operationId===body.operationId)clearWeightDraft();if(signal?.aborted)return;await onSaved(deleted?'Reading removed. You can restore it below.':body.restoring?'Reading restored to your account.':body.revision?'Reading updated in your account.':'Reading saved to your account.');}
    catch(e){error.textContent=accepted?'Saved to your account. Refresh the journal to see the updated history.':e.message;
      if(accepted&&!signal?.aborted){
        const refresh=document.createElement('button');refresh.type='button';refresh.className='secondary-button';refresh.textContent='Refresh journal';
        refresh.onclick=async()=>{refresh.disabled=true;try{await onSaved('Journal updated.');}catch{error.textContent='Your reading is saved. Couldn’t refresh the journal. Try again.';refresh.disabled=false;}};
        button.after(refresh);refresh.focus();
      }
      if(!accepted&&!signal?.aborted){try{const latest=await refreshData();if(signal?.aborted||draft?.operationId!==body.operationId)return;const own=latest.entries.find(r=>r.source==='manual'&&r.entryKey===draft.id);if(own&&own.revision!==draft.revision){error.textContent+=' A saved version of this reading already exists; open it before making further changes.';}else{data=latest;draft.head=latest.revision;conflicts();persist();}}catch{}}
    }finally{busy=false;onBusy(false);if(form.isConnected){if(!accepted)for(const el of form.elements)el.disabled=false;button.textContent=accepted?'Reading saved':draft.restoring?'Restore reading':draft.revision?'Save changes':'Save reading';if(accepted)button.disabled=true;}}
  }
  conflicts();
}
