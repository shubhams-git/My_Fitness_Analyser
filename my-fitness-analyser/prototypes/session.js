const snapshotPrefix='mfa-view-v1:';
const requests=new Map();
let generation=0;
function sessionVersion(){
  try{return [localStorage.getItem('mfa-view-session-changed'),localStorage.getItem('mfa-session-ended')].join(':');}catch{return null;}
}
export function clearSnapshots(){
  generation++;
  requests.clear();
  try{for(const key of Object.keys(sessionStorage))if(key.startsWith(snapshotPrefix))sessionStorage.removeItem(key);}catch{}
}
export function viewSnapshot(url){
  try{
    const entry=JSON.parse(sessionStorage.getItem(snapshotPrefix+url));
    return entry&&entry.session===sessionVersion()&&Date.now()-entry.at<300000?entry:null;
  }catch{return null;}
}
export function refreshView(url,{force=false}={}){
  if(!force&&requests.has(url))return requests.get(url);
  const epoch=generation,session=sessionVersion();
  const request=privateJson(url).then(value=>{
    if(session!==null&&session===sessionVersion()&&epoch===generation&&requests.get(url)===request&&value.cloud&&value.viewer?.id){
      try{sessionStorage.setItem(snapshotPrefix+url,JSON.stringify({at:Date.now(),session,value}));}catch{}
    }
    return value;
  }).finally(()=>{if(requests.get(url)===request)requests.delete(url);});
  requests.set(url,request);
  return request;
}
export function signInPath(){return '/sign-in.html?next='+encodeURIComponent(location.pathname+location.search);}
export async function privateJson(url,options={}){
  if(options.method&&options.method!=='GET')clearSnapshots();
  const response=await fetch(url,{cache:'no-store',...options});
  if(response.status===401){clearSnapshots();location.replace(signInPath());throw new Error('Sign in to continue.');}
  let result;try{result=await response.json();}catch{throw new Error('The connection could not complete. Try again.');}
  if(!response.ok){const error=new Error(result.error||'The request could not finish.');error.status=response.status;throw error;}return result;
}
export async function logout(){
  await privateJson('/api/private?route=logout',{method:'POST'});
  try{for(const key of Object.keys(localStorage))if(key.startsWith('mfa-private:')||key.startsWith('mfa-prototype:'))localStorage.removeItem(key);localStorage.setItem('mfa-session-ended',String(Date.now()));}catch{}
  document.body.replaceChildren();location.replace('/sign-in.html');
}
addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
addEventListener('pagehide',()=>{document.querySelector('#training-root,#app,#journal-root,#account-main')?.replaceChildren();});
addEventListener('storage',event=>{if(event.key==='mfa-view-session-changed')clearSnapshots();if(event.key==='mfa-session-ended'){clearSnapshots();document.body.replaceChildren();location.replace('/sign-in.html');}});
