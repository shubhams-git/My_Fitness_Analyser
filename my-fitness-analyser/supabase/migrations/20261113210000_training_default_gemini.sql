begin;
create or replace function public.enqueue_training_job(evidence_key text, evidence_pack jsonb, consent_revision bigint, job_signature text, prompt_version text, schema_version text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner uuid:=auth.uid(); pref public.ai_preferences; active public.training_analysis_jobs; target uuid;
begin
 if owner is null or not exists(select 1 from public.fitness_owners where owner_id=owner) then raise insufficient_privilege; end if;
 perform pg_advisory_xact_lock(hashtext('ai:'||owner::text));
 select * into pref from public.ai_preferences where owner_id=owner;
 if pref.enabled is distinct from true or pref.revision is distinct from consent_revision or pref.disclosure_version<>'gemini-training-v2' then raise insufficient_privilege; end if;
 if coalesce(evidence_key,'') !~ '^[a-f0-9]{64}$' or coalesce(job_signature,'') !~ '^[a-f0-9]{64}$'
  or jsonb_typeof(evidence_pack) is distinct from 'object' or octet_length(evidence_pack::text)>256000
  or coalesce(length(prompt_version),0) not between 1 and 80 or coalesce(length(schema_version),0) not between 1 and 80 then
  raise exception 'Invalid training job.' using errcode='PT400'; end if;
 update public.training_analysis_jobs j set pack=null,lease=null,lease_until=null,failure='cancelled'
  from public.analysis_reports r where j.id=r.id and j.owner_id=owner and r.owner_id=owner and j.pack is not null
   and (r.status<>'generating' or r.consent_revision<>pref.revision);
 update public.analysis_reports r set status='cancelled',finished_at=now() from public.training_analysis_jobs j
  where j.id=r.id and r.owner_id=owner and j.owner_id=owner and r.status='generating' and r.consent_revision<>pref.revision;
 update public.analysis_reports r set status='failed',finished_at=now() from public.training_analysis_jobs j
  where j.id=r.id and r.owner_id=owner and j.owner_id=owner and r.status='generating' and r.created_at<=now()-interval '30 minutes'
   and (j.lease_until is null or j.lease_until<=now());
 update public.training_analysis_jobs j set pack=null,lease=null,lease_until=null,failure='interrupted'
  from public.analysis_reports r where j.id=r.id and j.owner_id=owner and r.owner_id=owner and j.pack is not null and r.status='failed';
 select * into active from public.training_analysis_jobs where owner_id=owner and pack is not null;
 if active.id is not null then return jsonb_build_object('id',active.id,'state',case when active.lease_until>now() then 'running' else 'queued' end); end if;
 if exists(select 1 from public.analysis_reports where owner_id=owner and created_at>now()-interval '30 seconds') then
  raise exception 'Review cooldown.' using errcode='PT429'; end if;
 insert into public.analysis_reports(owner_id,evidence_key,model_id,prompt_version,schema_version,consent_revision,status,model_policy)
 values(owner,evidence_key,'gemini-3.6-flash',prompt_version,schema_version,pref.revision,'generating','durable-coach-v3') returning id into target;
 insert into public.training_analysis_jobs(id,owner_id,signature,pack) values(target,owner,job_signature,evidence_pack);
 return jsonb_build_object('id',target,'state','queued');
end $$;

notify pgrst,'reload schema';
commit;
