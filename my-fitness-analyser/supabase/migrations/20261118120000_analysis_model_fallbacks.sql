-- Coordinate with the four-attempt application route. Preserves owner/consent checks.
begin;
alter table public.weight_analysis_reports add column gemini_attempt_count integer not null default 0 check(gemini_attempt_count between 0 and 4), add column gemini_reserved_model text;
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
 elsif failure_code is not null or j.step>=3 then
  update public.analysis_reports set status='failed',finished_at=now() where id=job_id and owner_id=j.owner_id;
  update public.training_analysis_jobs set pack=null,lease=null,lease_until=null,failure=coalesce(failure_code,attempt->>'outcome','unavailable') where id=job_id;
 else
  update public.training_analysis_jobs set step=step+1,lease=null,lease_until=null,available_at=now(),dispatched_at=null where id=job_id;
 end if;
 return true;
end $$;
create or replace function public.reserve_weight_gemini(target_id uuid, key_ids text[], target_model text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner uuid:=auth.uid(); budget jsonb;
begin
 if owner is null or coalesce(target_model,'') not in ('gemini-3.6-flash','gemini-3-flash-preview','gemini-3.1-flash-lite') then raise insufficient_privilege; end if;
 perform pg_advisory_xact_lock(hashtext('weight-ai:'||owner::text));
 if not exists(select 1 from public.weight_analysis_reports r join public.weight_ai_preferences p using(owner_id)
  where r.id=target_id and r.owner_id=owner and r.status='generating' and r.gemini_attempt_count<4 and r.created_at>now()-interval '6 minutes' and p.enabled and p.revision=r.consent_revision) then raise insufficient_privilege; end if;
 budget:=public.take_gemini_budget(key_ids,target_model,false);
 if budget ? 'slot' then update public.weight_analysis_reports set gemini_reserved_at=now(),gemini_attempt_count=gemini_attempt_count+1,gemini_reserved_model=target_model,gemini_backoff_recorded=false where owner_id=owner and id=target_id; end if;
 return budget;
end $$;


create or replace function public.backoff_weight_gemini(target_id uuid, target_model text, retry_seconds integer) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or coalesce(target_model,'') not in ('gemini-3.6-flash','gemini-3-flash-preview','gemini-3.1-flash-lite') then raise insufficient_privilege; end if;
 perform pg_advisory_xact_lock(hashtext('weight-ai:'||auth.uid()::text));
 update public.weight_analysis_reports set gemini_backoff_recorded=true
  where owner_id=auth.uid() and id=target_id and status='generating' and gemini_reserved_model=target_model and not gemini_backoff_recorded and gemini_reserved_at>now()-interval '3 minutes';
 if not found then raise insufficient_privilege; end if;
 insert into public.gemini_model_backoff(model,until_at) values(target_model,now()+make_interval(secs=>greatest(65,least(retry_seconds,86400))))
 on conflict(model) do update set until_at=greatest(gemini_model_backoff.until_at,excluded.until_at);
end $$;
create or replace function public.finish_weight_review_v2(target_id uuid,result_status text,result_report jsonb,result_evidence jsonb,result_model text,attempt_log jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare stored boolean; entry jsonb;
begin
 if auth.uid() is null then raise insufficient_privilege;end if;
 if jsonb_typeof(attempt_log) is distinct from 'array' or jsonb_array_length(attempt_log)>4 or octet_length(attempt_log::text)>8000 then raise exception 'Invalid model attempt metadata.' using errcode='PT400';end if;
 for entry in select value from jsonb_array_elements(attempt_log) loop
  if jsonb_typeof(entry)<>'object' or entry-array['model','thinking','outcome','httpStatus']<>'{}'::jsonb
   or coalesce(entry->>'model','') not in ('gemini-3-flash-preview','gemini-3.8-flash','gemini-3.6-flash','gemini-3.5-flash-lite','gemini-3.1-flash-lite')
   or coalesce(entry->>'thinking','') not in ('high','medium','low','minimal','default')
   or coalesce(entry->>'outcome','') not in ('network','http','invalid','complete') then raise exception 'Invalid model attempt metadata.' using errcode='PT400';end if;
 end loop;
 if result_status='complete' and (result_model is null or result_model not in ('gemini-3-flash-preview','gemini-3.8-flash','gemini-3.6-flash','gemini-3.5-flash-lite','gemini-3.1-flash-lite') or attempt_log->-1->>'model' is distinct from result_model or attempt_log->-1->>'outcome' is distinct from 'complete') then raise exception 'Missing successful model.' using errcode='PT400';end if;
 stored:=public.finish_weight_review(target_id,result_status,result_report,result_evidence);
 if stored then update public.weight_analysis_reports set model_id=coalesce(result_model,model_id),model_policy='weight-fallback-v2',provider_attempts=attempt_log where owner_id=auth.uid() and id=target_id;end if;
 return stored;
end $$;
notify pgrst,'reload schema';
commit;
