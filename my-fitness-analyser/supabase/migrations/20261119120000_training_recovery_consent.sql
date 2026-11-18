-- Retire queued jobs created under the preceding disclosure. Completed reports stay intact.
begin;
create or replace function public.set_ai_preference(allow_analysis boolean,disclosure text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare saved public.ai_preferences;
begin
 if auth.uid() is null or not exists(select 1 from public.fitness_owners where owner_id=auth.uid()) then raise insufficient_privilege; end if;
 if disclosure is null or disclosure<>'gemini-training-v3' and (allow_analysis or disclosure not in ('gemini-run-v1','gemini-training-v2')) then raise exception 'Review the current sharing notice.' using errcode='PT409'; end if;
 perform pg_advisory_xact_lock(hashtext('ai:'||auth.uid()::text));
 insert into public.ai_preferences(owner_id,enabled,disclosure_version) values(auth.uid(),allow_analysis,disclosure)
 on conflict(owner_id) do update set enabled=excluded.enabled,disclosure_version=excluded.disclosure_version,revision=ai_preferences.revision+1,updated_at=now()
 returning * into saved;
 insert into public.ai_consent_events(owner_id,revision,enabled,disclosure_version) values(saved.owner_id,saved.revision,saved.enabled,saved.disclosure_version);
 update public.analysis_reports set status='cancelled',finished_at=now(),report=null,evidence=null where owner_id=auth.uid() and status='generating';
 return jsonb_build_object('enabled',saved.enabled,'revision',saved.revision,'disclosureVersion',saved.disclosure_version,'updatedAt',saved.updated_at);
end $$;

create or replace function public.enqueue_training_job(evidence_key text, evidence_pack jsonb, consent_revision bigint, job_signature text, prompt_version text, schema_version text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner uuid:=auth.uid(); pref public.ai_preferences; active public.training_analysis_jobs; target uuid;
begin
 if owner is null or not exists(select 1 from public.fitness_owners where owner_id=owner) then raise insufficient_privilege; end if;
 perform pg_advisory_xact_lock(hashtext('ai:'||owner::text));
 select * into pref from public.ai_preferences where owner_id=owner;
 if pref.enabled is distinct from true or pref.revision is distinct from consent_revision or pref.disclosure_version<>'gemini-training-v3' then raise insufficient_privilege; end if;
 if coalesce(evidence_key,'') !~ '^[a-f0-9]{64}$' or coalesce(job_signature,'') !~ '^[a-f0-9]{64}$'
  or jsonb_typeof(evidence_pack) is distinct from 'object' or octet_length(evidence_pack::text)>256000
  or prompt_version is distinct from 'runner-coach-v10' or schema_version is distinct from 'coaching-review-v3' then
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
 values(owner,evidence_key,'gemini-3.6-flash',prompt_version,schema_version,pref.revision,'generating','durable-coach-v5') returning id into target;
 insert into public.training_analysis_jobs(id,owner_id,signature,pack) values(target,owner,job_signature,evidence_pack);
 return jsonb_build_object('id',target,'state','queued');
end $$;

create or replace function public.training_job_status() returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('id',r.id,'state',case when r.status<>'generating' then r.status when j.lease_until>now() then 'running'
  when r.created_at<=now()-interval '30 minutes' then 'failed' else 'queued' end,
 'createdAt',r.created_at,'retryAt',case when r.status='generating' and j.lease_until is null and j.available_at>now() then j.available_at end,
 'failure',case when r.status='generating' and r.created_at<=now()-interval '30 minutes' and (j.lease_until is null or j.lease_until<=now()) then 'interrupted' else j.failure end,
 'attempts',r.provider_attempts)
 from public.training_analysis_jobs j join public.analysis_reports r using(owner_id,id)
 join public.ai_preferences p on p.owner_id=r.owner_id and p.revision=r.consent_revision and p.enabled and p.disclosure_version='gemini-training-v3'
 where r.owner_id=auth.uid() order by r.created_at desc limit 1;
$$;

create or replace function public.claim_training_job(job_id uuid, job_capability uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.training_analysis_jobs; r public.analysis_reports;
begin
 select * into j from public.training_analysis_jobs where id=job_id and capability=job_capability;
 if j.id is null then return null; end if;
 perform pg_advisory_xact_lock(hashtext('ai:'||j.owner_id::text));
 select * into j from public.training_analysis_jobs where id=job_id for update;
 select * into r from public.analysis_reports where id=job_id and owner_id=j.owner_id;
 if j.pack is null or j.available_at>now() or j.lease_until>now() then return null; end if;
 if r.status<>'generating' or not exists(select 1 from public.ai_preferences where owner_id=j.owner_id and enabled and revision=r.consent_revision and disclosure_version='gemini-training-v3') then
  update public.training_analysis_jobs set pack=null,lease=null,lease_until=null,failure='cancelled' where id=job_id;
  update public.analysis_reports set status='cancelled',finished_at=now() where id=job_id and owner_id=j.owner_id and status='generating';return null;
 end if;
 if j.interrupted>=3 or r.created_at<now()-interval '30 minutes' then
  update public.training_analysis_jobs set pack=null,lease=null,lease_until=null,failure='interrupted' where id=job_id;
  update public.analysis_reports set status='failed',finished_at=now() where id=job_id and owner_id=j.owner_id;return null;
 end if;
 update public.training_analysis_jobs set lease=gen_random_uuid(),lease_until=now()+interval '5 minutes',interrupted=interrupted+case when lease is null then 0 else 1 end
 where id=job_id returning * into j;
 return jsonb_build_object('owner',j.owner_id,'consentRevision',r.consent_revision,'evidenceKey',r.evidence_key,'pack',j.pack,
 'step',j.step,'lease',j.lease,'signature',j.signature,'promptVersion',r.prompt_version,'schemaVersion',r.schema_version);
end $$;

create or replace function public.reserve_training_gemini(job_id uuid, job_capability uuid, job_lease uuid, key_ids text[], target_model text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.training_analysis_jobs; budget jsonb;
begin
 select * into j from public.training_analysis_jobs where id=job_id and capability=job_capability;
 if j.id is null then return null; end if;
 perform pg_advisory_xact_lock(hashtext('ai:'||j.owner_id::text));
 if not exists(select 1 from public.training_analysis_jobs q join public.analysis_reports r using(owner_id,id) join public.ai_preferences p using(owner_id)
  where q.id=job_id and q.lease=job_lease and q.lease_until>now() and q.pack is not null and r.status='generating'
    and p.enabled and p.revision=r.consent_revision and p.disclosure_version='gemini-training-v3') then return null; end if;
 select * into j from public.training_analysis_jobs where id=job_id;
 if target_model is distinct from (array['gemini-3.6-flash','gemini-3.6-flash','gemini-3-flash-preview','gemini-3.1-flash-lite'])[j.step+1] then
  raise insufficient_privilege;
 end if;
 budget:=public.take_gemini_budget(key_ids,target_model);
 if budget ? 'retryAt' and not budget ? 'modelBlocked' then
  if (budget->>'retryAt')::timestamptz>now()+interval '10 minutes' then
   return budget||jsonb_build_object('dailyLimit',true);
  else
   update public.training_analysis_jobs set lease=null,lease_until=null,available_at=(budget->>'retryAt')::timestamptz where id=job_id;
  end if;
 end if;
 return budget;
end $$;

create or replace function public.finish_training_job(job_id uuid, job_capability uuid, job_lease uuid, attempt jsonb, result_report jsonb, retry_seconds integer, failure_code text) returns boolean
language plpgsql security definer set search_path='' as $$
declare j public.training_analysis_jobs; r public.analysis_reports;
begin
 select * into j from public.training_analysis_jobs where id=job_id and capability=job_capability;
 if j.id is null then return false; end if;
 perform pg_advisory_xact_lock(hashtext('ai:'||j.owner_id::text));
 select * into j from public.training_analysis_jobs where id=job_id for update;
 select * into r from public.analysis_reports where id=job_id and owner_id=j.owner_id;
 if j.lease is distinct from job_lease or j.lease_until is null or j.lease_until<=now() or j.pack is null then return false; end if;
 if r.status<>'generating' or not exists(select 1 from public.ai_preferences where owner_id=j.owner_id and enabled and revision=r.consent_revision and disclosure_version='gemini-training-v3') then
  update public.training_analysis_jobs set pack=null,lease=null,lease_until=null,failure='cancelled' where id=job_id;
  update public.analysis_reports set status='cancelled',finished_at=now() where id=job_id and owner_id=j.owner_id and status='generating';return false;
 end if;
 if attempt is not null then
  if jsonb_typeof(attempt) is distinct from 'object' or octet_length(attempt::text)>1200 then raise exception 'Invalid training attempt.'; end if;
  update public.analysis_reports set provider_attempts=coalesce(provider_attempts,'[]'::jsonb)||jsonb_build_array(attempt) where id=job_id and owner_id=j.owner_id;
  if attempt->>'outcome'='quota' and retry_seconds>0 then
   insert into public.gemini_model_backoff(model,until_at) values(attempt->>'model',now()+make_interval(secs=>least(retry_seconds,86400)))
   on conflict(model) do update set until_at=greatest(gemini_model_backoff.until_at,excluded.until_at);
  end if;
 end if;
 if result_report is not null then
  if jsonb_typeof(result_report)<>'object' or octet_length(result_report::text)>64000 or
   (failure_code is distinct from 'recorded-training' and attempt->>'outcome' is distinct from 'complete') then raise exception 'Invalid training report.'; end if;
  update public.analysis_reports set status='complete',finished_at=now(),report=result_report,evidence=j.pack,
   model_id=case when failure_code='recorded-training' then failure_code else attempt->>'model' end
  where id=job_id and owner_id=j.owner_id;
  update public.training_analysis_jobs set pack=null,lease=null,lease_until=null,failure=null where id=job_id;
 elsif failure_code is not null or j.step>=3 then
  update public.analysis_reports set status='failed',finished_at=now() where id=job_id and owner_id=j.owner_id;
  update public.training_analysis_jobs set pack=null,lease=null,lease_until=null,failure=coalesce(failure_code,attempt->>'outcome','unavailable') where id=job_id;
 else
  update public.training_analysis_jobs set step=step+1,lease=null,lease_until=null,available_at=now(),dispatched_at=null where id=job_id;
 end if;
 return true;
end $$;

create or replace function public.training_generation_allowed(job_id uuid,job_capability uuid,job_lease uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.training_analysis_jobs j join public.analysis_reports r using(owner_id,id)
  join public.ai_preferences p using(owner_id)
  where j.id=job_id and j.capability=job_capability and j.lease=job_lease and j.lease_until>now()
   and j.pack is not null and r.status='generating' and p.enabled and p.revision=r.consent_revision
   and p.disclosure_version='gemini-training-v3');
$$;
revoke all on function public.training_generation_allowed(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.training_generation_allowed(uuid,uuid,uuid) to anon;

update public.analysis_reports r set status='cancelled',finished_at=now()
 where r.status='generating' and exists(select 1 from public.training_analysis_jobs j where j.id=r.id and j.owner_id=r.owner_id)
  and not exists(select 1 from public.ai_preferences p where p.owner_id=r.owner_id and p.enabled
   and p.revision=r.consent_revision and p.disclosure_version='gemini-training-v3');
notify pgrst,'reload schema';
commit;
