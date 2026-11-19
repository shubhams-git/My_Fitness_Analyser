import { readFileSync } from 'node:fs';
import { cloudConfig,SupabaseApi } from '../cloud/supabase.mjs';

async function createInvite(){
  const email=process.argv[2]?.trim().toLowerCase();
  if(!email||email.length>254||!/^[^\s@]+@[^\s@]+$/.test(email))throw new Error('Pass the invited email address as the argument.');
  const config=cloudConfig();
  const keys=JSON.parse(readFileSync(0,'utf8'));
  const key=keys.find(entry=>entry.name==='service_role'&&entry.type==='legacy')?.api_key;
  if(!key||!/^ey[\w-]+\.[\w-]+\.[\w-]+$/.test(key))throw new Error('Pipe the linked Supabase project API keys to this command as documented.');

  const api=new SupabaseApi({...config,key},key);
  const query=new URLSearchParams({email:'eq.'+email,select:'claimed_by'});
  const invites=await api.json('/rest/v1/fitness_member_invites?'+query);
  if(invites.length!==1||invites[0].claimed_by!==null)throw new Error('Add this address to the invite list first. This command is for unclaimed invitations.');

  const response=await api.request('/auth/v1/admin/generate_link',{method:'POST',body:{type:'invite',email}});
  if(!response.ok)throw new Error('Supabase could not generate an invite (HTTP '+response.status+'). Check the Auth user and invite status.');
  const invite=await response.json();
  if(invite.email!==email||invite.verification_type!=='invite'||!/^\d{6,10}$/.test(invite.email_otp))
    throw new Error('Supabase returned an unexpected invitation response.');
  console.log(JSON.stringify({email,code:invite.email_otp,url:config.origin+'/sign-in?invite=1'}));
}

createInvite().catch(error=>{console.error(error.message);process.exitCode=1;});
