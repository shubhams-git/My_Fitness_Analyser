import {mountGoals} from './goals-view.js';
import {mountZoneSettings} from './zone-settings.js';
import { privateJson,refreshView } from './session.js';
import { mountCoaching } from './coaching.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const chevron = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
const disclosure = (title, body) => `<details class="ac-disclosure"><summary><h3>${title}</h3>${chevron}</summary><div class="ac-task-body">${body}</div></details>`;
const groupLink = (id, label) => `<a href="#${id}">${label}${chevron}</a>`;
const accountMarkup = `
<main id="account-main" class="ac-main">
  <header class="ac-intro">
    <h1>Account</h1>
    <div class="ac-identity">
      <span id="avatar" class="ac-avatar" aria-hidden="true"></span>
      <div><p id="member-name"></p><p id="member-email"></p></div>
    </div>
  </header>
  <nav class="ac-index" aria-label="Account settings">
    ${groupLink('connections','Garmin & imports')}
    ${groupLink('training-settings','Goals & zones')}
    ${groupLink('privacy','Privacy & display')}
    ${groupLink('account-security','Backup & security')}
  </nav>
  <section class="ac-group" id="connections" tabindex="-1">
    <h2>Garmin & imports</h2>
    <div class="ac-group-body">
      <section class="ac-garmin" id="garmin-connection" tabindex="-1">
        <div class="ac-card-heading"><h3>Garmin Connect</h3><span class="ac-badge" id="garmin-status"></span></div>
        <p id="garmin-description"></p>
        <div class="ac-actions">
          <button id="sync-garmin" class="primary-button" type="button" hidden>Sync Garmin</button>
          <button id="replace-garmin-key" class="text-button" type="button" aria-expanded="false" aria-controls="garmin-key-form" hidden>Replace API key</button>
        </div>
        <form id="garmin-key-form" method="post" hidden>
          <label for="garmin-key">Garmin Personal API key</label>
          <input id="garmin-key" name="garmin-key" type="password" autocomplete="off" autocapitalize="none" spellcheck="false" aria-describedby="garmin-description" maxlength="1800" required>
          <button type="submit" class="secondary-button">Connect Garmin</button>
        </form>
        <p id="garmin-key-status" role="status"></p>
      </section>
      ${disclosure('Import a FIT file', `
        <p>Choose an original running or walking recording from your device or Garmin Connect.</p>
        <label class="ac-file-label" for="fit-file">Choose a FIT file ${chevron}</label>
        <input id="fit-file" name="fit-file" class="ac-file-input" type="file" accept=".fit,.FIT" aria-describedby="fit-status">
        <p id="fit-status" role="status"></p>`)}
      ${disclosure('Import screenshots', `
        <p>Upload Nike Run Club or Strava screenshots showing the date, summary and splits. Your images stay private while they’re reviewed.</p>
        <form id="screenshot-form">
          <label for="provider">Source</label>
          <select id="provider" name="provider"><option value="nike-run-club">Nike Run Club</option><option value="strava">Strava</option></select>
          <label class="ac-file-label" for="screenshots">Choose screenshots ${chevron}</label>
          <input id="screenshots" name="screenshots" class="ac-file-input" type="file" accept="image/jpeg,image/png" aria-describedby="file-selection screenshot-status" multiple required>
          <p id="file-selection">JPG or PNG · up to 20 images · 3.5 MB each</p>
          <button type="submit" class="primary-button">Upload for review</button>
          <p id="screenshot-status" role="status"></p>
        </form>`)}
      ${disclosure('Screenshot review queue', '<div id="submissions"></div>')}
    </div>
  </section>
  <section class="ac-group" id="training-settings" tabindex="-1">
    <h2>Goals & running zones</h2>
    <div class="ac-group-body">
      <section id="goals" class="zn-settings" aria-label="Your goals"></section>
      <section id="running-zones" class="zn-settings" aria-label="Your running zones"></section>
    </div>
  </section>
  <section class="ac-group" id="privacy" tabindex="-1">
    <h2>Privacy & display</h2>
    <div class="ac-group-body">
      <section id="ai-settings" tabindex="-1" aria-label="Training analysis preferences"></section>
      <section class="ac-setting">
        <h3>Weight analysis</h3><p>Weight analysis has its own Gemini sharing choice.</p>
        <a class="text-button" href="/journal#weight-insight">Manage weight analysis in Journal ${chevron}</a>
      </section>
      <section class="ac-setting">
        <h3>Visual motion</h3><p>Reduce animations and use manual route replay.</p><div class="ac-controls"></div>
      </section>
    </div>
  </section>
  <section class="ac-group" id="account-security" tabindex="-1">
    <h2>Backup & security</h2>
    <div class="ac-group-body">
      ${disclosure('Export your record', `
        <p>Download your saved measurements, check-ins and original files. Restoring this backup requires a reviewed database import.</p>
        <a class="secondary-button" id="export-record" href="/api/export">Download private backup ${chevron}</a>
        <p id="export-status" role="status"></p>`)}
      ${disclosure('Change password', `
        <form id="password-form">
          <label for="new-password">New password</label>
          <input id="new-password" name="new-password" type="password" autocomplete="new-password" minlength="12" maxlength="1024" aria-describedby="password-requirement" required>
          <p id="password-requirement">Use at least 12 characters.</p>
          <label for="confirm-password">Confirm new password</label>
          <input id="confirm-password" name="confirm-password" type="password" autocomplete="new-password" minlength="12" maxlength="1024" aria-describedby="password-status" required>
          <button class="secondary-button" type="submit">Update password</button>
          <p id="password-status" role="status"></p>
        </form>`)}
      <section class="ac-setting ac-session">
        <div><h3>Browser session</h3><p>Sign out when you’re done on a shared device.</p></div>
        <button class="session-exit" type="button" data-session-exit aria-haspopup="dialog">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 4H5v16h8M10 12h10m-4-4 4 4-4 4"/></svg>Sign out
        </button>
      </section>
    </div>
  </section>
</main>`;
export function mountAccount({root,data,signal}){
root.innerHTML=accountMarkup;
const $=selector=>root.querySelector(selector);
const coach=$('#ai-settings');
const exportLink=$('#export-record');
const exportStatus=$('#export-status');
exportLink.addEventListener('click',async event=>{
 if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
 event.preventDefault();if(exportLink.hasAttribute('aria-disabled'))return;
 exportLink.setAttribute('aria-disabled','true');exportStatus.textContent='Preparing your private backup…';
 try{const result=await privateJson('/api/export?prepare=1');if(!signal.aborted){exportStatus.textContent='Backup ready. Your browser will download it.';location.assign(result.url);}}
 catch(error){if(!signal.aborted)exportStatus.textContent=error.message||'Couldn’t prepare the backup. Try again.';}
 finally{exportLink.removeAttribute('aria-disabled');}
});
const garminForm=$('#garmin-key-form'),garminKey=$('#garmin-key'),replaceKey=$('#replace-garmin-key');
function showGarmin({configured,connectable}){
 $('#garmin-status').textContent=configured?'Connected':'Not connected';
 $('#garmin-status').toggleAttribute('data-connected',configured);
 $('#garmin-description').textContent=configured
   ?'Sync activities and available sleep and recovery summaries into your private record.'
   :connectable?'Enter the Personal API key from your Garmin Connect account to finish setup.':'You can import original FIT recordings below.';
 $('#sync-garmin').hidden=!configured;
 garminForm.hidden=!connectable||configured;
 replaceKey.hidden=!connectable||!configured;
 replaceKey.setAttribute('aria-expanded','false');
 replaceKey.textContent='Replace API key';
 garminForm.querySelector('button').textContent=configured?'Save replacement key':'Connect Garmin';
}
function showProfile(p){
 $('#member-name').textContent=p.user.displayName;
 $('#member-email').textContent=p.user.email;
 $('#avatar').textContent=Array.from(p.user.displayName)[0]?.toUpperCase()||'–';
 showGarmin(p.garmin);
 $('#submissions').innerHTML=p.submissions.length?p.submissions.map(s=>`<div class="ac-submission"><div><strong>${esc(s.original_name)}</strong><span>${s.provider==='strava'?'Strava':'Nike Run Club'} · ${new Date(s.created_at).toLocaleDateString('en-AU')}</span></div><span class="ac-badge">${esc(s.status.replaceAll('_',' '))}</span></div>`).join(''):'<p>No screenshots waiting for review.</p>';
}
replaceKey.addEventListener('click',()=>{
 garminForm.hidden=!garminForm.hidden;
 replaceKey.setAttribute('aria-expanded',String(!garminForm.hidden));
 replaceKey.textContent=garminForm.hidden?'Replace API key':'Cancel replacement';
 if(garminForm.hidden)garminForm.reset();
 else garminKey.focus();
});
garminForm.addEventListener('submit',async event=>{
 event.preventDefault();
 const button=garminForm.querySelector('button'),status=$('#garmin-key-status');
 button.disabled=replaceKey.disabled=true;
 status.textContent='Verifying your Garmin key…';
 try{
  await privateJson('/api/private?route=garmin-connection',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:garminKey.value})});
  garminForm.reset();
  showGarmin({configured:true,connectable:true});
  status.textContent='Garmin connected. Sync Garmin to bring in your data.';
  $('#sync-garmin').focus();
 }catch(error){status.textContent=error.message;}
 finally{button.disabled=replaceKey.disabled=false;}
});
$('#sync-garmin').addEventListener('click',async event=>{const button=event.currentTarget,status=$('#garmin-key-status');button.disabled=true;status.textContent='Syncing your Garmin recordings…';try{const r=await privateJson('/api/garmin/sync',{method:'POST'});status.textContent=`${r.imported} added · ${r.updated} updated · ${r.unchanged} unchanged. Open Training to explore.`;}catch(e){status.textContent=e.message;}finally{button.disabled=false;}});
$('#fit-file').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;const out=$('#fit-status');event.target.value='';if(file.size>3.5*1024*1024){out.textContent='Choose a FIT file no larger than 3.5 MB.';return;}event.target.disabled=true;out.textContent='Saving your recording…';try{const r=await privateJson('/api/import',{method:'POST',body:file});out.innerHTML=`${r.duplicate?'Already in your record.':'Recording saved.'} <a href="/app.html?activity=${encodeURIComponent(r.activity.id)}">Open session ↗</a>`;}catch(e){out.textContent=e.message;}finally{event.target.disabled=false;}});
$('#screenshots').addEventListener('change',event=>{$('#file-selection').textContent=event.target.files.length+' screenshots selected';});
$('#screenshot-form').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,files=[...$('#screenshots').files],button=form.querySelector('button'),out=$('#screenshot-status'),provider=$('#provider').value,fileSelection=$('#file-selection');if(!files.length||files.length>20||files.some(f=>f.size>3.5*1024*1024)){out.textContent='Choose up to 20 JPG or PNG files, each smaller than 3.5 MB.';return;}button.disabled=true;const batch=crypto.randomUUID();let done=0;try{for(const file of files){out.textContent=`Saving screenshot ${done+1} of ${files.length}…`;await privateJson('/api/private?route=screenshots',{method:'POST',headers:{'x-source-provider':provider,'x-import-batch':batch,'x-original-name':encodeURIComponent(file.name)},body:file});done++;}out.textContent=`${done} screenshots saved privately for review. They will appear as runs after their dates and figures are checked.`;form.reset();fileSelection.textContent='JPG or PNG · up to 20 images · 3.5 MB each';const profile=await refreshView('/api/private?route=profile','account',{force:true});if(!signal.aborted)showProfile(profile);}catch(e){out.textContent=`${done} saved. ${e.message} You can retry; identical images will not duplicate.`;}finally{button.disabled=false;}});
$('#password-form').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,out=$('#password-status'),button=form.querySelector('button');if($('#new-password').value!==$('#confirm-password').value){out.textContent='The passwords do not match.';$('#confirm-password').focus();return;}button.disabled=true;out.textContent='Updating your password…';try{await privateJson('/api/private?route=password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:$('#new-password').value})});form.reset();out.textContent='Password updated.';}catch(e){out.textContent=e.message;}finally{button.disabled=false;}});
showProfile(data);
void mountZoneSettings($('#running-zones'));
void mountGoals($('#goals'));
void mountCoaching(coach,{settings:true,signal});
}
