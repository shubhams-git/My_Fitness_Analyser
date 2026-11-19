import {clearSnapshots} from './session.js';

const form=document.querySelector('#sign-in-form');
const status=document.querySelector('#sign-in-status');
const button=form.querySelector('[type="submit"]');
const toggle=document.querySelector('#toggle-registration');
const title=document.querySelector('#signin-title');
const providerButtons=[...document.querySelectorAll('[data-provider]')];
const params=new URLSearchParams(location.search);
const redeeming=params.get('invite')==='1';
const allowedPaths=['/','/training','/training.html','/journal','/journal.html','/account','/account.html','/app.html','/index.html'];
let next='/training',registering=false,availableProviders={};
try{
  const target=new URL(params.get('next')||next,location.origin);
  if(target.origin===location.origin&&allowedPaths.includes(target.pathname))next=target.pathname+target.search+target.hash;
}catch{}

function notice(message,success=false){
  status.textContent=message;
  status.toggleAttribute('data-success',success);
  if(message){status.tabIndex=-1;status.focus();}
}

function notifySessionChange(){
  clearSnapshots();
  try{localStorage.setItem('mfa-view-session-changed',String(Date.now()));}catch{}
}

async function openRecord(){
  const response=await fetch('/api/private?route=profile',{cache:'no-store'});
  if(!response.ok)return false;
  const profile=await response.json();
  location.replace(profile.garmin.connectable&&!profile.garmin.configured?'/account#garmin-connection':next);
  return true;
}

async function submit(route,body){
  const response=await fetch('/api/private?route='+route,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
  });
  const result=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(result?.error||'Sign-in is unavailable. Try again shortly.');
  return result;
}

function busy(value){
  button.disabled=toggle.disabled=value;
  providerButtons.forEach(control=>{control.disabled=value||!availableProviders[control.dataset.provider];});
  if(value)form.setAttribute('aria-busy','true');
  else form.removeAttribute('aria-busy');
}

document.querySelector('#show-password').addEventListener('click',event=>{
  const show=form.elements.password.type==='password';
  form.elements.password.type=show?'text':'password';
  event.currentTarget.firstElementChild.textContent=show?'Hide':'Show';
  event.currentTarget.setAttribute('aria-pressed',String(show));
  event.currentTarget.setAttribute('aria-label',show?'Hide password':'Show password');
});

toggle.addEventListener('click',()=>{
  registering=!registering;
  title.textContent=button.textContent=registering?'Create account':'Sign in';
  toggle.textContent=registering?'Back to sign in':'Create an account';
  form.elements.password.autocomplete=registering?'new-password':'current-password';
  form.elements.password.minLength=registering?12:0;
  form.elements.password.value='';
  notice('');
  form.elements.email.focus();
});

form.addEventListener('submit',async event=>{
  event.preventDefault();
  if(button.disabled||!form.reportValidity())return;
  busy(true);
  button.textContent=redeeming?'Checking code…':registering?'Creating account…':'Signing in…';
  notice('');
  try{
    if(redeeming){
      await submit('accept-invite',{email:form.elements.email.value,code:form.elements.code.value});
      form.elements.code.value='';
      notifySessionChange();
      location.replace('/account#new-password');
      return;
    }
    await submit(registering?'register':'login',{email:form.elements.email.value,password:form.elements.password.value});
    form.elements.password.value='';
    if(registering)notice('Check your email and open the confirmation link in this browser.',true);
    else{
      notifySessionChange();
      if(!await openRecord())throw new Error('Your account could not load. Please try again.');
    }
  }catch(error){notice(error.message);}
  finally{busy(false);button.textContent=redeeming?'Accept invitation':registering?'Create account':'Sign in';}
});

for(const control of providerButtons)control.addEventListener('click',async()=>{
  busy(true);
  notice('');
  try{
    const result=await submit('oauth',{provider:control.dataset.provider});
    location.assign(result.url);
  }catch(error){busy(false);notice(error.message);}
});

const auth=params.get('auth');
if(redeeming){
  title.textContent=button.textContent='Accept invitation';
  document.querySelector('#sign-in-description').textContent='Enter the code from your invitation email. You’ll set a password next.';
  document.querySelector('label[for="password"]').hidden=true;
  document.querySelector('.password-field').hidden=true;
  form.elements.password.disabled=true;
  document.querySelector('label[for="invite-code"]').hidden=false;
  form.elements.code.hidden=form.elements.code.disabled=false;
  document.querySelector('#back-to-sign-in').hidden=false;
}
if(auth==='complete')notifySessionChange();
if(auth==='retry')notice('Sign-in could not finish. Open the confirmation link in the browser you used to register, or try signing in again.');
if(auth==='invite')notice('Use the verified email address on your invitation.');
if(!redeeming&&(!auth||auth==='complete'))openRecord().catch(()=>{});
if(!redeeming)fetch('/api/private?route=auth-options',{cache:'no-store'}).then(async response=>{
  if(!response.ok)return;
  const options=await response.json();
  if(!options.memberAccounts)return;
  availableProviders=options.providers||{};
  for(const control of providerButtons)control.disabled=button.disabled||!availableProviders[control.dataset.provider];
  document.querySelector('#provider-status').hidden=Object.values(availableProviders).some(Boolean);
  document.querySelector('#member-auth').hidden=false;
}).catch(()=>{});
