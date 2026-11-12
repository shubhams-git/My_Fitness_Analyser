begin;

create table public.gemini_key_rotation (
 singleton boolean primary key default true check (singleton),
 last_key_id text check (last_key_id ~ '^[a-f0-9]{64}$')
);
alter table public.gemini_key_rotation enable row level security;
revoke all on public.gemini_key_rotation from public, anon, authenticated;
insert into public.gemini_key_rotation (singleton) values (true);

create function public.reserve_gemini_key_slot(review_kind text, review_id uuid, key_ids text[])
returns integer language plpgsql security definer set search_path='' as $$
declare
 owner uuid := auth.uid();
 last_id text;
 slot integer;
begin
 if owner is null or not exists(select 1 from public.fitness_owners where owner_id=owner) then
  raise insufficient_privilege;
 end if;

 if review_kind = 'run-coaching' then
  perform pg_advisory_xact_lock(hashtext('ai:'||owner::text));
  if not exists(
   select 1 from public.analysis_reports r join public.ai_preferences p using(owner_id)
   where r.id=review_id and r.owner_id=owner and r.status='generating'
    and r.created_at>now()-interval '6 minutes' and p.enabled and p.revision=r.consent_revision
  ) then raise insufficient_privilege; end if;
 elsif review_kind = 'weight-coaching' then
  perform pg_advisory_xact_lock(hashtext('weight-ai:'||owner::text));
  if not exists(
   select 1 from public.weight_analysis_reports r join public.weight_ai_preferences p using(owner_id)
   where r.id=review_id and r.owner_id=owner and r.status='generating'
    and r.created_at>now()-interval '6 minutes' and p.enabled and p.revision=r.consent_revision
  ) then raise insufficient_privilege; end if;
 else
  raise insufficient_privilege;
 end if;

 if coalesce(array_ndims(key_ids),0)<>1 or array_lower(key_ids,1)<>1 or cardinality(key_ids) not between 2 and 5
  or exists(select 1 from unnest(key_ids) id where id is null or id !~ '^[a-f0-9]{64}$')
  or (select count(distinct id) from unnest(key_ids) id)<>cardinality(key_ids)
 then raise exception 'Invalid Gemini key pool.' using errcode='PT400'; end if;

 -- Serialize reservations across function instances. Only one-way key IDs reach the database.
 select last_key_id into strict last_id from public.gemini_key_rotation where singleton for update;
 slot := coalesce(array_position(key_ids,last_id),0) % cardinality(key_ids) + 1;
 update public.gemini_key_rotation set last_key_id=key_ids[slot] where singleton;
 return slot;
end $$;

revoke all on function public.reserve_gemini_key_slot(text,uuid,text[]) from public, anon, authenticated;
grant execute on function public.reserve_gemini_key_slot(text,uuid,text[]) to authenticated;
notify pgrst,'reload schema';
commit;
