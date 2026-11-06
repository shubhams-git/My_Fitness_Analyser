import { CloudError,SupabaseApi } from './supabase.mjs';

const accessName='fitness_access',refreshName='fitness_refresh';
function cookies(request){return Object.fromEntries((request.headers.cookie||'').split(';').map(s=>{const i=s.indexOf('=');return [s.slice(0,i).trim(),s.slice(i+1)];}).filter(([key])=>key));}
function setSession(response,session){response.setHeader('Set-Cookie',[`${accessName}=${session.access_token||''}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${session.access_token?Math.min(session.expires_in||3600,3600):0}`,`${refreshName}=${session.refresh_token||''}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=${session.refresh_token?2592000:0}`]);}
export function requireOrigin(request,config){if(request.headers.origin!==config.origin)throw new CloudError(403,'Open the private app to perform this action.');}
async function ownerSession(api){
  const response=await api.request('/auth/v1/user');if(response.status===401||response.status===403)return false;if(!response.ok)throw new CloudError(503,'Sign-in could not be verified.');
  const user=await response.json();if(!/^[0-9a-f-]{36}$/i.test(user.id||''))throw new CloudError(401,'Sign-in could not be verified.');
  const members=await api.json(`/rest/v1/fitness_owners?owner_id=eq.${user.id}&select=owner_id`);
  if(!Array.isArray(members)||!members.some(row=>row.owner_id===user.id))throw new CloudError(403,'This account has not been invited to My Fitness Analyser.');
  // Bind this request to the verified member, never a body/query owner ID.
  api.config={...api.config,owner:user.id};api.user={id:user.id,email:user.email||'',displayName:typeof user.user_metadata?.display_name==='string'?user.user_metadata.display_name.slice(0,80):''};return true;
}

export async function signIn(request,response,config,body,{fetcher=fetch}={}){
  requireOrigin(request,config);
  if(typeof body?.email!=='string'||typeof body?.password!=='string'||body.email.length>254||body.password.length>1024||!body.email.trim()||!body.password)throw new CloudError(400,'Enter your email and password.');
  const api=new SupabaseApi(config,null,{fetcher});
  const result=await api.request('/auth/v1/token?grant_type=password',{method:'POST',body:{email:body.email.trim(),password:body.password}});
  if(!result.ok)throw new CloudError(result.status===429?429:401,result.status===429?'Too many sign-in attempts. Please wait and try again.':'Sign-in failed. Check your email and password.');
  const session=await result.json();if(!session.access_token||!session.refresh_token)throw new CloudError(503,'Sign-in could not be completed.');api.token=session.access_token;
  if(!await ownerSession(api))throw new CloudError(401,'Sign-in could not be verified.');setSession(response,session);return api.user;
}
export async function authorize(request,response,config,{fetcher=fetch}={}){
  const stored=cookies(request),api=new SupabaseApi(config,stored[accessName],{fetcher});
  if(stored[accessName]&&await ownerSession(api))return api;
  if(stored[refreshName]){
    const result=await api.request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:stored[refreshName]}});
    if(result.ok){const session=await result.json();api.token=session.access_token;if(session.access_token&&session.refresh_token&&await ownerSession(api)){setSession(response,session);return api;}}
    else if(result.status>=500||result.status===429)throw new CloudError(503,'Session renewal is temporarily unavailable. Please retry.');
  }
  setSession(response,{});throw new CloudError(401,'Sign in to open your training library.');
}
export async function signOut(request,response,config,options){
  requireOrigin(request,config);
  try{const api=await authorize(request,response,config,options);const result=await api.request('/auth/v1/logout?scope=local',{method:'POST'});if(!result.ok&&result.status!==401)throw new CloudError(503,'Sign-out could not be completed. Please retry.');}
  catch(error){if(![401,403].includes(error.status))throw error;}
  setSession(response,{});
}
