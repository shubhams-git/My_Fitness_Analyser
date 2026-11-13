const prefix='mfa-view-v2:';
const sessionKey='mfa-view-session-changed';
const endedKey='mfa-session-ended';
const maxAge=30*60*1000;
const freshFor=45*1000;
const maxEntries=12;
const snapshots=new Map(),requests=new Map(),mutations=new Map();
let generation=0,identity;

function sessionVersion(){
  try{return [localStorage.getItem(sessionKey),localStorage.getItem(endedKey)].join(':');}catch{return null;}
}

export function clearSnapshots(){
  generation++;
  snapshots.clear();
  requests.clear();
  mutations.clear();
  identity=undefined;
  try{
    for(const key of Object.keys(sessionStorage)){
      if(key.startsWith(prefix)||key.startsWith('mfa-view-v1:'))sessionStorage.removeItem(key);
    }
  }catch{}
}

function invalidate(tags){
  for(const tag of tags)mutations.set(tag,(mutations.get(tag)||0)+1);
  for(const [url,entry] of snapshots){
    if(tags.includes(entry.tag))snapshots.delete(url);
  }
  for(const [url,request] of requests){
    if(tags.includes(request.tag))requests.delete(url);
  }
  try{
    for(const key of Object.keys(sessionStorage)){
      if(tags.some(tag=>key.startsWith(prefix+tag+':')))sessionStorage.removeItem(key);
    }
  }catch{}
}

export function invalidateFor(url){
  const {pathname,searchParams}=new URL(url,location.origin);
  const route=searchParams.get('route');
  if(['password','logout','login'].includes(route)){clearSnapshots();return;}
  if(['ai-consent','ai-review','weight-ai','weight-ai-consent','mass-preview'].includes(route)||pathname==='/api/mass/preview')return;
  if(route==='screenshots'){invalidate(['account']);return;}
  if(route==='weigh-in'){invalidate(['journal']);return;}
  if(route==='strength-entry'||pathname==='/api/mass/commit'){invalidate(['journal','training']);return;}
  if(route==='goals'){invalidate(['training','journal']);return;}
  if(route==='zones'){invalidate(['training','activity']);return;}
  invalidate(['training','activity']);
}

export function viewSnapshot(url,tag){
  const session=sessionVersion();
  let entry=snapshots.get(url);
  if(!entry&&session!==null){
    try{entry=JSON.parse(sessionStorage.getItem(prefix+tag+':'+url));}catch{}
  }
  if(!entry||entry.tag!==tag||entry.session!==session||Date.now()-entry.at>maxAge||
     (identity&&entry.owner&&entry.owner!==identity))return;
  return {...entry,fresh:Date.now()-entry.at<freshFor};
}

export function refreshView(url,tag,{force=false,priority='auto'}={}){
  if(!force&&requests.has(url))return requests.get(url).promise;
  const epoch=generation,version=mutations.get(tag),session=sessionVersion();
  const request={tag};
  request.promise=privateJson(url,{priority}).then(value=>{
    if(epoch!==generation||session!==sessionVersion()||version!==mutations.get(tag)||requests.get(url)!==request){
      throw new DOMException('The data was superseded.','AbortError');
    }
    const owner=value.viewer?.id||value.user?.id;
    if(owner){
      if(identity&&identity!==owner){
        clearSnapshots();
        location.reload();
        throw new DOMException('The signed-in account changed.','AbortError');
      }
      identity=owner;
    }else if(!value.local&&!value.localLibrary&&tag!=='activity')return value;
    const entry={at:Date.now(),session,owner,tag,value};
    snapshots.delete(url);
    snapshots.set(url,entry);
    if(snapshots.size>maxEntries)snapshots.delete(snapshots.keys().next().value);
    // Keep GPS streams and check-in notes in memory only.
    if(owner&&session!==null&&tag!=='activity'){
      try{
        const keys=Object.keys(sessionStorage).filter(key=>key.startsWith(prefix));
        const key=prefix+tag+':'+url;
        if(!keys.includes(key)&&keys.length>=maxEntries)sessionStorage.removeItem(keys[0]);
        sessionStorage.setItem(key,JSON.stringify(entry));
      }catch{}
    }
    return value;
  }).finally(()=>{if(requests.get(url)===request)requests.delete(url);});
  requests.set(url,request);
  return request.promise;
}

export function signInPath(){
  return '/sign-in.html?next='+encodeURIComponent(location.pathname+location.search+location.hash);
}

export async function privateResponse(url,options={}){
  const write=options.method&&options.method!=='GET';
  if(write)invalidateFor(url);
  const session=sessionVersion(),epoch=generation;
  const response=await fetch(url,{cache:'no-store',...options});
  if(epoch!==generation||session!==sessionVersion())throw new DOMException('The session changed.','AbortError');
  if(response.ok&&write)invalidateFor(url);
  if(response.status===401||response.status===403&&!write){
    clearSnapshots();
    if(response.status===401){
      document.querySelector('#route-outlet')?.replaceChildren();
      location.replace(signInPath());
    }
  }
  if(response.status===401)throw new Error('Sign in to continue.');
  return response;
}

export async function privateJson(url,options){
  const response=await privateResponse(url,options);
  let result;
  try{result=await response.json();}catch{throw new Error('The connection could not complete. Try again.');}
  if(!response.ok){
    const error=new Error(result.error||'The request could not finish.');
    error.status=response.status;
    throw error;
  }
  return result;
}

export async function logout(){
  await privateJson('/api/private?route=logout',{method:'POST'});
  try{
    for(const key of Object.keys(localStorage)){
      if(key.startsWith('mfa-private:')||key.startsWith('mfa-prototype:'))localStorage.removeItem(key);
    }
    localStorage.setItem(endedKey,String(Date.now()));
  }catch{}
  document.body.replaceChildren();
  location.replace('/sign-in.html');
}

addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
addEventListener('pagehide',()=>document.querySelector('#route-outlet')?.replaceChildren());
addEventListener('storage',event=>{
  if(event.key!==sessionKey&&event.key!==endedKey&&event.key!==null)return;
  clearSnapshots();
  document.body.replaceChildren();
  if(event.key===endedKey)location.replace('/sign-in.html');
  else location.reload();
});
