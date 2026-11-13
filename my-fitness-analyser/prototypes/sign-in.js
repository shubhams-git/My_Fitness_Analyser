import {clearSnapshots} from './session.js';
const form=document.querySelector('#sign-in-form'),status=document.querySelector('#sign-in-status'),button=form.querySelector('[type="submit"]');
const requested=new URLSearchParams(location.search).get('next');let next='/training';
try{const target=new URL(requested||next,location.origin);if(target.origin===location.origin&&['/','/training','/training.html','/journal','/journal.html','/account','/account.html','/app.html','/index.html'].includes(target.pathname))next=target.pathname+target.search+target.hash;}catch{}
document.querySelector('#show-password').addEventListener('click',event=>{const show=form.elements.password.type==='password';form.elements.password.type=show?'text':'password';event.currentTarget.firstElementChild.textContent=show?'Hide':'Show';event.currentTarget.setAttribute('aria-pressed',String(show));});
form.addEventListener('submit',async event=>{
 event.preventDefault();if(button.disabled||!form.reportValidity())return;
 button.disabled=true;button.textContent='Signing in…';status.textContent='';form.setAttribute('aria-busy','true');
 try{
  const response=await fetch('/api/private?route=login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:form.elements.email.value,password:form.elements.password.value})});
  if(!response.ok){const result=await response.json().catch(()=>null);status.textContent=result?.error||'Sign-in is unavailable. Try again in a moment.';return;}
  clearSnapshots();try{localStorage.setItem('mfa-view-session-changed',String(Date.now()));}catch{}
  form.elements.password.value='';location.replace(next);
 }catch{status.textContent='Couldn’t connect. Check your connection and try again.';}
 finally{button.disabled=false;button.textContent='Sign in';form.removeAttribute('aria-busy');if(status.textContent){status.tabIndex=-1;status.focus();}}
});
fetch('/api/private?route=profile',{cache:'no-store'}).then(r=>{if(r.ok)location.replace(next);}).catch(()=>{});
