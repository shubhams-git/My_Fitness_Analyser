-- Personal, immutable running-zone settings. No inferred thresholds or defaults.
begin;
create table public.training_zone_versions(
 owner_id uuid not null references public.fitness_owners(owner_id),
 kind text not null check(kind in ('heart','pace')),revision bigint not null check(revision>0),
 effective_from date not null check(effective_from>='2026-07-01'),
 boundaries jsonb,source text not null check(source in ('garmin','coach','manual')),
 operation_id uuid not null,payload jsonb not null,created_at timestamptz not null default now(),
 primary key(owner_id,kind,revision),unique(owner_id,operation_id),
 check(boundaries is null or jsonb_typeof(boundaries)='array')
);
alter table public.training_zone_versions enable row level security;
revoke all on public.training_zone_versions from public,anon,authenticated;
grant select on public.training_zone_versions to authenticated;
create policy own_zone_read on public.training_zone_versions for select to authenticated using(owner_id=(select auth.uid()));
create function public.save_training_zones(zone_kind text,expected_revision bigint,operation_id uuid,new_value jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid();prior public.training_zone_versions;receipt public.training_zone_versions;
 day date;today date;tz text;bounds jsonb;entry jsonb;previous integer;number integer;
begin
 if who is null or not exists(select 1 from public.fitness_owners where owner_id=who) then raise insufficient_privilege;end if;
 if zone_kind is null or zone_kind not in ('heart','pace') or expected_revision is null or expected_revision<0 or operation_id is null or jsonb_typeof(new_value) is distinct from 'object' then raise exception 'Check your zone settings.' using errcode='PT400';end if;
 perform pg_advisory_xact_lock(hashtext('zones:'||who::text||':'||zone_kind));
 select * into receipt from public.training_zone_versions z where z.owner_id=who and z.operation_id=$3;
 if found then
  if receipt.kind<>zone_kind or receipt.payload<>new_value then raise exception 'This save identifier was already used. Start a new save.' using errcode='PT409';end if;
  return jsonb_build_object('kind',receipt.kind,'revision',receipt.revision);
 end if;
 select * into prior from public.training_zone_versions z where z.owner_id=who and z.kind=zone_kind order by revision desc limit 1;
 if coalesce(prior.revision,0)<>expected_revision then raise exception 'Your settings changed in another tab. Reload settings, then review your entries.' using errcode='PT409';end if;
 if new_value-array['effectiveFrom','boundaries','source']<>'{}'::jsonb or jsonb_typeof(new_value->'effectiveFrom') is distinct from 'string' or coalesce(new_value->>'source','') not in ('garmin','coach','manual') or not(new_value ? 'boundaries') then raise exception 'Check your zone settings.' using errcode='PT400';end if;
 begin day:=(new_value->>'effectiveFrom')::date;exception when invalid_datetime_format or datetime_field_overflow then raise exception 'Choose a valid effective date.' using errcode='PT400';end;
 select timezone into tz from public.fitness_profiles where owner_id=who;
 if tz is null or not exists(select 1 from pg_timezone_names where name=tz) then tz:='Australia/Sydney';end if;
 today:=(now() at time zone tz)::date;
 if day is null or day<'2026-07-01' or day>today or day::text<>new_value->>'effectiveFrom' then raise exception 'Choose a valid date from 1 July 2026 through today.' using errcode='PT400';end if;
 bounds:=nullif(new_value->'boundaries','null'::jsonb);
 if bounds is not null then
  if jsonb_typeof(bounds)<>'array' then raise exception 'Check your zone boundaries.' using errcode='PT400';end if;
  if jsonb_array_length(bounds)<>(case when zone_kind='heart' then 4 else 5 end) then raise exception 'Check your zone boundaries.' using errcode='PT400';end if;
  for entry in select value from jsonb_array_elements(bounds) loop
   if jsonb_typeof(entry)<>'number' or entry::text !~ '^[0-9]{1,4}$' then raise exception 'Enter whole-number zone boundaries.' using errcode='PT400';end if;
   number:=(entry::text)::integer;
   if number<(case when zone_kind='heart' then 40 else 60 end) or number>(case when zone_kind='heart' then 240 else 3600 end) or (previous is not null and (case when zone_kind='heart' then number<=previous else number>=previous end)) then raise exception 'Heart-rate starts must increase; pace starts must get faster.' using errcode='PT400';end if;
   previous:=number;
  end loop;
 end if;
 insert into public.training_zone_versions(owner_id,kind,revision,effective_from,boundaries,source,operation_id,payload) values(who,zone_kind,expected_revision+1,day,bounds,new_value->>'source',$3,new_value);
 return jsonb_build_object('kind',zone_kind,'revision',expected_revision+1);
end $$;
revoke all on function public.save_training_zones(text,bigint,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_training_zones(text,bigint,uuid,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
