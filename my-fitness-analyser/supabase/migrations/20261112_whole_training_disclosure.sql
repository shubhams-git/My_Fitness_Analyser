begin;
create or replace function public.set_ai_preference(allow_analysis boolean,disclosure text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare saved public.ai_preferences;
begin
 if auth.uid() is null or not exists(select 1 from public.fitness_owners where owner_id=auth.uid()) then raise insufficient_privilege; end if;
 if disclosure is null or disclosure not in ('gemini-run-v1','gemini-training-v2') then raise exception 'Review the current sharing notice.' using errcode='PT409'; end if;
 perform pg_advisory_xact_lock(hashtext('ai:'||auth.uid()::text));
 insert into public.ai_preferences(owner_id,enabled,disclosure_version) values(auth.uid(),allow_analysis,disclosure)
 on conflict(owner_id) do update set enabled=excluded.enabled,disclosure_version=excluded.disclosure_version,revision=ai_preferences.revision+1,updated_at=now()
 returning * into saved;
 insert into public.ai_consent_events(owner_id,revision,enabled,disclosure_version) values(saved.owner_id,saved.revision,saved.enabled,saved.disclosure_version);
 if not allow_analysis then update public.analysis_reports set status='cancelled',finished_at=now(),report=null,evidence=null where owner_id=auth.uid() and status='generating'; end if;
 return jsonb_build_object('enabled',saved.enabled,'revision',saved.revision,'disclosureVersion',saved.disclosure_version,'updatedAt',saved.updated_at);
end $$;

create or replace function public.begin_training_review(evidence_key text,model_id text,prompt_version text,schema_version text) returns uuid
language plpgsql security definer set search_path='' as $$
declare pref public.ai_preferences; result_id uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.fitness_owners where owner_id=auth.uid()) then raise insufficient_privilege; end if;
 perform pg_advisory_xact_lock(hashtext('ai:'||auth.uid()::text));
 select * into pref from public.ai_preferences where owner_id=auth.uid();
 if pref.enabled is distinct from true or pref.disclosure_version not in ('gemini-run-v1','gemini-training-v2') then raise insufficient_privilege; end if;
 if evidence_key !~ '^[0-9a-f]{64}$' or model_id not in('gemini-3.8-flash','gemini-3.7-flash','gemini-3.6-flash') or length(prompt_version)>80 or length(schema_version)>80 then raise exception 'Invalid analysis request.'; end if;
 if exists(select 1 from public.analysis_reports where owner_id=auth.uid() and status='generating' and created_at>now()-interval '6 minutes') then raise exception 'A review is already running.' using errcode='PT409'; end if;
 if exists(select 1 from public.analysis_reports where owner_id=auth.uid() and created_at>now()-interval '30 seconds') then
  raise exception 'Review cooldown.' using errcode='PT429';
 end if;
 insert into public.analysis_reports(owner_id,evidence_key,model_id,prompt_version,schema_version,consent_revision,status)
 values(auth.uid(),evidence_key,model_id,prompt_version,schema_version,pref.revision,'generating') returning id into result_id;
 return result_id;
end $$;

notify pgrst,'reload schema';
commit;
