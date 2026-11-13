begin;

-- A job's capability and pending evidence are never exposed through owner RLS.
create table public.training_analysis_jobs (
 id uuid primary key,
 owner_id uuid not null,
 capability uuid not null default gen_random_uuid(),
 signature text not null,
 pack jsonb,
 step integer not null default 0 check(step between 0 and 3),
 interrupted integer not null default 0,
 available_at timestamptz not null default now(),
 dispatched_at timestamptz,
 lease uuid,
 lease_until timestamptz,
 failure text,
 foreign key (owner_id,id) references public.analysis_reports(owner_id,id) on delete cascade
);
alter table public.training_analysis_jobs enable row level security;
revoke all on public.training_analysis_jobs from public, anon, authenticated;
create unique index one_training_job_per_owner on public.training_analysis_jobs(owner_id) where pack is not null;

create table public.gemini_request_budget (
 singleton boolean primary key default true check(singleton),
 next_request_at timestamptz not null default '-infinity',
 quota_day date,
 used integer not null default 0,
 last_key_id text
);
alter table public.gemini_request_budget enable row level security;
revoke all on public.gemini_request_budget from public, anon, authenticated;
insert into public.gemini_request_budget(singleton) values(true);

create table public.gemini_model_backoff (
 model text primary key,
 until_at timestamptz not null
);
alter table public.gemini_model_backoff enable row level security;
revoke all on public.gemini_model_backoff from public, anon, authenticated;

alter table public.weight_analysis_reports add column gemini_reserved_at timestamptz,add column gemini_backoff_recorded boolean not null default false;

create function public.take_gemini_budget(key_ids text[], target_model text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare budget public.gemini_request_budget; slot integer; retry timestamptz; quota_today date := (now() at time zone 'America/Los_Angeles')::date;
begin
 if coalesce(array_ndims(key_ids),0)<>1 or array_lower(key_ids,1)<>1 or cardinality(key_ids) not between 1 and 5
 or exists(select 1 from unnest(key_ids) id where id is null or id !~ '^[a-f0-9]{64}$')
 or (select count(distinct id) from unnest(key_ids) id)<>cardinality(key_ids) then raise insufficient_privilege; end if;
 select * into strict budget from public.gemini_request_budget where singleton for update;
 select until_at into retry from public.gemini_model_backoff where model=target_model and until_at>now();
 if retry is not null then return jsonb_build_object('modelBlocked',true,'retryAt',retry); end if;
 if budget.quota_day=quota_today and budget.used>=20 then
  return jsonb_build_object('retryAt',(quota_today+1)::timestamp at time zone 'America/Los_Angeles');
 end if;
 if budget.next_request_at>now() then return jsonb_build_object('retryAt',budget.next_request_at); end if;
 slot:=coalesce(array_position(key_ids,budget.last_key_id),0)%cardinality(key_ids)+1;
 update public.gemini_request_budget set last_key_id=key_ids[slot],next_request_at=now()+interval '65 seconds',
  quota_day=quota_today,used=case when quota_day=quota_today then used+1 else 1 end where singleton;
 return jsonb_build_object('slot',slot);
end $$;

create function public.enqueue_training_job(evidence_key text, evidence_pack jsonb, consent_revision bigint, job_signature text, prompt_version text, schema_version text) returns jsonb
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
 values(owner,evidence_key,'gemini-3.5-flash-lite',prompt_version,schema_version,pref.revision,'generating','durable-coach-v2') returning id into target;
 insert into public.training_analysis_jobs(id,owner_id,signature,pack) values(target,owner,job_signature,evidence_pack);
 return jsonb_build_object('id',target,'state','queued');
end $$;

create function public.training_job_status() returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('id',r.id,'state',case when r.status<>'generating' then r.status when j.lease_until>now() then 'running'
  when r.created_at<=now()-interval '30 minutes' then 'failed' else 'queued' end,
 'createdAt',r.created_at,'retryAt',case when r.status='generating' and j.lease_until is null and j.available_at>now() then j.available_at end,
 'failure',case when r.status='generating' and r.created_at<=now()-interval '30 minutes' and (j.lease_until is null or j.lease_until<=now()) then 'interrupted' else j.failure end,
 'attempts',r.provider_attempts)
 from public.training_analysis_jobs j join public.analysis_reports r using(owner_id,id)
 join public.ai_preferences p on p.owner_id=r.owner_id and p.revision=r.consent_revision and p.enabled and p.disclosure_version='gemini-training-v2'
 where r.owner_id=auth.uid() order by r.created_at desc limit 1;
$$;

create function public.claim_training_job(job_id uuid, job_capability uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.training_analysis_jobs; r public.analysis_reports;
begin
 select * into j from public.training_analysis_jobs where id=job_id and capability=job_capability;
 if j.id is null then return null; end if;
 perform pg_advisory_xact_lock(hashtext('ai:'||j.owner_id::text));
 select * into j from public.training_analysis_jobs where id=job_id for update;
 select * into r from public.analysis_reports where id=job_id and owner_id=j.owner_id;
 if j.pack is null or j.available_at>now() or j.lease_until>now() then return null; end if;
 if r.status<>'generating' or not exists(select 1 from public.ai_preferences where owner_id=j.owner_id and enabled and revision=r.consent_revision and disclosure_version='gemini-training-v2') then
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

create function public.reserve_training_gemini(job_id uuid, job_capability uuid, job_lease uuid, key_ids text[], target_model text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.training_analysis_jobs; budget jsonb;
begin
 select * into j from public.training_analysis_jobs where id=job_id and capability=job_capability;
 if j.id is null then return null; end if;
 perform pg_advisory_xact_lock(hashtext('ai:'||j.owner_id::text));
 if not exists(select 1 from public.training_analysis_jobs q join public.analysis_reports r using(owner_id,id) join public.ai_preferences p using(owner_id)
  where q.id=job_id and q.lease=job_lease and q.lease_until>now() and q.pack is not null and r.status='generating'
    and p.enabled and p.revision=r.consent_revision and p.disclosure_version='gemini-training-v2') then return null; end if;
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

create function public.finish_training_job(job_id uuid, job_capability uuid, job_lease uuid, attempt jsonb, result_report jsonb, retry_seconds integer, failure_code text) returns boolean
language plpgsql security definer set search_path='' as $$
declare j public.training_analysis_jobs; r public.analysis_reports;
begin
 select * into j from public.training_analysis_jobs where id=job_id and capability=job_capability;
 if j.id is null then return false; end if;
 perform pg_advisory_xact_lock(hashtext('ai:'||j.owner_id::text));
 select * into j from public.training_analysis_jobs where id=job_id for update;
 select * into r from public.analysis_reports where id=job_id and owner_id=j.owner_id;
 if j.lease is distinct from job_lease or j.lease_until is null or j.lease_until<=now() or j.pack is null then return false; end if;
 if r.status<>'generating' or not exists(select 1 from public.ai_preferences where owner_id=j.owner_id and enabled and revision=r.consent_revision and disclosure_version='gemini-training-v2') then
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
 elsif failure_code is not null or j.step>=2 then
  update public.analysis_reports set status='failed',finished_at=now() where id=job_id and owner_id=j.owner_id;
  update public.training_analysis_jobs set pack=null,lease=null,lease_until=null,failure=coalesce(failure_code,attempt->>'outcome','unavailable') where id=job_id;
 else
  update public.training_analysis_jobs set step=step+1,lease=null,lease_until=null,available_at=now(),dispatched_at=null where id=job_id;
 end if;
 return true;
end $$;

create function public.reserve_weight_gemini(target_id uuid, key_ids text[], target_model text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner uuid:=auth.uid(); budget jsonb;
begin
 if owner is null or target_model is distinct from 'gemini-3.6-flash' then raise insufficient_privilege; end if;
 perform pg_advisory_xact_lock(hashtext('weight-ai:'||owner::text));
 if not exists(select 1 from public.weight_analysis_reports r join public.weight_ai_preferences p using(owner_id)
  where r.id=target_id and r.owner_id=owner and r.status='generating' and r.gemini_reserved_at is null and r.created_at>now()-interval '6 minutes' and p.enabled and p.revision=r.consent_revision) then raise insufficient_privilege; end if;
 budget:=public.take_gemini_budget(key_ids,target_model);
 if budget ? 'slot' then update public.weight_analysis_reports set gemini_reserved_at=now() where owner_id=owner and id=target_id; end if;
 return budget;
end $$;

create function public.backoff_weight_gemini(target_id uuid, target_model text, retry_seconds integer) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or target_model is distinct from 'gemini-3.6-flash' then raise insufficient_privilege; end if;
 perform pg_advisory_xact_lock(hashtext('weight-ai:'||auth.uid()::text));
 update public.weight_analysis_reports set gemini_backoff_recorded=true
  where owner_id=auth.uid() and id=target_id and status='generating' and not gemini_backoff_recorded and gemini_reserved_at>now()-interval '3 minutes';
 if not found then raise insufficient_privilege; end if;
 insert into public.gemini_model_backoff(model,until_at) values(target_model,now()+make_interval(secs=>greatest(65,least(retry_seconds,86400))))
 on conflict(model) do update set until_at=greatest(gemini_model_backoff.until_at,excluded.until_at);
end $$;

create function public.clear_cancelled_training_job() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.training_analysis_jobs set pack=null,lease=null,lease_until=null,failure='cancelled' where id=new.id and owner_id=new.owner_id;
 return new;
end $$;
create trigger clear_cancelled_training_job after update of status on public.analysis_reports for each row
 when (new.status='cancelled' and old.status is distinct from new.status) execute function public.clear_cancelled_training_job();

revoke all on function public.take_gemini_budget(text[],text),public.enqueue_training_job(text,jsonb,bigint,text,text,text),public.training_job_status(),public.claim_training_job(uuid,uuid),public.reserve_training_gemini(uuid,uuid,uuid,text[],text),public.finish_training_job(uuid,uuid,uuid,jsonb,jsonb,integer,text),public.reserve_weight_gemini(uuid,text[],text) from public,anon,authenticated;
grant execute on function public.enqueue_training_job(text,jsonb,bigint,text,text,text),public.training_job_status(),public.reserve_weight_gemini(uuid,text[],text) to authenticated;
grant execute on function public.claim_training_job(uuid,uuid),public.reserve_training_gemini(uuid,uuid,uuid,text[],text),public.finish_training_job(uuid,uuid,uuid,jsonb,jsonb,integer,text) to anon;
revoke all on function public.backoff_weight_gemini(uuid,text,integer),public.clear_cancelled_training_job() from public,anon,authenticated;
grant execute on function public.backoff_weight_gemini(uuid,text,integer) to authenticated;
revoke execute on function public.begin_training_review(text,text,text,text),public.finish_training_review(uuid,text,jsonb,jsonb),public.finish_training_review_v2(uuid,text,jsonb,jsonb,text,jsonb) from authenticated;
notify pgrst,'reload schema';
commit;
