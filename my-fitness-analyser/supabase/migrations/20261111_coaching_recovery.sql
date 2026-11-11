begin;
create or replace function public.begin_training_review(evidence_key text,model_id text,prompt_version text,schema_version text) returns uuid
language plpgsql security definer set search_path='' as $$
declare pref public.ai_preferences; result_id uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.fitness_owners where owner_id=auth.uid()) then raise insufficient_privilege; end if;
 perform pg_advisory_xact_lock(hashtext('ai:'||auth.uid()::text));
 select * into pref from public.ai_preferences where owner_id=auth.uid();
 if pref.enabled is distinct from true or pref.disclosure_version<>'gemini-run-v1' then raise insufficient_privilege; end if;
 if evidence_key !~ '^[0-9a-f]{64}$' or model_id not in('gemini-3.8-flash','gemini-3.7-flash','gemini-3.6-flash') or length(prompt_version)>80 or length(schema_version)>80 then raise exception 'Invalid analysis request.'; end if;
 if exists(select 1 from public.analysis_reports where owner_id=auth.uid() and status='generating' and created_at>now()-interval '6 minutes') then raise exception 'A review is already running.' using errcode='PT409'; end if;
 if exists(select 1 from public.analysis_reports where owner_id=auth.uid() and created_at>now()-interval '30 seconds') then
  raise exception 'Review cooldown.' using errcode='PT429';
 end if;
 insert into public.analysis_reports(owner_id,evidence_key,model_id,prompt_version,schema_version,consent_revision,status)
 values(auth.uid(),evidence_key,model_id,prompt_version,schema_version,pref.revision,'generating') returning id into result_id;
 return result_id;
end $$;

create or replace function public.finish_training_review_v2(target_id uuid,result_status text,result_report jsonb,result_evidence jsonb,result_model text,attempt_log jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare stored boolean; entry jsonb;
begin
 if auth.uid() is null then raise insufficient_privilege;end if;
 if jsonb_typeof(attempt_log) is distinct from 'array' or jsonb_array_length(attempt_log)>7 or octet_length(attempt_log::text)>8000 then raise exception 'Invalid model attempt metadata.' using errcode='PT400';end if;
 for entry in select value from jsonb_array_elements(attempt_log) loop
  if jsonb_typeof(entry)<>'object' or entry-array['model','thinking','outcome','httpStatus']<>'{}'::jsonb
   or coalesce(entry->>'model','') not in ('gemini-3.8-flash','gemini-3.6-flash','gemini-3.5-flash-lite','gemini-3.1-flash-lite')
   or coalesce(entry->>'thinking','') not in ('high','medium','low','minimal','default')
   or coalesce(entry->>'outcome','') not in ('network','http','invalid','complete') then raise exception 'Invalid model attempt metadata.' using errcode='PT400';end if;
 end loop;
 if result_status='complete' and (result_model is null or result_model not in ('gemini-3.8-flash','gemini-3.6-flash','gemini-3.5-flash-lite','gemini-3.1-flash-lite') or attempt_log->-1->>'model' is distinct from result_model or attempt_log->-1->>'outcome' is distinct from 'complete') then raise exception 'Missing successful model.' using errcode='PT400';end if;
 stored:=public.finish_training_review(target_id,result_status,result_report,result_evidence);
 if stored then update public.analysis_reports set model_id=coalesce(result_model,model_id),model_policy='flash-routes-v2',provider_attempts=attempt_log where owner_id=auth.uid() and id=target_id;end if;
 return stored;
end $$;
revoke all on function public.finish_training_review_v2(uuid,text,jsonb,jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.finish_training_review_v2(uuid,text,jsonb,jsonb,text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
