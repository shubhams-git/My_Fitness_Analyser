begin;

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
 insert into public.weight_analysis_reports(owner_id,evidence_key,model_id,prompt_version,schema_version,consent_revision,status)
 values(auth.uid(),evidence_key,model_id,prompt_version,schema_version,pref.revision,'generating') returning id into result_id;
 return result_id;
end $$;

create or replace function public.take_gemini_budget(key_ids text[], target_model text, enforce_training_limits boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare budget public.gemini_request_budget; slot integer; retry timestamptz; quota_today date := (now() at time zone 'America/Los_Angeles')::date;
begin
 if coalesce(array_ndims(key_ids),0)<>1 or array_lower(key_ids,1)<>1 or cardinality(key_ids) not between 1 and 5
 or exists(select 1 from unnest(key_ids) id where id is null or id !~ '^[a-f0-9]{64}$')
 or (select count(distinct id) from unnest(key_ids) id)<>cardinality(key_ids) then raise insufficient_privilege; end if;
 select * into strict budget from public.gemini_request_budget where singleton for update;
 select until_at into retry from public.gemini_model_backoff where model=target_model and until_at>now();
 if retry is not null then return jsonb_build_object('modelBlocked',true,'retryAt',retry); end if;
 if enforce_training_limits and budget.quota_day=quota_today and budget.used>=20 then
  return jsonb_build_object('retryAt',(quota_today+1)::timestamp at time zone 'America/Los_Angeles');
 end if;
 if enforce_training_limits and budget.next_request_at>now() then return jsonb_build_object('retryAt',budget.next_request_at); end if;
 slot:=coalesce(array_position(key_ids,budget.last_key_id),0)%cardinality(key_ids)+1;
 update public.gemini_request_budget set last_key_id=key_ids[slot],next_request_at=now()+interval '65 seconds',
  quota_day=quota_today,used=case when quota_day=quota_today then used+1 else 1 end where singleton;
 return jsonb_build_object('slot',slot);
end $$;

create or replace function public.take_gemini_budget(key_ids text[], target_model text) returns jsonb
language sql security definer set search_path='' as $$
 select public.take_gemini_budget(key_ids,target_model,true);
$$;

create or replace function public.reserve_weight_gemini(target_id uuid, key_ids text[], target_model text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner uuid:=auth.uid(); budget jsonb;
begin
 if owner is null or target_model is distinct from 'gemini-3.6-flash' then raise insufficient_privilege; end if;
 perform pg_advisory_xact_lock(hashtext('weight-ai:'||owner::text));
 if not exists(select 1 from public.weight_analysis_reports r join public.weight_ai_preferences p using(owner_id)
  where r.id=target_id and r.owner_id=owner and r.status='generating' and r.gemini_reserved_at is null and r.created_at>now()-interval '6 minutes' and p.enabled and p.revision=r.consent_revision) then raise insufficient_privilege; end if;
 budget:=public.take_gemini_budget(key_ids,target_model,false);
 if budget ? 'slot' then update public.weight_analysis_reports set gemini_reserved_at=now() where owner_id=owner and id=target_id; end if;
 return budget;
end $$;

revoke all on function public.take_gemini_budget(text[],text,boolean) from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
