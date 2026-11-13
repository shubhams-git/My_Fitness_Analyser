import {privateJson,refreshView,viewSnapshot} from './session.js';

const params=new URLSearchParams(location.search);
const path=location.pathname.replace(/\.html$|\/$/g,'');
const training=path==='/training';
const journal=path==='/journal';
const activity=['','/app','/index'].includes(path);
const trainingWindow=params.get('window')==='all'?'all':'90';
const journalWindow=['30','all'].includes(params.get('window'))?params.get('window'):'90';
const endpoint=training?'/api/training?window='+trainingWindow:journal?'/api/journal?window='+journalWindow:null;

// Start the private read while the main page's modules and styles are loading.
export const arrivalRead=endpoint&&!viewSnapshot(endpoint)
  ? refreshView(endpoint)
  : activity?privateJson('/api/data'):null;
arrivalRead?.catch(()=>{});

// Load chart and map styles without blocking the loading shell's paint.
let revealStyles;
export const arrivalStyles=new Promise(resolve=>{revealStyles=resolve;});

function updateShell(){
  const shell=document.querySelector('[data-arrival]');
  if(!shell){revealStyles();return;}
  if(training&&(params.get('view')==='progress'||location.hash==='#progress')){
    shell.querySelector('h1').textContent='Progress';
    shell.querySelector('.arrival-status b').textContent='Loading your training comparisons…';
    shell.querySelector('[data-arrival-panels="training"]').hidden=true;
    shell.querySelector('[data-arrival-panels="progress"]').hidden=false;
    document.querySelector('[data-arrival-nav="training"]').removeAttribute('aria-current');
    document.querySelector('[data-arrival-nav="progress"]').setAttribute('aria-current','page');
  }else if(training&&params.get('view')==='sessions'){
    shell.querySelector('h1').textContent='Sessions';
    shell.querySelector('.arrival-status b').textContent='Loading your recorded sessions…';
  }
  try{if(localStorage.getItem('mfa-visual-motion')==='off'||params.get('motion')==='reduce')shell.classList.add('arrival-still');}catch{}
  const styles=[...document.querySelectorAll('[data-arrival-style]')];
  const ready=styles.map(link=>link.sheet?Promise.resolve():new Promise(resolve=>{
    link.addEventListener('load',resolve,{once:true});
    link.addEventListener('error',resolve,{once:true});
    // A failed stylesheet may have settled before the module started.
    setTimeout(resolve,2000);
  }));
  Promise.all(ready).then(()=>{
    for(const link of styles)link.media='all';
    revealStyles();
  });
  setTimeout(()=>{
    if(shell.isConnected&&!shell.classList.contains('arrival-failed')){
      shell.querySelector('.arrival-status b').textContent=navigator.onLine?'Still loading your records…':'Waiting for a connection…';
    }
  },3500);
}
if(document.querySelector('[data-arrival]'))updateShell();
else if(document.readyState==='loading'){
  const observer=new MutationObserver(()=>{
    if(!document.querySelector('[data-arrival]'))return;
    observer.disconnect();
    updateShell();
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',()=>{
    observer.disconnect();
    if(!document.querySelector('[data-arrival]'))revealStyles();
  },{once:true});
}else updateShell();

export function arrivalFailure(root,message){
  const shell=root.querySelector('[data-arrival]');
  if(!shell)return;
  shell.classList.add('arrival-failed');
  shell.querySelector('.arrival-status b').textContent=message;
  for(const grid of shell.querySelectorAll('.arrival-grid'))grid.hidden=true;
  const retry=document.createElement('button');
  retry.type='button';
  retry.className='primary-button arrival-error';
  retry.textContent='Try again';
  retry.addEventListener('click',()=>location.reload());
  shell.append(retry);
}
