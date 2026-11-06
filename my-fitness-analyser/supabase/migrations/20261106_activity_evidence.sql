-- Additive v2 evidence slice. No personal values or credentials in this file.
-- Existing v1 library remains intact. The UI cutover is a separate increment.
begin;
create table public.source_accounts (
  owner_id uuid not null references public.fitness_owners(owner_id),
  id uuid not null, provider text not null, account_key text not null,
  capabilities jsonb not null default '{}', created_at timestamptz not null default now(),
  primary key(owner_id,id), unique(owner_id,provider,account_key)
);
create table public.raw_assets (
  owner_id uuid not null references public.fitness_owners(owner_id), id uuid not null,
  sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
  bucket_id text not null default 'fitness-private' check(bucket_id='fitness-private'),
  object_key text not null, media_type text not null, byte_length bigint not null check(byte_length>0),
  md5 text not null check(md5 ~ '^[0-9a-f]{32}$'),
  verification text not null check(verification='storage-size-and-etag'),
  metadata jsonb not null default '{}', created_at timestamptz not null default now(),
  primary key(owner_id,id), unique(owner_id,sha256), unique(bucket_id,object_key),
  check(split_part(object_key,'/',1)=owner_id::text)
);
create table public.ingestion_runs (
  owner_id uuid not null, id uuid not null, source_account_id uuid not null,
  adapter_version text not null, manifest_sha256 text not null, manifest_asset_id uuid not null,
  status text not null check(status in ('staged','committed','partial','failed')),
  scope jsonb not null, reconciliation jsonb not null, created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key(owner_id,id), unique(owner_id,source_account_id,manifest_sha256),
  foreign key(owner_id,source_account_id) references public.source_accounts(owner_id,id),
  foreign key(owner_id,manifest_asset_id) references public.raw_assets(owner_id,id)
);
create table public.activities (
  owner_id uuid not null references public.fitness_owners(owner_id), id uuid not null,
  sport text not null, title text not null, local_date date not null,
  start_instant timestamptz, local_start time, local_end time,
  time_precision text not null check(time_precision in ('date','minute','second','instant')),
  timezone_name text, timezone_evidence text,
  distance_m numeric check(distance_m>=0), running_s numeric check(running_s>=0),
  elapsed_s numeric check(elapsed_s>=0), timer_s numeric check(timer_s>=0), moving_s numeric check(moving_s>=0),
  average_pace_s_per_km numeric check(average_pace_s_per_km>0),
  fastest_pace_s_per_km numeric check(fastest_pace_s_per_km>0),
  average_hr_bpm numeric check(average_hr_bpm>0), max_hr_bpm numeric check(max_hr_bpm>0),
  average_cadence_spm numeric check(average_cadence_spm>0), calories_kcal numeric check(calories_kcal>=0),
  elevation_gain_m numeric check(elevation_gain_m>=0), elevation_loss_m numeric check(elevation_loss_m>=0),
  selected_source_id uuid not null, revision bigint not null default 1 check(revision>0),
  legacy_aliases jsonb not null default '[]', coverage jsonb not null, quality_flags jsonb not null default '[]',
  created_at timestamptz not null default now(), primary key(owner_id,id),
  check(local_date >= date '2026-07-01'),
  check(time_precision<>'date' or (local_start is null and start_instant is null)),
  check(time_precision<>'minute' or (local_start is not null and extract(second from local_start)=0)),
  check(elapsed_s is null or running_s is null or elapsed_s>=running_s)
);
create table public.activity_sources (
  owner_id uuid not null, id uuid not null, activity_id uuid not null, source_account_id uuid not null,
  entity_key text not null, revision_sha256 text not null check(revision_sha256 ~ '^[0-9a-f]{64}$'),
  ingestion_run_id uuid not null, adapter_version text not null,
  source_values jsonb not null, field_evidence jsonb not null, review jsonb not null,
  supersedes_id uuid, created_at timestamptz not null default now(),
  primary key(owner_id,id), unique(owner_id,activity_id,id),
  unique(owner_id,source_account_id,entity_key,revision_sha256),
  foreign key(owner_id,activity_id) references public.activities(owner_id,id) deferrable initially deferred,
  foreign key(owner_id,source_account_id) references public.source_accounts(owner_id,id),
  foreign key(owner_id,ingestion_run_id) references public.ingestion_runs(owner_id,id),
  foreign key(owner_id,supersedes_id) references public.activity_sources(owner_id,id)
);
alter table public.activities add foreign key(owner_id,id,selected_source_id)
  references public.activity_sources(owner_id,activity_id,id) deferrable initially deferred;
create table public.activity_source_assets (
  owner_id uuid not null, source_id uuid not null, asset_id uuid not null, evidence_role text not null,
  primary key(owner_id,source_id,asset_id),
  foreign key(owner_id,source_id) references public.activity_sources(owner_id,id),
  foreign key(owner_id,asset_id) references public.raw_assets(owner_id,id)
);
create table public.activity_segments (
  owner_id uuid not null, id uuid not null, activity_id uuid not null, source_id uuid not null,
  kind text not null, sequence integer not null check(sequence>0),
  distance_m numeric check(distance_m>0), distance_precision_m numeric check(distance_precision_m>0),
  duration_s numeric check(duration_s>0), pace_s_per_km numeric check(pace_s_per_km>0),
  pace_delta_s_per_km numeric, elevation_net_m numeric, source_values jsonb not null,
  primary key(owner_id,id), unique(owner_id,source_id,kind,sequence),
  foreign key(owner_id,activity_id,source_id) references public.activity_sources(owner_id,activity_id,id)
);
create table public.ingestion_items (
  owner_id uuid not null, id uuid not null, ingestion_run_id uuid not null,
  entity_key text not null, source_revision_id uuid not null, domain text not null,
  outcome text not null check(outcome in ('committed','overview_only')),
  attempts integer not null default 1 check(attempts>0), details jsonb not null,
  primary key(owner_id,id), unique(owner_id,ingestion_run_id,entity_key),
  foreign key(owner_id,ingestion_run_id) references public.ingestion_runs(owner_id,id),
  foreign key(owner_id,source_revision_id) references public.activity_sources(owner_id,id)
);
create table public.record_changes (
  owner_id uuid not null, id uuid not null, activity_id uuid not null, source_id uuid not null,
  action text not null, actor text not null, details jsonb not null,
  created_at timestamptz not null default now(), primary key(owner_id,id),
  foreign key(owner_id,activity_id,source_id) references public.activity_sources(owner_id,activity_id,id)
);
create index activities_calendar on public.activities(owner_id,local_date desc,id);
create index activities_sport_calendar on public.activities(owner_id,sport,local_date desc,id);
create index source_assets_asset on public.activity_source_assets(owner_id,asset_id);
create index ingestion_items_run on public.ingestion_items(owner_id,ingestion_run_id,outcome);

-- Owner may read the evidence slice. Publication remains an administrative,
-- reviewed transaction; no anonymous endpoint or broad client write grant.
do $$ declare relation text; begin
  foreach relation in array array['source_accounts','raw_assets','ingestion_runs','activities',
    'activity_sources','activity_source_assets','activity_segments','ingestion_items','record_changes'] loop
    execute format('alter table public.%I enable row level security',relation);
    execute format('revoke all on public.%I from public,anon,authenticated',relation);
    execute format('grant select on public.%I to authenticated',relation);
    execute format('create policy owner_evidence_read on public.%I for select to authenticated using(owner_id=(select auth.uid()) and exists(select 1 from public.fitness_owners where owner_id=(select auth.uid())))',relation);
  end loop;
end $$;
commit;
