const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let draft,owner;
const key=()=>`mfa-private:${owner}:strength-draft`;
const empty=data=>({id:crypto.randomUUID(),operationId:crypto.randomUUID(),revision:0,head:data.revision,dateKey:data.today,focus:'',mins:'',note:'',deleted:false,confirmSeparate:false,withCheckin:false,checkin:{completion:'',effort:'',legFatigue:'',discomfort:'',location:''}});
function persist(){try{localStorage.setItem(key(),JSON.stringify(draft));}catch{}}
function clear(){draft=null;try{localStorage.removeItem(key());}catch{}}
const choices=(name,title,values)=>`<fieldset class="se-question"><legend>${title}</legend><div class="se-choices ${name==='effort'?'se-effort':''}">${values.map(([v,label])=>`<label><input type="radio" name="${name}" value="${v}" ${String(draft.checkin[name])===String(v)?'checked':''}><span>${label}</span></label>`).join('')}</div></fieldset>`;

export function strengthDialog(){return '<dialog id="strength-dialog" aria-labelledby="strength-title"><div id="strength-content"></div></dialog>';}
export function mountStrength({data,request,onSaved,onBusy,refreshData}){
 if(!data.canLogStrength)return;
 if(owner!==data.viewer.id){owner=data.viewer.id;draft=null;}
 const dialog=document.querySelector('#strength-dialog'),content=document.querySelector('#strength-content');let busy=false,removeArmed=false;
 function open(entry){
  if(entry){draft={...empty(data),...entry,id:entry.entryKey,head:data.revision,mins:entry.mins===null?'':String(entry.mins),withCheckin:Boolean(entry.checkin),checkin:entry.checkin||empty(data).checkin,deleted:false,restoring:entry.deleted};persist();}
  else if(!draft){try{draft=JSON.parse(localStorage.getItem(key()));}catch{}if(!draft?.id||!draft.checkin||!Number.isSafeInteger(draft.head))draft=empty(data);}
  if(!entry&&draft.revision){clear();draft=empty(data);}
  if(!draft.focus&&!draft.revision)draft.head=data.revision;
  removeArmed=false;render();dialog.showModal();content.querySelector('#strength-title').focus();
 }
 function overlaps(){return (data.daySessions||[]).filter(s=>s.dateKey===draft.dateKey&&!(s.source==='manual'&&s.entryKey===draft.id));}
 function overlapMarkup(){const rows=overlaps();return rows.length?`<div class="je-same-day"><p>Already on this date: ${rows.map(s=>esc(s.focus)+' ('+(s.source==='manual'?'manual':'MASS')+')').join(', ')}.</p><label><input type="checkbox" name="confirmSeparate" ${draft.confirmSeparate?'checked':''}>This is a separate workout</label><p>Do not add it again if this is the same session.</p></div>`:'';}
 function render(){
 content.innerHTML=`<form id="strength-form" novalidate><header class="se-header"><div><p>Strength journal</p><h2 id="strength-title" tabindex="-1">${draft.restoring?'Restore your session.':draft.revision?'Your session, in detail.':'Record the work.'}</h2></div><button type="button" class="icon-button" id="close-strength" aria-label="Close strength entry">×</button></header><div class="se-body"><div class="se-details"><label>Session focus<select name="focus" aria-describedby="strength-error"><option value="">Choose your session</option>${['Push','Pull','Legs','Upper body','Lower body','Full body','Strength'].map(f=>`<option ${draft.focus===f?'selected':''}>${f}</option>`).join('')}</select></label><div class="se-date-duration"><label>Date<input name="dateKey" type="date" min="2026-07-01" max="${data.today}" value="${esc(draft.dateKey)}"></label><label>Minutes <span>Optional</span><input name="mins" type="text" inputmode="numeric" placeholder="e.g. 45" maxlength="4" value="${esc(draft.mins)}"></label></div></div><div id="session-overlap">${overlapMarkup()}</div><label class="se-checkin-toggle"><input type="checkbox" name="withCheckin" ${draft.withCheckin?'checked':''}><span>Add a quick check-in<small>How it went, beyond the numbers.</small></span></label><div id="strength-questions" ${draft.withCheckin?'':'hidden'}>${choices('completion','How did the session go?',[['planned','As planned'],['modified','Modified'],['cut-short','Cut short']])}${choices('effort','Whole-session effort',Array.from({length:10},(_,i)=>[i+1,i+1]))}<p class="se-scale"><span>1 · Very easy</span><span>10 · Maximum</span></p>${choices('legFatigue','How do your legs feel?',[['fresh','Fresh'],['noticeable','Noticeable fatigue'],['heavy','Heavy']])}${choices('discomfort','Any discomfort?',[['none','None'],['mild','Mild'],['affected','Affected the session']])}<label id="strength-location-label" ${!draft.checkin.discomfort||draft.checkin.discomfort==='none'?'hidden':''}>Where did you feel it?<input name="location" maxlength="200" value="${esc(draft.checkin.location)}" placeholder="For example: left knee"></label></div><label class="se-note">Session note <span>Optional</span><textarea name="note" rows="2" maxlength="2000" placeholder="Anything worth remembering">${esc(draft.note)}</textarea></label><p class="se-storage">${draft.withCheckin?'All four answers are needed to save the check-in.':'You can add a check-in later. No answers will be assumed.'}</p><p id="strength-error" class="je-error" role="alert" tabindex="-1"></p></div><footer class="se-footer"><button type="submit" class="primary-button">${draft.restoring?'Restore session':draft.revision?'Save changes':'Save session'}</button>${draft.revision&&!draft.restoring?'<button type="button" class="text-button je-remove" id="remove-session">Remove session</button>':'<button type="button" class="text-button" id="reset-strength">Start fresh</button>'}</footer></form>`;
 const form=content.querySelector('form');
 form.addEventListener('input',e=>{
  const {name,value,type,checked}=e.target;
  if(['completion','effort','legFatigue','discomfort','location'].includes(name))draft.checkin[name]=value;
  else draft[name]=type==='checkbox'?checked:value;
  draft.operationId=crypto.randomUUID();draft.deleted=false;persist();
  if(name==='dateKey'){draft.confirmSeparate=false;content.querySelector('#session-overlap').innerHTML=overlapMarkup();}
  if(name==='withCheckin')content.querySelector('#strength-questions').hidden=!checked;
  if(name==='discomfort'){content.querySelector('#strength-location-label').hidden=value==='none';if(value==='none'){draft.checkin.location='';form.elements.location.value='';persist();}}
 });
 form.addEventListener('submit',e=>{e.preventDefault();void save(false);});
 content.querySelector('#close-strength').addEventListener('click',close);
 content.querySelector('#reset-strength')?.addEventListener('click',()=>{clear();draft=empty(data);render();content.querySelector('select').focus();});
 content.querySelector('#remove-session')?.addEventListener('click',e=>{if(!removeArmed){removeArmed=true;e.target.textContent='Confirm removal';showError('This session will leave your active history. You can restore it below.');}else void save(true);});
 }
 function showError(message,field){content.querySelector('#strength-error').textContent=message;(field?content.querySelector(`[name="${field}"]`):content.querySelector('#strength-error')).focus();}
 async function save(deleted){
  if(busy)return;
  if(!draft.focus){showError('Choose the session focus.','focus');return;}
  if(!draft.dateKey||draft.dateKey<'2026-07-01'||draft.dateKey>data.today){showError('Choose a date from July 2026 through today.','dateKey');return;}
  if(draft.mins!==''&&(!/^\d+$/.test(draft.mins)||Number(draft.mins)<1||Number(draft.mins)>1440)){showError('Enter 1 to 1,440 minutes, or leave it blank.','mins');return;}
  if(!deleted&&overlaps().length&&!draft.confirmSeparate){showError('Review the existing session and confirm this is a separate workout.','confirmSeparate');return;}
  const c=draft.checkin;
  if(draft.withCheckin&&(!c.completion||!c.effort||!c.legFatigue||!c.discomfort||(c.discomfort!=='none'&&!c.location.trim()))){showError('Answer all four check-in questions and add a discomfort location when needed.');return;}
  if(draft.deleted!==deleted){draft.operationId=crypto.randomUUID();draft.deleted=deleted;}persist();
  const body={...draft,mins:draft.mins===''?null:Number(draft.mins),checkin:draft.withCheckin?{...c,effort:Number(c.effort)}:null};
  busy=true;onBusy(true);const form=content.querySelector('form');for(const field of form.elements)field.disabled=true;form.querySelector('[type=submit]').textContent='Saving…';let accepted=false;
  try{await request('/api/private?route=strength-entry',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});accepted=true;clear();dialog.close();await onSaved(deleted?'Session removed. You can restore it below.':'Strength session saved to your private account.');}
  catch(e){showError(accepted?'Saved. Refresh the journal to see it.':e.message);if(!accepted){try{const latest=await refreshData();const own=[...latest.sessions,...latest.removedSessions].find(s=>s.source==='manual'&&s.entryKey===draft.id);if(!own||own.revision===draft.revision){data=latest;draft.head=latest.revision;persist();}else showError(e.message+' Open the saved version before editing again.');}catch{}}}
  finally{busy=false;onBusy(false);if(form.isConnected){for(const field of form.elements)field.disabled=false;form.querySelector('[type=submit]').textContent=accepted?'Saved':'Save session';if(accepted)form.querySelector('[type=submit]').disabled=true;}}
 }
 function close(){if(!busy)dialog.close();}
 dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
 document.querySelector('#log-strength')?.addEventListener('click',()=>open());
 for(const b of document.querySelectorAll('[data-edit-session],[data-restore-session]'))b.addEventListener('click',()=>{const restore=Boolean(b.dataset.restoreSession),entry=(restore?data.removedSessions:data.sessions).find(s=>s.source==='manual'&&s.entryKey===(b.dataset.editSession||b.dataset.restoreSession));if(entry)open({...entry,deleted:restore});});
}
