begin;
create table public.ai_preferences (
 owner_id uuid primary key references public.fitness_owners(owner_id),
 enabled boolean not null, disclosure_version text not null,
 revision bigint not null default 1, updated_at timestamptz not null default now()
);
create table public.ai_consent_events (
 owner_id uuid not null references public.fitness_owners(owner_id),
 revision bigint not null, enabled boolean not null, disclosure_version text not null,
 created_at timestamptz not null default now(), primary key(owner_id,revision)
);
create table public.analysis_reports (
 owner_id uuid not null references public.fitness_owners(owner_id),
 id uuid not null default gen_random_uuid(), evidence_key text not null,
 model_id text not null, prompt_version text not null, schema_version text not null,
 consent_revision bigint not null, status text not null check(status in('generating','complete','failed','cancelled')),
 report jsonb, evidence jsonb, created_at timestamptz not null default now(), finished_at timestamptz,
 primary key(owner_id,id)
);
create index analysis_report_lookup on public.analysis_reports(owner_id,evidence_key,created_at desc);
alter table public.ai_preferences enable row level security;
alter table public.ai_consent_events enable row level security;
alter table public.analysis_reports enable row level security;
revoke all on public.ai_preferences,public.ai_consent_events,public.analysis_reports from public,anon,authenticated;
grant select on public.ai_preferences,public.ai_consent_events,public.analysis_reports to authenticated;
create policy own_ai_preference on public.ai_preferences for select to authenticated using(owner_id=(select auth.uid()));
create policy own_ai_consent on public.ai_consent_events for select to authenticated using(owner_id=(select auth.uid()));
create policy own_ai_report on public.analysis_reports for select to authenticated using(owner_id=(select auth.uid()));

create function public.set_ai_preference(allow_analysis boolean,disclosure text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare saved public.ai_preferences;
begin
 if auth.uid() is null or not exists(select 1 from public.fitness_owners where owner_id=auth.uid()) then raise insufficient_privilege; end if;
 if disclosure<>'gemini-run-v1' then raise exception 'Review the current sharing notice.' using errcode='PT409'; end if;
 perform pg_advisory_xact_lock(hashtext('ai:'||auth.uid()::text));
 insert into public.ai_preferences(owner_id,enabled,disclosure_version) values(auth.uid(),allow_analysis,disclosure)
 on conflict(owner_id) do update set enabled=excluded.enabled,disclosure_version=excluded.disclosure_version,revision=ai_preferences.revision+1,updated_at=now()
 returning * into saved;
 insert into public.ai_consent_events(owner_id,revision,enabled,disclosure_version) values(saved.owner_id,saved.revision,saved.enabled,saved.disclosure_version);
 if not allow_analysis then update public.analysis_reports set status='cancelled',finished_at=now(),report=null,evidence=null where owner_id=auth.uid() and status='generating'; end if;
 return jsonb_build_object('enabled',saved.enabled,'revision',saved.revision,'disclosureVersion',saved.disclosure_version,'updatedAt',saved.updated_at);
end $$;

create function public.begin_training_review(evidence_key text,model_id text,prompt_version text,schema_version text) returns uuid
language plpgsql security definer set search_path='' as $$
declare pref public.ai_preferences; result_id uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.fitness_owners where owner_id=auth.uid()) then raise insufficient_privilege; end if;
 perform pg_advisory_xact_lock(hashtext('ai:'||auth.uid()::text));
 select * into pref from public.ai_preferences where owner_id=auth.uid();
 if pref.enabled is distinct from true or pref.disclosure_version<>'gemini-run-v1' then raise insufficient_privilege; end if;
 if evidence_key !~ '^[0-9a-f]{64}$' or model_id not in('gemini-3.8-flash','gemini-3.7-flash','gemini-3.6-flash') or length(prompt_version)>80 or length(schema_version)>80 then raise exception 'Invalid analysis request.'; end if;
 if exists(select 1 from public.analysis_reports where owner_id=auth.uid() and status='generating' and created_at>now()-interval '3 minutes') then raise exception 'A review is already running.' using errcode='PT409'; end if;
 if exists(select 1 from public.analysis_reports where owner_id=auth.uid() and created_at>now()-interval '1 minute') or (select count(*) from public.analysis_reports where owner_id=auth.uid() and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=3 then raise exception 'Review limit reached. Try later.' using errcode='PT429'; end if;
 insert into public.analysis_reports(owner_id,evidence_key,model_id,prompt_version,schema_version,consent_revision,status)
 values(auth.uid(),evidence_key,model_id,prompt_version,schema_version,pref.revision,'generating') returning id into result_id;
 return result_id;
end $$;

create function public.finish_training_review(target_id uuid,result_status text,result_report jsonb,result_evidence jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare pref public.ai_preferences; attempt public.analysis_reports;
begin
 if auth.uid() is null then raise insufficient_privilege; end if;
 perform pg_advisory_xact_lock(hashtext('ai:'||auth.uid()::text));
 select * into pref from public.ai_preferences where owner_id=auth.uid();
 select * into attempt from public.analysis_reports where owner_id=auth.uid() and id=target_id;
 if attempt.id is null then raise insufficient_privilege; end if;
 if attempt.status<>'generating' then return false; end if;
 if pref.enabled is distinct from true or pref.revision<>attempt.consent_revision then
 update public.analysis_reports set status='cancelled',finished_at=now() where owner_id=auth.uid() and id=target_id;return false;end if;
 if result_status not in('complete','failed') then raise exception 'Invalid review result.'; end if;
 if result_status='complete' and (jsonb_typeof(result_report) is distinct from 'object' or jsonb_typeof(result_evidence) is distinct from 'object' or octet_length(result_report::text)>64000 or octet_length(result_evidence::text)>256000) then raise exception 'Missing or oversized report.';end if;
 update public.analysis_reports set status=result_status,report=case when result_status='complete' then result_report end,evidence=case when result_status='complete' then result_evidence end,finished_at=now() where owner_id=auth.uid() and id=target_id;
 return true;
end $$;
revoke all on function public.set_ai_preference(boolean,text),public.begin_training_review(text,text,text,text),public.finish_training_review(uuid,text,jsonb,jsonb) from public,anon;
grant execute on function public.set_ai_preference(boolean,text),public.begin_training_review(text,text,text,text),public.finish_training_review(uuid,text,jsonb,jsonb) to authenticated;
commit;
