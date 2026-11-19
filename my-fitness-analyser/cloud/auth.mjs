import { CloudError,SupabaseApi } from './supabase.mjs';
import { createHash,randomBytes } from 'node:crypto';

const accessName='fitness_access',refreshName='fitness_refresh';
const verifierName='fitness_pkce';
const providers=new Set(['google','facebook','github']);
const callbackPath='/api/auth/callback';
function cookies(request){return Object.fromEntries((request.headers.cookie||'').split(';').map(s=>{const i=s.indexOf('=');return [s.slice(0,i).trim(),s.slice(i+1)];}).filter(([key])=>key));}
function sessionCookies(session){return [`${accessName}=${session.access_token||''}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${session.access_token?Math.min(session.expires_in||3600,3600):0}`,`${refreshName}=${session.refresh_token||''}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=${session.refresh_token?2592000:0}`];}
function setSession(response,session){response.setHeader('Set-Cookie',sessionCookies(session));}
function verifierCookie(verifier){return `${verifierName}=${verifier}; Path=${callbackPath}; HttpOnly; Secure; SameSite=Lax; Max-Age=${verifier?3600:0}`;}
function pkce(){const verifier=randomBytes(32).toString('base64url');return {verifier,challenge:createHash('sha256').update(verifier).digest('base64url')};}
export function requireOrigin(request,config){if(request.headers.origin!==config.origin)throw new CloudError(403,'Open the private app to perform this action.');}
export async function authOptions(config){
  if(!config.memberAccounts)return {memberAccounts:false};
  const settings=await new SupabaseApi(config).json('/auth/v1/settings');
  return {memberAccounts:true,providers:Object.fromEntries([...providers].map(provider=>[provider,settings.external?.[provider]===true]))};
}
async function ownerSession(api,{claimInvite=false}={}){
  const response=await api.request('/auth/v1/user');if(response.status===401||response.status===403)return false;if(!response.ok)throw new CloudError(503,'Sign-in could not be verified.');
  const user=await response.json();if(!/^[0-9a-f-]{36}$/i.test(user.id||''))throw new CloudError(401,'Sign-in could not be verified.');
  const members=await api.json(`/rest/v1/fitness_owners?owner_id=eq.${user.id}&select=owner_id`);
  if(!Array.isArray(members)||!members.some(row=>row.owner_id===user.id)){
    if(!claimInvite||!api.config.memberAccounts||await api.json('/rest/v1/rpc/claim_fitness_member_invite',{method:'POST',body:{}})!==true)
      throw new CloudError(403,'Use the verified email address on your invitation.');
  }
  // Bind this request to the verified member, never a body/query owner ID.
  const metadata=user.user_metadata||{};
  const name=[metadata.display_name,metadata.full_name,metadata.name,metadata.user_name].find(value=>typeof value==='string'&&value.trim());
  api.config={...api.config,owner:user.id};api.user={id:user.id,email:user.email||'',displayName:name?.trim().slice(0,80)||''};return true;
}

export async function signIn(request,response,config,body,{fetcher=fetch}={}){
  requireOrigin(request,config);
  if(typeof body?.email!=='string'||typeof body?.password!=='string'||body.email.length>254||body.password.length>1024||!body.email.trim()||!body.password)throw new CloudError(400,'Enter your email and password.');
  const api=new SupabaseApi(config,null,{fetcher});
  const result=await api.request('/auth/v1/token?grant_type=password',{method:'POST',body:{email:body.email.trim(),password:body.password}});
  if(!result.ok)throw new CloudError(result.status===429?429:401,result.status===429?'Too many sign-in attempts. Please wait and try again.':'Sign-in failed. Check your email and password.');
  const session=await result.json();if(!session.access_token||!session.refresh_token)throw new CloudError(503,'Sign-in could not be completed.');api.token=session.access_token;
  if(!await ownerSession(api,{claimInvite:true}))throw new CloudError(401,'Sign-in could not be verified.');setSession(response,session);return api.user;
}

export async function register(request,response,config,body,{fetcher=fetch}={}){
  requireOrigin(request,config);
  const email=typeof body?.email==='string'?body.email.trim():'';
  const password=body?.password;
  if(!/^[^\s@]+@[^\s@]+$/.test(email)||email.length>254||typeof password!=='string'||password.length<12||password.length>1024)
    throw new CloudError(400,'Enter your invited email address and a password of at least 12 characters.');
  const {verifier,challenge}=pkce(),api=new SupabaseApi(config,null,{fetcher});
  const query=new URLSearchParams({redirect_to:config.origin+callbackPath});
  const result=await api.request('/auth/v1/signup?'+query,{method:'POST',body:{email,password,code_challenge:challenge,code_challenge_method:'s256'}});
  if(!result.ok){
    if(result.status===429)throw new CloudError(429,'Too many attempts. Please wait and try again.');
    if(result.status>=500)throw new CloudError(503,'Registration is temporarily unavailable. Try again shortly.');
    throw new CloudError(400,'Check your invitation email address and choose a password of at least 12 characters.');
  }
  response.setHeader('Set-Cookie',verifierCookie(verifier));
}

export async function acceptInvitation(request,response,config,body,{fetcher=fetch}={}){
  requireOrigin(request,config);
  const email=typeof body?.email==='string'?body.email.trim().toLowerCase():'';
  const token=typeof body?.code==='string'?body.code.trim():'';
  if(!/^[^\s@]+@[^\s@]+$/.test(email)||email.length>254||!/^\d{6,10}$/.test(token))
    throw new CloudError(400,'Enter the email address and numeric code from your invitation.');
  const api=new SupabaseApi(config,null,{fetcher});
  const result=await api.request('/auth/v1/verify',{method:'POST',body:{type:'invite',email,token}});
  if(!result.ok){
    if(result.status===429)throw new CloudError(429,'Too many attempts. Wait a minute and try again.');
    if(result.status>=500)throw new CloudError(503,'The invitation could not be checked. Try again shortly.');
    throw new CloudError(400,'That invitation code is invalid or expired. Ask for a new code.');
  }
  const session=await result.json();
  if(!session.access_token||!session.refresh_token)throw new CloudError(503,'Sign-in could not be completed.');
  api.token=session.access_token;
  if(!await ownerSession(api,{claimInvite:true}))throw new CloudError(401,'Sign-in could not be verified.');
  setSession(response,session);
}

export function startOAuth(request,response,config,provider){
  requireOrigin(request,config);
  if(!providers.has(provider))throw new CloudError(400,'Choose Google, Facebook or GitHub.');
  const {verifier,challenge}=pkce();
  const authorizeUrl=new URL('/auth/v1/authorize',config.url);
  authorizeUrl.search=new URLSearchParams({provider,redirect_to:config.origin+callbackPath,code_challenge:challenge,code_challenge_method:'s256'});
  response.setHeader('Set-Cookie',verifierCookie(verifier));
  return authorizeUrl.href;
}

export async function finishAuth(request,response,config,{fetcher=fetch}={}){
  const params=new URL(request.url,config.origin).searchParams;
  const code=params.get('code'),verifier=cookies(request)[verifierName];
  response.setHeader('Set-Cookie',verifierCookie(''));
  if(params.has('error')||!code||code.length>512||!(/^[\w-]{43}$/.test(verifier||'')))return '/sign-in?auth=retry';
  const api=new SupabaseApi(config,null,{fetcher});
  try{
    const result=await api.request('/auth/v1/token?grant_type=pkce',{method:'POST',body:{auth_code:code,code_verifier:verifier}});
    if(!result.ok)return '/sign-in?auth=retry';
    const session=await result.json();
    if(!session.access_token||!session.refresh_token)return '/sign-in?auth=retry';
    api.token=session.access_token;
    if(!await ownerSession(api,{claimInvite:true}))return '/sign-in?auth=retry';
    response.setHeader('Set-Cookie',[...sessionCookies(session),verifierCookie('')]);
    return '/sign-in?auth=complete';
  }catch(error){return error.status===403?'/sign-in?auth=invite':'/sign-in?auth=retry';}
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
