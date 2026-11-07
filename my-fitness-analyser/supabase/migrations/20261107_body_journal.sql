-- Additive, owner-scoped journal. No personal data; no existing tables changed.
begin;
create table public.journal_heads (
 owner_id uuid primary key references public.fitness_owners(owner_id), revision bigint not null default 0 check(revision>=0)
);
create table public.journal_imports (
 owner_id uuid not null references public.fitness_owners(owner_id), sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 object_key text not null, byte_length bigint not null check(byte_length between 1 and 3670016), exported_at timestamptz not null,
 counts jsonb not null, created_at timestamptz not null default now(), primary key(owner_id,sha256),
 check(object_key=owner_id::text||'/journal/'||sha256||'.json')
);
create table public.body_measurements (
 owner_id uuid not null references public.fitness_owners(owner_id), source text not null check(source in ('mass','manual')),
 entry_key text not null check(length(entry_key) between 1 and 200), revision bigint not null check(revision>0),
 date_key date, weight_kg numeric check(weight_kg>0 and weight_kg<=1000), deleted boolean not null,
 source_version bigint not null check(source_version>=0), data jsonb not null check(jsonb_typeof(data)='object'), import_sha256 text,
 created_at timestamptz not null default now(), primary key(owner_id,source,entry_key,revision),
 foreign key(owner_id,import_sha256) references public.journal_imports(owner_id,sha256),
 check(deleted or (date_key is not null and weight_kg is not null)),
 check((source='mass' and import_sha256 is not null) or (source='manual' and import_sha256 is null))
);
create table public.journal_sessions (
 owner_id uuid not null references public.fitness_owners(owner_id), entry_key text not null check(length(entry_key) between 1 and 200),
 revision bigint not null check(revision>0), date_key date, focus text, minutes numeric check(minutes between 0 and 1440),
 deleted boolean not null, source_version bigint not null check(source_version>=0), data jsonb not null,
 import_sha256 text not null, created_at timestamptz not null default now(), primary key(owner_id,entry_key,revision),
 foreign key(owner_id,import_sha256) references public.journal_imports(owner_id,sha256),
 check(deleted or (date_key is not null and length(focus) between 1 and 200))
);
create table public.journal_mutations (
 owner_id uuid not null references public.fitness_owners(owner_id), operation_id uuid not null,
 payload jsonb not null, result jsonb not null, created_at timestamptz not null default now(), primary key(owner_id,operation_id)
);
create index body_measurements_calendar on public.body_measurements(owner_id,date_key desc);
create view public.body_measurements_latest with(security_invoker=true) as
 select distinct on(owner_id,source,entry_key) * from public.body_measurements order by owner_id,source,entry_key,revision desc;
create view public.journal_sessions_latest with(security_invoker=true) as
 select distinct on(owner_id,entry_key) * from public.journal_sessions order by owner_id,entry_key,revision desc;
alter table public.journal_heads enable row level security;
alter table public.journal_imports enable row level security;
alter table public.body_measurements enable row level security;
alter table public.journal_sessions enable row level security;
alter table public.journal_mutations enable row level security;
do $$ declare relation text; begin
 foreach relation in array array['journal_heads','journal_imports','body_measurements','journal_sessions','journal_mutations'] loop
  execute format('revoke all on public.%I from public,anon,authenticated',relation);
  execute format('grant select on public.%I to authenticated',relation);
  execute format('create policy own_journal_read on public.%I for select to authenticated using(owner_id=(select auth.uid()))',relation);
 end loop;
end $$;
revoke all on public.body_measurements_latest,public.journal_sessions_latest from public,anon,authenticated;
grant select on public.body_measurements_latest,public.journal_sessions_latest to authenticated;

create function public.journal_snapshot() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
  'revision',coalesce((select revision from public.journal_heads where owner_id=auth.uid()),0),
  'timezone',coalesce((select timezone from public.fitness_profiles where owner_id=auth.uid()),'Australia/Sydney'),
  'weights',coalesce((select jsonb_agg(to_jsonb(w)) from public.body_measurements_latest w where owner_id=auth.uid()),'[]'::jsonb),
  'sessions',coalesce((select jsonb_agg(to_jsonb(s)) from public.journal_sessions_latest s where owner_id=auth.uid()),'[]'::jsonb),
  'imports',coalesce((select jsonb_agg(to_jsonb(i)-'counts') from public.journal_imports i where owner_id=auth.uid()),'[]'::jsonb)
 );
$$;

-- Definer is limited to append-only, membership-checked mutations. No owner arg,
-- dynamic SQL or broad client INSERT grants. Receipts are checked before versions.
create function public.save_body_measurement(target_id uuid,expected_revision bigint,expected_head bigint,operation_id uuid,new_value jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); prior public.body_measurements; receipt public.journal_mutations; head bigint;
 payload jsonb; result jsonb; day date; today date; zone text; weight numeric; stamp bigint; value jsonb; is_deleted boolean;
begin
 if who is null or not exists(select 1 from public.fitness_owners where owner_id=who) then raise insufficient_privilege; end if;
 if target_id is null or operation_id is null or expected_revision<0 or expected_head<0 or jsonb_typeof(new_value)<>'object' then raise exception 'Invalid reading.' using errcode='PT400'; end if;
 perform pg_advisory_xact_lock(hashtext('journal:'||who::text));
 payload:=jsonb_build_object('id',target_id,'revision',expected_revision,'head',expected_head,'value',new_value);
 select * into receipt from public.journal_mutations m where m.owner_id=who and m.operation_id=$4;
 if found then
  if receipt.payload<>payload then raise exception 'This save identifier was already used. Start a new save.' using errcode='PT409'; end if;
  return receipt.result;
 end if;
 insert into public.journal_heads(owner_id) values(who) on conflict do nothing;
 select revision into head from public.journal_heads where owner_id=who for update;
 select * into prior from public.body_measurements where owner_id=who and source='manual' and entry_key=target_id::text order by revision desc limit 1;
 if coalesce(prior.revision,0)<>expected_revision or head<>expected_head then raise exception 'Your journal changed. Refresh it before saving.' using errcode='PT409'; end if;
 if new_value - array['dateKey','kg','note','deleted','confirmSameDay'] <> '{}'::jsonb then raise exception 'Unexpected reading fields.' using errcode='PT400'; end if;
 day:=(new_value->>'dateKey')::date;weight:=(new_value->>'kg')::numeric;is_deleted:=coalesce((new_value->>'deleted')::boolean,false);
 select timezone into zone from public.fitness_profiles where owner_id=who;
 if zone is null or not exists(select 1 from pg_timezone_names where name=zone) then zone:='Australia/Sydney';end if;
 today:=(now() at time zone zone)::date;
 if day is null or day<'2026-07-01' or day>today or weight is null or weight<=0 or weight>1000 or weight<>round(weight,2) or length(coalesce(new_value->>'note',''))>2000 then raise exception 'Check the date, weight and note.' using errcode='PT400'; end if;
 if is_deleted and prior.revision is null then raise exception 'This reading does not exist.' using errcode='PT400'; end if;
 if not is_deleted and not coalesce((new_value->>'confirmSameDay')::boolean,false) and exists(select 1 from public.body_measurements_latest b where b.owner_id=who and b.date_key=day and not b.deleted and not(b.source='manual' and b.entry_key=target_id::text)) then raise exception 'There is already a reading on this date. Review it and confirm another reading.' using errcode='PT409';end if;
 stamp:=floor(extract(epoch from clock_timestamp())*1000)::bigint;
 value:=jsonb_build_object('id',target_id::text,'dateKey',day::text,'t',null,'kg',weight,'note',coalesce(new_value->>'note',''),'updatedAt',stamp,'deletedAt',case when is_deleted then stamp else null end);
 insert into public.body_measurements(owner_id,source,entry_key,revision,date_key,weight_kg,deleted,source_version,data)
 values(who,'manual',target_id::text,expected_revision+1,day,weight,is_deleted,stamp,value);
 update public.journal_heads set revision=head+1 where owner_id=who;
 result:=jsonb_build_object('id',target_id,'revision',expected_revision+1,'head',head+1,'deleted',is_deleted);
 insert into public.journal_mutations values(who,$4,payload,result,now());return result;
end $$;

create function public.commit_mass_journal(expected_head bigint,source_hash text,object_key text,byte_length bigint,exported_at timestamptz,incoming jsonb,confirm_same_day boolean default false)
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
revoke all on function public.journal_snapshot(),public.save_body_measurement(uuid,bigint,bigint,uuid,jsonb),public.commit_mass_journal(bigint,text,text,bigint,timestamptz,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.journal_snapshot(),public.save_body_measurement(uuid,bigint,bigint,uuid,jsonb),public.commit_mass_journal(bigint,text,text,bigint,timestamptz,jsonb,boolean) to authenticated;
commit;
