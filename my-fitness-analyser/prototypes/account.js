import {mountGoals} from './goals-view.js';
import {mountZoneSettings} from './zone-settings.js';
import { privateJson,refreshView } from './session.js';
import { mountCoaching } from './coaching.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const accountMarkup=`<main id="account-main" class="ac-main"><section class="ac-intro"><h1>Account</h1><div class="ac-identity"><span id="avatar" class="ac-avatar" aria-hidden="true">—</span><div><h2 id="member-name"></h2><p id="member-email"></p></div></div></section>
<p id="account-status" class="ac-status" role="status"></p>
<section id="running-zones" class="zn-settings" aria-label="Your running zones"></section><section id="goals" class="zn-settings" aria-label="Your goals"></section><div class="ac-grid"><section class="ac-card"><div class="ac-card-heading"><h2>Garmin Connect</h2><span class="ac-badge" id="garmin-status">Checking</span></div><p id="garmin-description">Checking your connection…</p><button id="sync-garmin" class="primary-button" hidden>Sync Garmin</button><div class="ac-divider"></div><h3>Bring an original recording.</h3><p>Import a running or walking FIT file exported from your device or Garmin Connect.</p><label class="ac-file-label" for="fit-file">Choose a FIT file <span aria-hidden="true">↗</span></label><input id="fit-file" class="ac-file-input" type="file" accept=".fit,.FIT"><p id="fit-status" role="status"></p></section>
<section class="ac-card"><h2>Keep the history.</h2><p>Bring NRC or Strava screenshots showing the date, summary and splits. Images stay private and wait for review before runs are added.</p><form id="screenshot-form"><label for="provider">Where are they from?</label><select id="provider" name="provider"><option value="nike-run-club">Nike Run Club</option><option value="strava">Strava</option></select><label class="ac-file-label" for="screenshots">Choose screenshots <span aria-hidden="true">＋</span></label><input id="screenshots" class="ac-file-input" type="file" accept="image/jpeg,image/png" multiple required><p id="file-selection">JPG or PNG · up to 20 images · 3.5 MB each</p><button type="submit" class="primary-button">Upload for review</button><p id="screenshot-status" role="status"></p></form></section>
<section class="ac-card"><h2>Take your record<br>with you.</h2><p>Export your saved measurements, check-ins and original evidence together. Keep a private copy somewhere you trust.</p><a class="primary-button" href="/api/export">Export my record <span aria-hidden="true">↗</span></a><p class="ac-small">The evidence archive includes original files. Restoring it currently requires a reviewed database import.</p></section>
<section class="ac-card"><h2>Make it yours.</h2><p>You stay signed in on this browser for up to 30 days, renewed when your session refreshes. You can sign out at any time.</p><form id="password-form"><label for="new-password">New password</label><input id="new-password" type="password" autocomplete="new-password" minlength="12" maxlength="1024" required><label for="confirm-password">Confirm new password</label><input id="confirm-password" type="password" autocomplete="new-password" minlength="12" maxlength="1024" required><button class="secondary-button" type="submit">Update password</button><p id="password-status" role="status"></p></form></section></div>
<section class="ac-queue"><div><h2>Your review queue.</h2></div><div id="submissions"><p>Checking your uploads…</p></div></section></main>`;
export function mountAccount({root,data,signal}){
root.innerHTML=accountMarkup;
const $=selector=>root.querySelector(selector);
const main=$('main'),grid=$('.ac-grid'),[garmin,screenshots,backup,password]=grid.children;
const queue=$('.ac-queue'),zones=$('#running-zones'),goals=$('#goals');
const group=(id,title,...items)=>{
 const section=document.createElement('section');
 section.className='ac-group';section.id=id;
 const heading=document.createElement('h2');heading.textContent=title;
 section.append(heading,...items);
 return section;
};
$('.ac-intro').after(Object.assign(document.createElement('nav'),{className:'ac-index',innerHTML:'<a href="#connections">Garmin &amp; imports</a><a href="#training-settings">Goals &amp; zones</a><a href="#privacy">Privacy &amp; display</a><a href="#account-security">Backup &amp; security</a>'}));
$('.ac-index').setAttribute('aria-label','Account settings');
garmin.querySelector('h3').textContent='Import a FIT file';
screenshots.querySelector('h2').textContent='Import screenshots';
backup.querySelector('h2').textContent='Export your record';
password.querySelector('h2').textContent='Change password';
queue.querySelector('h2').textContent='Screenshot review queue';
for(const field of root.querySelectorAll('input'))field.name=field.id;
$('#provider').setAttribute('aria-describedby','file-selection');
$('#screenshots').setAttribute('aria-describedby','file-selection screenshot-status');
$('#fit-file').setAttribute('aria-describedby','fit-status');
$('#confirm-password').setAttribute('aria-describedby','password-status');
const coach=document.createElement('section');
coach.id='ai-settings';coach.setAttribute('aria-label','Training analysis preferences');
const controls=document.createElement('div');controls.className='ac-controls';
const display=document.createElement('div');display.className='ac-display';
display.innerHTML='<h3>Display &amp; session</h3><p>Reduce animations and route replay motion.</p>';
display.append(controls);
const weight=document.createElement('div');weight.className='ac-display';
weight.innerHTML='<h3>Weight analysis</h3><p>Weight and training have separate sharing choices.</p><a class="text-button" href="/journal#weight-insight">Manage weight analysis in Journal</a>';
main.append(group('connections','Garmin & imports',garmin,screenshots,queue),group('training-settings','Goals & running zones',goals,zones),group('privacy','Privacy & display',coach,weight,display),group('account-security','Backup & security',backup,password));
grid.remove();
const exportLink=backup.querySelector('a');
const exportStatus=document.createElement('p');exportStatus.setAttribute('role','status');exportLink.after(exportStatus);
exportLink.addEventListener('click',async event=>{
 if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
 event.preventDefault();if(exportLink.hasAttribute('aria-disabled'))return;
 exportLink.setAttribute('aria-disabled','true');exportStatus.textContent='Preparing your private backup…';
 try{const result=await privateJson('/api/export?prepare=1');if(!signal.aborted){exportStatus.textContent='Backup ready. Your browser will download it.';location.assign(result.url);}}
 catch(error){if(!signal.aborted)exportStatus.textContent=error.message||'Couldn’t prepare the backup. Try again.';}
 finally{exportLink.removeAttribute('aria-disabled');}
});
function showProfile(p){$('#member-name').textContent=p.user.displayName;$('#member-email').textContent=p.user.email;$('#avatar').textContent=p.user.displayName.slice(0,1).toUpperCase();$('#garmin-status').textContent=p.garmin.configured?'Connected':'Not connected';$('#garmin-description').textContent=p.garmin.configured?'Your connection is ready. Pull your recent runs into your private record.':'A Garmin connection has not been set up for this account. You can import original FIT recordings below.';$('#sync-garmin').hidden=!p.garmin.configured;$('#submissions').innerHTML=p.submissions.length?p.submissions.map(s=>`<div class="ac-submission"><div><strong>${esc(s.original_name)}</strong><span>${s.provider==='strava'?'Strava':'Nike Run Club'} · ${new Date(s.created_at).toLocaleDateString('en-AU')}</span></div><span class="ac-badge">${esc(s.status.replaceAll('_',' '))}</span></div>`).join(''):'<p>No screenshots waiting for review.</p>';}
$('#sync-garmin').addEventListener('click',async event=>{const button=event.currentTarget,status=$('#fit-status');button.disabled=true;status.textContent='Syncing your Garmin recordings…';try{const r=await privateJson('/api/garmin/sync',{method:'POST'});status.textContent=`${r.imported} added · ${r.updated} updated · ${r.unchanged} unchanged. Open Training to explore.`;}catch(e){status.textContent=e.message;}finally{button.disabled=false;}});
$('#fit-file').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;const out=$('#fit-status');if(file.size>3.5*1024*1024){out.textContent='Choose a FIT file smaller than 3.5 MB.';return;}event.target.disabled=true;out.textContent='Saving your recording…';try{const r=await privateJson('/api/import',{method:'POST',body:file});out.innerHTML=`${r.duplicate?'Already in your record.':'Recording saved.'} <a href="/app.html?activity=${encodeURIComponent(r.activity.id)}">Open session ↗</a>`;}catch(e){out.textContent=e.message;}finally{event.target.disabled=false;}});
$('#screenshots').addEventListener('change',event=>{$('#file-selection').textContent=event.target.files.length+' screenshots selected';});
$('#screenshot-form').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,files=[...$('#screenshots').files],button=form.querySelector('button'),out=$('#screenshot-status'),provider=$('#provider').value,fileSelection=$('#file-selection');if(!files.length||files.length>20||files.some(f=>f.size>3.5*1024*1024)){out.textContent='Choose up to 20 JPG or PNG files, each smaller than 3.5 MB.';return;}button.disabled=true;const batch=crypto.randomUUID();let done=0;try{for(const file of files){out.textContent=`Saving screenshot ${done+1} of ${files.length}…`;await privateJson('/api/private?route=screenshots',{method:'POST',headers:{'x-source-provider':provider,'x-import-batch':batch,'x-original-name':encodeURIComponent(file.name)},body:file});done++;}out.textContent=`${done} screenshots saved privately for review. They will appear as runs after their dates and figures are checked.`;form.reset();fileSelection.textContent='JPG or PNG · up to 20 images · 3.5 MB each';const profile=await refreshView('/api/private?route=profile','account',{force:true});if(!signal.aborted)showProfile(profile);}catch(e){out.textContent=`${done} saved. ${e.message} You can retry; identical images will not duplicate.`;}finally{button.disabled=false;}});
$('#password-form').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,out=$('#password-status'),button=form.querySelector('button');if($('#new-password').value!==$('#confirm-password').value){out.textContent='The passwords do not match.';$('#confirm-password').focus();return;}button.disabled=true;try{await privateJson('/api/private?route=password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:$('#new-password').value})});form.reset();out.textContent='Password updated.';}catch(e){out.textContent=e.message;}finally{button.disabled=false;}});
showProfile(data);
void mountZoneSettings($('#running-zones'));
void mountGoals($('#goals'));
void mountCoaching(coach,{settings:true,signal});
}
