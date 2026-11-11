-- Member goals and auditable Gemini fallback results. No default personal targets.
begin;
create table public.training_goal_versions(
 owner_id uuid not null references public.fitness_owners(owner_id),
 kind text not null check(kind in ('weekly-distance','run-time','weight')),revision bigint not null check(revision>0),
 effective_from date not null check(effective_from>='2026-07-01'),
 target numeric,deadline date,distance_m numeric,
 operation_id uuid not null,payload jsonb not null,created_at timestamptz not null default now(),
 primary key(owner_id,kind,revision),unique(owner_id,operation_id)
);
alter table public.training_goal_versions enable row level security;
revoke all on public.training_goal_versions from public,anon,authenticated;
grant select on public.training_goal_versions to authenticated;
create policy own_goal_read on public.training_goal_versions for select to authenticated using(owner_id=(select auth.uid()));
create function public.save_training_goal(goal_kind text,expected_revision bigint,operation_id uuid,new_value jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid();prior public.training_goal_versions;receipt public.training_goal_versions;
 day date;today date;tz text;target_value numeric;due date;distance_value numeric;
begin
 if who is null or not exists(select 1 from public.fitness_owners where owner_id=who) then raise insufficient_privilege;end if;
 if goal_kind is null or goal_kind not in ('weekly-distance','run-time','weight') or expected_revision is null or expected_revision<0 or operation_id is null or jsonb_typeof(new_value) is distinct from 'object' then raise exception 'Check your goal.' using errcode='PT400';end if;
 perform pg_advisory_xact_lock(hashtext('goals:'||who::text||':'||goal_kind));
 select * into receipt from public.training_goal_versions z where z.owner_id=who and z.operation_id=$3;
 if found then
  if receipt.kind<>goal_kind or receipt.payload<>new_value then raise exception 'This save identifier was already used. Start a new save.' using errcode='PT409';end if;
  return jsonb_build_object('kind',receipt.kind,'revision',receipt.revision);
 end if;
 select * into prior from public.training_goal_versions z where z.owner_id=who and z.kind=goal_kind order by revision desc limit 1;
 if coalesce(prior.revision,0)<>expected_revision then raise exception 'Your settings changed in another tab. Reload settings, then review your entries.' using errcode='PT409';end if;
 if new_value-array['effectiveFrom','target','deadline','distanceM']<>'{}'::jsonb or jsonb_typeof(new_value->'effectiveFrom') is distinct from 'string' or not(new_value ?& array['target','deadline','distanceM']) then raise exception 'Check your goal.' using errcode='PT400';end if;
 begin day:=(new_value->>'effectiveFrom')::date;exception when invalid_datetime_format or datetime_field_overflow then raise exception 'Choose a valid effective date.' using errcode='PT400';end;
 select timezone into tz from public.fitness_profiles where owner_id=who;
 if tz is null or not exists(select 1 from pg_timezone_names where name=tz) then tz:='Australia/Sydney';end if;
 today:=(now() at time zone tz)::date;
 if day is null or day<'2026-07-01' or day>today+366 or day::text<>new_value->>'effectiveFrom' then raise exception 'Choose a valid date from 1 July 2026 through next year.' using errcode='PT400';end if;
 if goal_kind='weekly-distance' and extract(isodow from day)<>1 then raise exception 'Weekly goals start on a Monday.' using errcode='PT400';end if;
 if new_value->'target'<>'null'::jsonb then
  if jsonb_typeof(new_value->'target')<>'number' then raise exception 'Enter your target.' using errcode='PT400';end if;
  target_value:=(new_value->>'target')::numeric;
  if target_value<=0 or target_value>(case when goal_kind='weekly-distance' then 500000 when goal_kind='run-time' then 86400 else 1000 end) then raise exception 'Check your target.' using errcode='PT400';end if;
  if goal_kind='weekly-distance' and (target_value<100 or target_value<>trunc(target_value)) or goal_kind='run-time' and (target_value<30 or target_value<>trunc(target_value)) or goal_kind='weight' and target_value*10<>trunc(target_value*10) then raise exception 'Check your target precision.' using errcode='PT400';end if;
  if new_value->'deadline'<>'null'::jsonb then
   if jsonb_typeof(new_value->'deadline')<>'string' then raise exception 'Check your target date.' using errcode='PT400';end if;
   begin due:=(new_value->>'deadline')::date;exception when invalid_datetime_format or datetime_field_overflow then raise exception 'Choose a valid target date.' using errcode='PT400';end;
   if due<day or due>day+1826 or due::text<>new_value->>'deadline' or goal_kind='weekly-distance' then raise exception 'Check your target date.' using errcode='PT400';end if;
  end if;
  if goal_kind='run-time' then
   if jsonb_typeof(new_value->'distanceM')<>'number' then raise exception 'Choose a benchmark distance.' using errcode='PT400';end if;
   distance_value:=(new_value->>'distanceM')::numeric;
   if distance_value not in (1000,5000,10000,21097.5,42195) then raise exception 'Choose a benchmark distance.' using errcode='PT400';end if;
  elsif new_value->'distanceM'<>'null'::jsonb then raise exception 'Check your goal distance.' using errcode='PT400';end if;
 elsif new_value->'deadline'<>'null'::jsonb or new_value->'distanceM'<>'null'::jsonb then raise exception 'Check your paused goal.' using errcode='PT400';
 end if;
 insert into public.training_goal_versions(owner_id,kind,revision,effective_from,target,deadline,distance_m,operation_id,payload) values(who,goal_kind,expected_revision+1,day,target_value,due,distance_value,$3,new_value);
 return jsonb_build_object('kind',goal_kind,'revision',expected_revision+1);
end $$;
revoke all on function public.save_training_goal(text,bigint,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_training_goal(text,bigint,uuid,jsonb) to authenticated;

-- Keep the actual successful model and bounded diagnostic metadata.
alter table public.analysis_reports add column model_policy text, add column provider_attempts jsonb not null default '[]'::jsonb check(jsonb_typeof(provider_attempts)='array');
alter table public.weight_analysis_reports add column model_policy text, add column provider_attempts jsonb not null default '[]'::jsonb check(jsonb_typeof(provider_attempts)='array');
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
 if exists(select 1 from public.analysis_reports where owner_id=auth.uid() and created_at>now()-interval '1 minute') or (select count(*) from public.analysis_reports where owner_id=auth.uid() and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=3 then raise exception 'Review limit reached. Try later.' using errcode='PT429'; end if;
 insert into public.analysis_reports(owner_id,evidence_key,model_id,prompt_version,schema_version,consent_revision,status)
 values(auth.uid(),evidence_key,model_id,prompt_version,schema_version,pref.revision,'generating') returning id into result_id;
 return result_id;
end $$;

create function public.finish_training_review_v2(target_id uuid,result_status text,result_report jsonb,result_evidence jsonb,result_model text,attempt_log jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare stored boolean; entry jsonb;
begin
 if auth.uid() is null then raise insufficient_privilege;end if;
 if jsonb_typeof(attempt_log) is distinct from 'array' or jsonb_array_length(attempt_log)>4 or octet_length(attempt_log::text)>8000 then raise exception 'Invalid model attempt metadata.' using errcode='PT400';end if;
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
create or replace function public.begin_weight_review(evidence_key text,model_id text,prompt_version text,schema_version text) returns uuid
language plpgsql security definer set search_path='' as $$
declare pref public.weight_ai_preferences; result_id uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.fitness_owners where owner_id=auth.uid()) then raise insufficient_privilege; end if;
 perform pg_advisory_xact_lock(hashtext('weight-ai:'||auth.uid()::text));
 select * into pref from public.weight_ai_preferences where owner_id=auth.uid();
 if pref.enabled is distinct from true or pref.disclosure_version<>'gemini-weight-v1' then raise insufficient_privilege; end if;
 if evidence_key !~ '^[0-9a-f]{64}$' or model_id not in('gemini-3.8-flash','gemini-3.7-flash','gemini-3.6-flash') or length(prompt_version)>80 or length(schema_version)>80 then raise exception 'Invalid analysis request.'; end if;
 if exists(select 1 from public.weight_analysis_reports where owner_id=auth.uid() and status='generating' and created_at>now()-interval '6 minutes') then raise exception 'A review is already running.' using errcode='PT409'; end if;
 if exists(select 1 from public.weight_analysis_reports where owner_id=auth.uid() and created_at>now()-interval '1 minute') or (select count(*) from public.weight_analysis_reports where owner_id=auth.uid() and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=3 then raise exception 'Review limit reached. Try later.' using errcode='PT429'; end if;
 insert into public.weight_analysis_reports(owner_id,evidence_key,model_id,prompt_version,schema_version,consent_revision,status)
 values(auth.uid(),evidence_key,model_id,prompt_version,schema_version,pref.revision,'generating') returning id into result_id;
 return result_id;
end $$;

create function public.finish_weight_review_v2(target_id uuid,result_status text,result_report jsonb,result_evidence jsonb,result_model text,attempt_log jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare stored boolean; entry jsonb;
begin
 if auth.uid() is null then raise insufficient_privilege;end if;
 if jsonb_typeof(attempt_log) is distinct from 'array' or jsonb_array_length(attempt_log)>4 or octet_length(attempt_log::text)>8000 then raise exception 'Invalid model attempt metadata.' using errcode='PT400';end if;
 for entry in select value from jsonb_array_elements(attempt_log) loop
  if jsonb_typeof(entry)<>'object' or entry-array['model','thinking','outcome','httpStatus']<>'{}'::jsonb
   or coalesce(entry->>'model','') not in ('gemini-3.8-flash','gemini-3.6-flash','gemini-3.5-flash-lite','gemini-3.1-flash-lite')
   or coalesce(entry->>'thinking','') not in ('high','medium','low','minimal','default')
   or coalesce(entry->>'outcome','') not in ('network','http','invalid','complete') then raise exception 'Invalid model attempt metadata.' using errcode='PT400';end if;
 end loop;
 if result_status='complete' and (result_model is null or result_model not in ('gemini-3.8-flash','gemini-3.6-flash','gemini-3.5-flash-lite','gemini-3.1-flash-lite') or attempt_log->-1->>'model' is distinct from result_model or attempt_log->-1->>'outcome' is distinct from 'complete') then raise exception 'Missing successful model.' using errcode='PT400';end if;
 stored:=public.finish_weight_review(target_id,result_status,result_report,result_evidence);
 if stored then update public.weight_analysis_reports set model_id=coalesce(result_model,model_id),model_policy='flash-routes-v2',provider_attempts=attempt_log where owner_id=auth.uid() and id=target_id;end if;
 return stored;
end $$;
revoke all on function public.finish_weight_review_v2(uuid,text,jsonb,jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.finish_weight_review_v2(uuid,text,jsonb,jsonb,text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
