begin;
create table public.fitness_owners (
  owner_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.fitness_owners enable row level security;
create policy owner_membership on public.fitness_owners for select to authenticated
  using (owner_id = (select auth.uid()));
grant select on public.fitness_owners to authenticated;
revoke all on public.fitness_owners from anon;

create table public.fitness_libraries (
  owner_id uuid primary key references public.fitness_owners(owner_id),
  revision bigint not null default 1 check (revision > 0),
  state jsonb not null check (state ?& array['schemaVersion','activities','feedback','originals']
    and state->'schemaVersion'='1'::jsonb
    and jsonb_typeof(state->'activities')='object'
    and jsonb_typeof(state->'feedback')='object'
    and jsonb_typeof(state->'originals')='object'),
  updated_at timestamptz not null default now()
);
alter table public.fitness_libraries enable row level security;
create policy private_library on public.fitness_libraries for all to authenticated
  using (owner_id = (select auth.uid()) and exists(select 1 from public.fitness_owners where owner_id = (select auth.uid())))
  with check (owner_id = (select auth.uid()) and exists(select 1 from public.fitness_owners where owner_id = (select auth.uid())));
grant select,insert,update on public.fitness_libraries to authenticated;
revoke all on public.fitness_libraries from anon;

create function public.commit_fitness_library(expected_revision bigint,new_state jsonb)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare next_revision bigint;
begin
  if auth.uid() is null then raise insufficient_privilege; end if;
  insert into public.fitness_libraries(owner_id,revision,state)
    values(auth.uid(),1,new_state)
    on conflict(owner_id) do update set revision=public.fitness_libraries.revision+1,state=new_state,updated_at=now()
    where public.fitness_libraries.revision=expected_revision
    returning revision into next_revision;
  if next_revision is null then raise exception 'Concurrent save' using errcode='PT409'; end if;
  if expected_revision<>0 and next_revision=1 then raise exception 'Concurrent save' using errcode='PT409'; end if;
  return next_revision;
end $$;
revoke all on function public.commit_fitness_library(bigint,jsonb) from public,anon;
grant execute on function public.commit_fitness_library(bigint,jsonb) to authenticated;

create table public.fitness_sync_leases (
  owner_id uuid primary key references public.fitness_owners(owner_id),
  claim_id uuid not null,
  expires_at timestamptz not null
);
alter table public.fitness_sync_leases enable row level security;
create policy private_sync_lease on public.fitness_sync_leases for all to authenticated
  using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
grant select,insert,update on public.fitness_sync_leases to authenticated;
revoke all on public.fitness_sync_leases from anon;
create function public.claim_fitness_sync() returns uuid language plpgsql security invoker set search_path='' as $$
declare claim uuid;
begin
  insert into public.fitness_sync_leases(owner_id,claim_id,expires_at)
    values(auth.uid(),gen_random_uuid(),now()+interval '5 minutes')
    on conflict(owner_id) do update set claim_id=gen_random_uuid(),expires_at=now()+interval '5 minutes'
    where public.fitness_sync_leases.expires_at < now() returning claim_id into claim;
  return claim;
end $$;
create function public.release_fitness_sync(claim_id uuid) returns void language sql security invoker set search_path='' as $$
  update public.fitness_sync_leases set expires_at=now()-interval '1 second'
    where owner_id=auth.uid() and fitness_sync_leases.claim_id=$1;
$$;
revoke all on function public.claim_fitness_sync() from public,anon;
revoke all on function public.release_fitness_sync(uuid) from public,anon;
grant execute on function public.claim_fitness_sync(),public.release_fitness_sync(uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit)
  values('fitness-private','fitness-private',false,52428800);
create policy private_fitness_read on storage.objects for select to authenticated
  using(bucket_id='fitness-private' and (storage.foldername(name))[1]=(select auth.uid())::text
    and exists(select 1 from public.fitness_owners where owner_id=(select auth.uid())));
create policy private_fitness_upload on storage.objects for insert to authenticated
  with check(bucket_id='fitness-private' and (storage.foldername(name))[1]=(select auth.uid())::text
    and exists(select 1 from public.fitness_owners where owner_id=(select auth.uid())));
commit;
