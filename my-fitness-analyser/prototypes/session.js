export function signInPath(){return '/sign-in.html?next='+encodeURIComponent(location.pathname+location.search);}
export async function privateJson(url,options={}){
  const response=await fetch(url,{cache:'no-store',...options});
  if(response.status===401){location.replace(signInPath());throw new Error('Sign in to continue.');}
  let result;try{result=await response.json();}catch{throw new Error('The connection could not complete. Try again.');}
  if(!response.ok)throw new Error(result.error||'The request could not finish.');return result;
}
export async function logout(){
  await privateJson('/api/private?route=logout',{method:'POST'});
  try{for(const key of Object.keys(localStorage))if(key.startsWith('mfa-private:')||key.startsWith('mfa-prototype:'))localStorage.removeItem(key);localStorage.setItem('mfa-session-ended',String(Date.now()));}catch{}
  document.body.replaceChildren();location.replace('/sign-in.html');
}
addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
addEventListener('pagehide',()=>{document.querySelector('#training-root,#app,#journal-root,#account-main')?.replaceChildren();});
addEventListener('storage',event=>{if(event.key==='mfa-session-ended'){document.body.replaceChildren();location.replace('/sign-in.html');}});
