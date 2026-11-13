begin;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create table public.training_worker_config (
 singleton boolean primary key default true check(singleton),
 origin text not null check(origin ~ '^https://[a-z0-9][a-z0-9.-]*[a-z0-9]$')
);
alter table public.training_worker_config enable row level security;
revoke all on public.training_worker_config from public, anon, authenticated;

create function public.training_worker_ready() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.training_worker_config where singleton);
$$;
revoke all on function public.training_worker_ready() from public, anon, authenticated;
grant execute on function public.training_worker_ready() to authenticated;

create function public.dispatch_training_jobs() returns integer
language plpgsql security definer set search_path='' as $$
declare base text; job record; sent integer:=0;
begin
 select origin into base from public.training_worker_config where singleton;
 if base is null then return 0; end if;
 for job in
  select id,capability from public.training_analysis_jobs where pack is not null and available_at<=now()
   and (lease_until is null or lease_until<=now()) and (dispatched_at is null or dispatched_at<=now()-interval '60 seconds')
   order by available_at limit 5 for update skip locked
 loop
  perform net.http_post(url:=base||'/api/training-worker',body:=jsonb_build_object('id',job.id,'capability',job.capability),timeout_milliseconds:=260000);
  update public.training_analysis_jobs set dispatched_at=now() where id=job.id;
  sent:=sent+1;
 end loop;
 return sent;
end $$;

create function public.training_job_on_insert() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.training_worker_config where singleton) then
  raise exception 'The training worker is not configured.' using errcode='PT503';
 end if;
 perform public.dispatch_training_jobs();
 return new;
end $$;
create trigger training_job_dispatch after insert on public.training_analysis_jobs for each row execute function public.training_job_on_insert();

revoke all on function public.dispatch_training_jobs(), public.training_job_on_insert() from public, anon, authenticated;
select cron.schedule('mfa-training-job-recovery','* * * * *','select public.dispatch_training_jobs()');
notify pgrst,'reload schema';
commit;
