import { logout,refreshView,viewSnapshot } from './session.js';

const training=()=>import('./training.js').then(module=>module.mountTraining);
const pages={
  today:{title:'Training',styles:['coaching','training-focus'],load:training},
  progress:{title:'Progress',styles:['training-focus','progress','activity-visuals','zones'],load:training},
  sessions:{title:'Sessions',styles:['training-focus'],load:training},
  journal:{title:'Journal',description:'Weight trends and gym sessions.',styles:['journal','journal-capture','zones'],load:()=>import('./journal.js').then(module=>module.mountJournal)},
  account:{title:'Account',styles:['account','coaching','zones'],load:()=>import('./account.js').then(module=>module.mountAccount)},
  activity:{title:'Activity',styles:['readability','assets/vendor/maplibre-gl','real-map','satellite-replay','activity-visuals','zones'],load:()=>import('./app.js').then(module=>module.mountActivity)}
};
const shell=document.querySelector('.mfa-shell');
const outlet=document.querySelector('#route-outlet');
const status=document.querySelector('#route-announcement');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const assets=new Map();
const scrollPositions=new Map();
let active,visit=0,prefetchTimer;
let motionEnabled=true;
try{motionEnabled=localStorage.getItem('mfa-visual-motion')!=='off';}catch{}
history.scrollRestoration='manual';

function readRoute(url){
  const path=url.pathname.replace(/\.html$|\/$/g,'');
  const params=url.searchParams;
  const requested=params.get('view');
  if(path==='/training'||path===''&&!params.has('activity')&&!params.has('scenario')){
    const view=['progress','sessions'].includes(requested)?requested:url.hash==='#progress'?'progress':'today';
    const window=params.get('window')==='all'?'all':'90';
    return {view,window,tag:'training',endpoint:'/api/training?window='+window};
  }
  if(path==='/journal'){
    const window=['30','all'].includes(params.get('window'))?params.get('window'):'90';
    return {view:'journal',window,tag:'journal',endpoint:'/api/journal?window='+window};
  }
  if(path==='/account')return {view:'account',tag:'account',endpoint:'/api/private?route=profile'};
  if(['','/app','/index'].includes(path)){
    const id=params.get('activity');
    return {view:'activity',tag:'activity',endpoint:id?'/api/data?activity='+encodeURIComponent(id):'/api/data?activity='};
  }
}
function style(href){
  if(!assets.has(href)){
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='/'+href+'.css';
    link.media='not all';
    const ready=new Promise((resolve,reject)=>{
      link.addEventListener('load',resolve,{once:true});
      link.addEventListener('error',()=>{
        link.remove();
        assets.delete(href);
        reject(new Error('The page styles could not load.'));
      },{once:true});
    });
    assets.set(href,{link,ready});
    document.head.append(link);
  }
  return assets.get(href);
}
function prepare(view){
  const page=pages[view];
  return Promise.all([page.load(),...page.styles.map(href=>style(href).ready)]).then(([mount])=>mount);
}
function updateMotion(){
  const enabled=motionEnabled&&!reduced.matches&&new URL(location.href).searchParams.get('motion')!=='reduce';
  document.documentElement.classList.toggle('reduce-motion',!enabled);
  const motion=outlet.querySelector('#motion');
  if(!motion)return;
  motion.setAttribute('aria-pressed',String(enabled));
  motion.disabled=reduced.matches;
  motion.querySelector('span').textContent=enabled?'on':'off';
}
function setPage(view){
  const title=pages[view].title;
  document.title=title+' — My Fitness Analyser';
  const current=view==='activity'?'sessions':view;
  for(const link of shell.querySelectorAll('[data-page]')){
    if(link.dataset.page===current)link.setAttribute('aria-current',view==='activity'?'location':'page');
    else link.removeAttribute('aria-current');
  }
  document.body.className='fn-app training-app'+(view==='journal'?' journal-app':view==='activity'?' field-notes':'');
  delete document.body.dataset.hasJournal;
  const text=new URL(location.href).searchParams.get('text');
  document.documentElement.classList.toggle('large-text',['large','largest'].includes(text));
  document.documentElement.classList.toggle('largest-text',text==='largest');
  updateMotion();
}
function preview(view){
  const main=document.createElement('main');
  main.className='td-main route-preview';
  main.dataset.page=view;
  const {title,description}=pages[view];
  const placeholder='<div class="route-placeholder"><i></i><div></div><i></i><i></i></div>';
  main.innerHTML='<div class="td-page-heading"><div><h1 tabindex="-1">'+title+'</h1>'+
    (description?'<p>'+description+'</p>':'')+'</div></div><div class="route-preview-grid" aria-hidden="true">'+
    placeholder.repeat(2)+'</div><p class="route-connect" role="status"></p>';
  outlet.replaceChildren(main);
  return main;
}
function position({hash,x=0,y=0,focus=false,href}){
  if(hash){
    let id;
    try{id=decodeURIComponent(hash.slice(1));}catch{}
    const anchor=id&&document.getElementById(id);
    if(anchor){
      anchor.scrollIntoView({block:'start',behavior:'instant'});
      if(focus){if(!anchor.hasAttribute('tabindex'))anchor.tabIndex=-1;anchor.focus({preventScroll:true});}
      return;
    }
  }
  scrollTo({left:x,top:y,behavior:'instant'});
  const origin=href&&[...document.querySelectorAll('a[href]')].find(link=>link.getAttribute('href')===href&&link.getClientRects().length);
  if(origin){origin.focus({preventScroll:true});return;}
  const heading=outlet.querySelector('h1');
  if(focus&&heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}
}
function retry(parent,message,action,label='Try again'){
  const button=document.createElement('button');
  button.className='text-button';
  button.type='button';
  button.textContent=label;
  button.addEventListener('click',action);
  parent.replaceChildren(message,' ',button);
}
function warm(url,priority='low'){
  const route=readRoute(url);
  if(!route)return;
  void prepare(route.view).catch(()=>{});
  if(!viewSnapshot(route.endpoint,route.tag)?.fresh&&active?.ready&&route.endpoint!==active.route.endpoint){
    void refreshView(route.endpoint,route.tag,{priority}).catch(()=>{});
  }
}
function warmNext(view,signal){
  clearTimeout(prefetchTimer);
  if(navigator.connection?.saveData||['2g','slow-2g'].includes(navigator.connection?.effectiveType))return;
  prefetchTimer=setTimeout(()=>{
    if(signal.aborted||document.hidden)return;
    if(view==='today'||view==='progress'){
      warm(new URL('/journal',location.origin));
      if(view==='today'){
        void prepare('progress').catch(()=>{});
      }
    }else warm(new URL('/training',location.origin));
  },350);
}

async function show(url,{key,restore,focus=false,force=false}={}){
  const route=readRoute(url);
  if(!route)return;
  active?.controller.abort();
  clearTimeout(prefetchTimer);
  const controller=new AbortController();
  const {signal}=controller;
  const current={controller,key,route,ready:false};
  active=current;
  setPage(route.view);
  const cached=viewSnapshot(route.endpoint,route.tag);
  const module=prepare(route.view);
  const request=force||!cached?.fresh||key===0&&cached?.owner?refreshView(route.endpoint,route.tag,{force,priority:'high'}):null;
  // Handle an early response while the route's code and CSS are still loading.
  request?.catch(()=>{});
  const pending=preview(route.view);
  const hint=pending.querySelector('.route-connect');
  const place=restore?{...restore,focus:true}:{hash:url.hash,focus};
  position(restore?{focus:false}:place);
  status.textContent=focus?pages[route.view].title:'';
  const slow=setTimeout(()=>{
    if(signal.aborted||current.ready)return;
    hint.textContent=navigator.onLine?'Still connecting…':'You’re offline.';
  },1200);
  const update=(data,mount,{animate=false,reposition=true}={})=>{
    if(signal.aborted)return;
    const before=outlet.querySelector('h1');
    const restoreHeading=document.activeElement===before;
    const root=document.createElement('div');
    root.dataset.route=route.view;
    if(animate&&focus)root.classList.add('route-arrival');
    const sync=document.createElement('p');
    sync.className='route-sync';
    sync.setAttribute('role','status');
    current.content?.abort();
    const content=new AbortController();
    current.content=content;
    signal.addEventListener('abort',()=>content.abort(),{once:true});
    outlet.replaceChildren(sync,root);
    mount({root,route,data,signal:content.signal,navigate:open,toggleMotion});
    if(route.view==='account'){
      root.querySelector('.ac-controls')?.append(document.querySelector('#account-controls').content.cloneNode(true));
      updateMotion();
    }
    current.ready=true;
    if(reposition)position({...place,focus:place.focus||restoreHeading});
    warmNext(route.view,signal);
    return {root,sync};
  };
  try{
    const mount=await module;
    if(signal.aborted)return;
    for(const [name,asset] of assets)asset.link.media=pages[route.view].styles.includes(name)?'all':'not all';
    if(!cached){
      const data=await request;
      update(data,mount,{animate:true});
      return;
    }
    const rendered=update(cached.value,mount);
    if(!request||signal.aborted)return;
    const {root,sync}=rendered;
    let interacted=false;
    const mark=()=>{interacted=true;};
    for(const name of ['pointerdown','keydown','input','focusin']){
      root.addEventListener(name,mark,{signal});
    }
    const initialScroll=scrollY,initialUrl=location.href;
    try{
      const next=await request;
      if(signal.aborted||JSON.stringify(next)===JSON.stringify(cached.value))return;
      const apply=()=>{
        if(viewSnapshot(route.endpoint,route.tag)?.value===next)update(next,mount,{reposition:false});
        else sync.replaceChildren();
      };
      if(!interacted&&!root.contains(document.activeElement)&&!url.hash&&location.href===initialUrl&&Math.abs(scrollY-initialScroll)<8)apply();
      else retry(sync,'Updated data is available.',()=>{
        apply();
        position({x:scrollX,y:scrollY,focus:true});
      },'Apply update');
    }catch(error){
      if(signal.aborted||error.name==='AbortError')return;
      const reconnect=()=>{
        sync.textContent='Reconnecting…';
        void refreshView(route.endpoint,route.tag,{force:true}).then(next=>{
          if(signal.aborted)return;
          retry(sync,'Updated data is available.',()=>update(next,mount), 'Apply update');
        }).catch(()=>{if(!signal.aborted)retry(sync,'Still showing saved data.',reconnect);});
      };
      retry(sync,'Showing saved data.',reconnect);
    }
  }catch(error){
    if(signal.aborted)return;
    if(error.name==='AbortError'){
      // A write completed while this read was in flight. Read the new version.
      void show(new URL(location.href),{key,restore,focus});
      return;
    }
    const failed=outlet.contains(pending)?pending:preview(route.view);
    failed.querySelector('.route-preview-grid').hidden=true;
    retry(failed.querySelector('.route-connect'),error.status===404?error.message:'Couldn’t load '+pages[route.view].title.toLowerCase()+'.',()=>{
      void show(new URL(location.href),{key,restore,focus:true,force:true});
    });
  }finally{clearTimeout(slow);}
}

function rememberVisit(href){
  if(!active)return;
  scrollPositions.set(active.key,{x:scrollX,y:scrollY,href});
  if(scrollPositions.size>40)scrollPositions.delete(scrollPositions.keys().next().value);
}
function open(url,{reload=false,href}={}){
  if(location.href===url.href){
    if(reload)void show(url,{key:active.key,focus:true,force:true});
    return;
  }
  rememberVisit(href);
  const key=++visit;
  history.pushState({...history.state,mfaVisit:key},'',url);
  void show(url,{key,focus:true});
}
document.addEventListener('click',event=>{
  const link=event.target.closest('a[href]');
  if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||
     event.altKey||link.target||link.hasAttribute('download')||link.origin!==location.origin)return;
  const url=new URL(link.href);
  if(!readRoute(url))return;
  if(link.getAttribute('href').startsWith('#'))return;
  event.preventDefault();
  open(url,{href:link.getAttribute('href')});
});
for(const name of ['pointerover','focusin','touchstart']){
  document.addEventListener(name,event=>{
    const link=event.target.closest('a[href]');
    if(link&&link.origin===location.origin&&readRoute(new URL(link.href)))warm(new URL(link.href));
  },{passive:true});
}
addEventListener('popstate',()=>{
  const key=history.state?.mfaVisit??++visit;
  if(active?.key===key&&active.route.view===readRoute(new URL(location.href))?.view)return;
  rememberVisit(document.activeElement?.closest('a[href]')?.getAttribute('href'));
  void show(new URL(location.href),{key,restore:scrollPositions.get(key),focus:true});
});
function toggleMotion(){
  if(reduced.matches)return;
  motionEnabled=!motionEnabled;
  try{localStorage.setItem('mfa-visual-motion',motionEnabled?'on':'off');}catch{}
  updateMotion();
  dispatchEvent(new Event('mfa-motion'));
}
outlet.addEventListener('click',async event=>{
 if(event.target.closest('#motion'))toggleMotion();
 const signOut=event.target.closest('#logout');
 if(signOut){
  signOut.disabled=true;
  try{await logout();}catch(error){const message=outlet.querySelector('#account-status');if(message)message.textContent=error.message;signOut.disabled=false;}
 }
});
reduced.addEventListener('change',updateMotion);
new ResizeObserver(()=>{
  document.documentElement.style.setProperty('--shell-clearance',(shell.offsetHeight+14)+'px');
}).observe(shell);
history.replaceState({...history.state,mfaVisit:visit},'');
void show(new URL(location.href),{key:visit});
