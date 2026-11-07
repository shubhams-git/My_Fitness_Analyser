-- Additive manual sessions. Imported MASS rows keep their original identities.
begin;
create table public.strength_entries (
 owner_id uuid not null references public.fitness_owners(owner_id), id uuid not null,
 revision bigint not null check(revision>0), date_key date not null, deleted boolean not null,
 data jsonb not null check(jsonb_typeof(data)='object'), created_at timestamptz not null default now(),
 primary key(owner_id,id,revision)
);
alter table public.strength_entries enable row level security;
revoke all on public.strength_entries from public,anon,authenticated;
grant select on public.strength_entries to authenticated;
create policy own_strength_read on public.strength_entries for select to authenticated using(owner_id=(select auth.uid()));
create view public.strength_entries_latest with(security_invoker=true) as
 select distinct on(owner_id,id) * from public.strength_entries order by owner_id,id,revision desc;
revoke all on public.strength_entries_latest from public,anon,authenticated;
grant select on public.strength_entries_latest to authenticated;

create or replace function public.journal_snapshot() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
  'revision',coalesce((select revision from public.journal_heads where owner_id=auth.uid()),0),
  'timezone',coalesce((select timezone from public.fitness_profiles where owner_id=auth.uid()),'Australia/Sydney'),
  'weights',coalesce((select jsonb_agg(to_jsonb(w)) from public.body_measurements_latest w where owner_id=auth.uid()),'[]'::jsonb),
  'sessions',coalesce((select jsonb_agg(to_jsonb(s)) from public.journal_sessions_latest s where owner_id=auth.uid()),'[]'::jsonb),
  'manualSessions',coalesce((select jsonb_agg(to_jsonb(s)) from public.strength_entries_latest s where owner_id=auth.uid()),'[]'::jsonb),
  'imports',coalesce((select jsonb_agg(to_jsonb(i)-'counts') from public.journal_imports i where owner_id=auth.uid()),'[]'::jsonb)
 );
$$;

create function public.save_strength_entry(target_id uuid,expected_revision bigint,expected_head bigint,operation_id uuid,new_value jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); prior public.strength_entries; receipt public.journal_mutations;
 head bigint; payload jsonb; result jsonb; day date; zone text; checkin jsonb; mins numeric; value jsonb;
begin
 if who is null or not exists(select 1 from public.fitness_owners where owner_id=who) then raise insufficient_privilege;end if;
 if target_id is null or operation_id is null or expected_revision is null or expected_revision<0 or expected_head is null or expected_head<0 or jsonb_typeof(new_value) is distinct from 'object' then raise exception 'Check the session details.' using errcode='PT400';end if;
 perform pg_advisory_xact_lock(hashtext('journal:'||who::text));
 payload:=jsonb_build_object('kind','strength','id',target_id,'revision',expected_revision,'head',expected_head,'value',new_value);
 select * into receipt from public.journal_mutations m where m.owner_id=who and m.operation_id=$4;
 if found then
  if receipt.payload<>payload then raise exception 'This save identifier was already used. Start a new save.' using errcode='PT409';end if;
  return receipt.result;
 end if;
 insert into public.journal_heads(owner_id) values(who) on conflict do nothing;
 select revision into head from public.journal_heads where owner_id=who for update;
 select * into prior from public.strength_entries where owner_id=who and id=target_id order by revision desc limit 1;
 if coalesce(prior.revision,0)<>expected_revision or head<>expected_head then raise exception 'Your journal changed. Refresh it before saving.' using errcode='PT409';end if;
 if new_value - array['dateKey','focus','mins','note','deleted','confirmSeparate','checkin']<>'{}'::jsonb
  or jsonb_typeof(new_value->'dateKey') is distinct from 'string' or jsonb_typeof(new_value->'focus') is distinct from 'string'
  or jsonb_typeof(new_value->'note') is distinct from 'string' or jsonb_typeof(new_value->'deleted') is distinct from 'boolean'
  or jsonb_typeof(new_value->'confirmSeparate') is distinct from 'boolean' then raise exception 'Check the session details.' using errcode='PT400';end if;
 if jsonb_typeof(new_value->'mins') is null or jsonb_typeof(new_value->'mins') not in ('number','null') then raise exception 'Check the session details.' using errcode='PT400';end if;
 day:=(new_value->>'dateKey')::date;mins:=(new_value->>'mins')::numeric;checkin:=new_value->'checkin';
 select timezone into zone from public.fitness_profiles where owner_id=who;
 if zone is null or not exists(select 1 from pg_timezone_names where name=zone) then zone:='Australia/Sydney';end if;
 if day is null or day<'2026-07-01' or day>(now() at time zone zone)::date
  or new_value->>'focus' not in ('Push','Pull','Legs','Upper body','Lower body','Full body','Strength')
  or (mins is not null and (mins<1 or mins>1440 or mins<>trunc(mins))) or length(new_value->>'note')>2000 then raise exception 'Check the session details.' using errcode='PT400';end if;
 if checkin is null then raise exception 'Check the session check-in.' using errcode='PT400';end if;
 if checkin<>'null'::jsonb then
  if jsonb_typeof(checkin)<>'object' or checkin-array['completion','effort','legFatigue','discomfort','location']<>'{}'::jsonb
   or coalesce(checkin->>'completion','') not in ('planned','modified','cut-short')
   or jsonb_typeof(checkin->'effort') is distinct from 'number' or (checkin->>'effort')::numeric not between 1 and 10
   or (checkin->>'effort')::numeric<>trunc((checkin->>'effort')::numeric)
   or coalesce(checkin->>'legFatigue','') not in ('fresh','noticeable','heavy')
   or coalesce(checkin->>'discomfort','') not in ('none','mild','affected')
   or jsonb_typeof(checkin->'location') is distinct from 'string' or length(checkin->>'location')>200
   or (checkin->>'discomfort'<>'none' and length(btrim(checkin->>'location'))=0)
   or (checkin->>'discomfort'='none' and checkin->>'location'<>'') then raise exception 'Check the session check-in.' using errcode='PT400';end if;
 end if;
 if (new_value->>'deleted')::boolean and prior.id is null then raise exception 'This session does not exist.' using errcode='PT400';end if;
 if not (new_value->>'deleted')::boolean and not (new_value->>'confirmSeparate')::boolean and (
  exists(select 1 from public.journal_sessions_latest s where s.owner_id=who and s.date_key=day and not s.deleted)
  or exists(select 1 from public.strength_entries_latest s where s.owner_id=who and s.date_key=day and not s.deleted and s.id<>target_id)
 ) then raise exception 'A session is already recorded on this date. Confirm this is a separate workout.' using errcode='PT409';end if;
 value:=new_value-'confirmSeparate';
 insert into public.strength_entries(owner_id,id,revision,date_key,deleted,data) values(who,target_id,expected_revision+1,day,(value->>'deleted')::boolean,value);
 update public.journal_heads set revision=head+1 where owner_id=who;
 result:=jsonb_build_object('id',target_id,'revision',expected_revision+1,'head',head+1);
 insert into public.journal_mutations values(who,$4,payload,result,now());return result;
end $$;
revoke all on function public.save_strength_entry(uuid,bigint,bigint,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_strength_entry(uuid,bigint,bigint,uuid,jsonb) to authenticated;
create or replace function public.commit_mass_journal(expected_head bigint,source_hash text,object_key text,byte_length bigint,exported_at timestamptz,incoming jsonb,confirm_same_day boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
<<mass_commit>>
declare who uuid:=auth.uid(); head bigint; row jsonb; kind text; old jsonb; old_rev bigint; old_source bigint; rev bigint;
 counts jsonb:='{}'; counter jsonb; field text; rows jsonb; day date; duplicate public.journal_imports;
begin
 if who is null or not exists(select 1 from public.fitness_owners where owner_id=who) then raise insufficient_privilege; end if;
 if source_hash !~ '^[a-f0-9]{64}$' or object_key<>who::text||'/journal/'||source_hash||'.json' or byte_length not between 1 and 3670016 or exported_at is null or expected_head<0 or jsonb_typeof(incoming->'weights')<>'array' or jsonb_typeof(incoming->'sessions')<>'array' or jsonb_array_length(incoming->'weights')+jsonb_array_length(incoming->'sessions')>10000 then raise exception 'Invalid MASS import.' using errcode='PT400';end if;
 perform pg_advisory_xact_lock(hashtext('journal:'||who::text));
 select * into duplicate from public.journal_imports i where i.owner_id=who and i.sha256=source_hash;
 if found then return jsonb_build_object('duplicate',true,'counts',duplicate.counts);end if;
 insert into public.journal_heads(owner_id) values(who) on conflict do nothing;
 select revision into head from public.journal_heads where owner_id=who for update;
 if head<>expected_head then raise exception 'Your journal changed. Review this file again before importing.' using errcode='PT409';end if;
 if not coalesce(confirm_same_day,false) and exists(
  select 1 from jsonb_array_elements(incoming->'weights') r join public.body_measurements_latest b
  on b.owner_id=who and b.source='manual' and not b.deleted and b.date_key=(r->>'dateKey')::date
  where r->>'deletedAt' is null
 ) then raise exception 'There is already a reading on this date. Review the import and confirm separate readings.' using errcode='PT409';end if;
 if not coalesce(confirm_same_day,false) and exists(
  select 1 from jsonb_array_elements(incoming->'sessions') r join public.strength_entries_latest s
  on s.owner_id=who and s.date_key=(r->>'dateKey')::date and not s.deleted where r->>'deletedAt' is null
 ) then raise exception 'A session is already recorded on this date. Review the import and confirm separate workouts.' using errcode='PT409';end if;
 insert into public.journal_imports(owner_id,sha256,object_key,byte_length,exported_at,counts) values(who,source_hash,$3,$4,$5,'{}');
 foreach kind in array array['weights','sessions'] loop
  counter:='{"added":0,"updated":0,"deleted":0,"unchanged":0,"older":0,"excluded":0}';
  for row in select value-'sourceHash' from jsonb_array_elements(incoming->kind) loop
   if jsonb_typeof(row)<>'object' or length(row->>'id') not between 1 and 200 then raise exception 'Invalid MASS row.' using errcode='PT400';end if;
   old:=null;old_rev:=null;old_source:=null;
   if kind='weights' then select data,revision,source_version into old,old_rev,old_source from public.body_measurements where owner_id=who and source='mass' and entry_key=row->>'id' order by revision desc limit 1;
   else select data,revision,source_version into old,old_rev,old_source from public.journal_sessions where owner_id=who and entry_key=row->>'id' order by revision desc limit 1;end if;
   rev:=greatest((row->>'updatedAt')::bigint,(row->>'deletedAt')::bigint);day:=(row->>'dateKey')::date;
   if old_source is not null and rev<old_source then field:='older';
   elsif old_source is not null and rev=old_source then
    if old<>row then raise exception 'A MASS row conflicts at the same update time.' using errcode='PT409';end if;field:='unchanged';
   elsif old_rev is null and day<'2026-07-01' then field:='excluded';
   else
    if kind='weights' then
     insert into public.body_measurements(owner_id,source,entry_key,revision,date_key,weight_kg,deleted,source_version,data,import_sha256)
     values(who,'mass',row->>'id',coalesce(old_rev,0)+1,day,(row->>'kg')::numeric,row->>'deletedAt' is not null,rev,row,source_hash);
    else
     insert into public.journal_sessions(owner_id,entry_key,revision,date_key,focus,minutes,deleted,source_version,data,import_sha256)
     values(who,row->>'id',coalesce(old_rev,0)+1,day,row->>'focus',(row->>'mins')::numeric,row->>'deletedAt' is not null,rev,row,source_hash);
    end if;
    field:=case when row->>'deletedAt' is not null then 'deleted' when old_rev is null then 'added' else 'updated' end;
   end if;
   counter:=jsonb_set(counter,array[field],to_jsonb((counter->>field)::integer+1));
  end loop;
  counts:=jsonb_set(counts,array[kind],counter);
 end loop;
 update public.journal_imports i set counts=mass_commit.counts where i.owner_id=who and i.sha256=source_hash;
 update public.journal_heads set revision=head+1 where owner_id=who;
 return jsonb_build_object('duplicate',false,'counts',counts);
end $$;
commit;
