begin;
create table public.fitness_profiles (
  owner_id uuid primary key references public.fitness_owners(owner_id),
  display_name text not null check(length(display_name) between 1 and 80),
  timezone text not null default 'Australia/Sydney',
  created_at timestamptz not null default now()
);
alter table public.fitness_profiles enable row level security;
revoke all on public.fitness_profiles from public,anon,authenticated;
grant select on public.fitness_profiles to authenticated;
create policy own_profile_read on public.fitness_profiles for select to authenticated using(owner_id=(select auth.uid()));
create table public.activity_feedback (
  owner_id uuid not null, activity_id uuid not null, revision bigint not null check(revision>0),
  id uuid not null default gen_random_uuid(), questionnaire_version text not null default 'run-v1',
  state jsonb not null check(jsonb_typeof(state)='object' and state->>'complete'='true'),
  created_at timestamptz not null default now(), primary key(owner_id,activity_id,revision),
  unique(owner_id,id), foreign key(owner_id,activity_id) references public.activities(owner_id,id)
);
alter table public.activity_feedback enable row level security;
revoke all on public.activity_feedback from public,anon,authenticated;
grant select,insert on public.activity_feedback to authenticated;
create policy own_feedback_read on public.activity_feedback for select to authenticated using(owner_id=(select auth.uid()));
create policy own_feedback_insert on public.activity_feedback for insert to authenticated with check(owner_id=(select auth.uid()) and exists(select 1 from public.fitness_owners where owner_id=(select auth.uid())));
create view public.activity_feedback_latest with(security_invoker=true) as select distinct on(owner_id,activity_id) owner_id,activity_id,revision,state from public.activity_feedback order by owner_id,activity_id,revision desc;
revoke all on public.activity_feedback_latest from public,anon;
grant select on public.activity_feedback_latest to authenticated;
create function public.save_activity_feedback(target_activity uuid,expected_revision bigint,new_state jsonb)
returns bigint language plpgsql security invoker set search_path='' as $$
declare current_revision bigint;
begin
  if auth.uid() is null or not exists(select 1 from public.activities where owner_id=auth.uid() and id=target_activity) then raise insufficient_privilege; end if;
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text||target_activity::text));
  select coalesce(max(revision),0) into current_revision from public.activity_feedback where owner_id=auth.uid() and activity_id=target_activity;
  if current_revision<>expected_revision then raise exception 'Your check-in changed on another device. Reload before saving.' using errcode='PT409'; end if;
  insert into public.activity_feedback(owner_id,activity_id,revision,state) values(auth.uid(),target_activity,current_revision+1,new_state);
  return current_revision+1;
end $$;
revoke all on function public.save_activity_feedback(uuid,bigint,jsonb) from public,anon;
grant execute on function public.save_activity_feedback(uuid,bigint,jsonb) to authenticated;
create table public.screenshot_submissions (
  owner_id uuid not null references public.fitness_owners(owner_id),
  id uuid not null default gen_random_uuid(), batch_id uuid not null,
  provider text not null check(provider in ('nike-run-club','strava')),
  sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
  original_name text not null, object_key text not null, byte_length integer not null check(byte_length>0 and byte_length<=3670016),
  status text not null default 'pending_review' check(status in ('pending_review','reviewed','needs_information')),
  created_at timestamptz not null default now(), primary key(owner_id,id),unique(owner_id,provider,sha256),
  check(split_part(object_key,'/',1)=owner_id::text)
);
alter table public.screenshot_submissions enable row level security;
revoke all on public.screenshot_submissions from public,anon,authenticated;
grant select,insert on public.screenshot_submissions to authenticated;
create policy own_submission_read on public.screenshot_submissions for select to authenticated using(owner_id=(select auth.uid()));
create policy own_submission_insert on public.screenshot_submissions for insert to authenticated with check(owner_id=(select auth.uid()));
commit;
