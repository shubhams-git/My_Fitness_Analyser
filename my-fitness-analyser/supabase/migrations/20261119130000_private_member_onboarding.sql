begin;

create table public.fitness_member_invites (
  email text primary key check (email = lower(btrim(email)) and length(email) between 3 and 254),
  claimed_by uuid unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.fitness_member_invites enable row level security;
revoke all on public.fitness_member_invites from public, anon, authenticated;

-- Configure this as the Supabase Before User Created hook for private signups.
create function public.check_fitness_member_invite(event jsonb)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when exists (
    select 1 from public.fitness_member_invites
    where email = lower(btrim(event->'user'->>'email')) and claimed_by is null
  ) then '{}'::jsonb
  else '{"error":{"http_code":403,"message":"Use the email address on your invitation."}}'::jsonb end;
$$;
revoke all on function public.check_fitness_member_invite(jsonb) from public, anon, authenticated;
grant execute on function public.check_fitness_member_invite(jsonb) to supabase_auth_admin;

create function public.claim_fitness_member_invite()
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  member_id uuid := auth.uid();
  invited_email text;
begin
  if member_id is null then return false; end if;
  if exists (select 1 from public.fitness_owners where owner_id = member_id) then return true; end if;

  select lower(btrim(email)) into invited_email from auth.users
    where id = member_id and email_confirmed_at is not null;
  if invited_email is null then return false; end if;

  update public.fitness_member_invites set claimed_by = member_id
    where email = invited_email and (claimed_by is null or claimed_by = member_id);
  if not found then return false; end if;

  insert into public.fitness_owners(owner_id) values (member_id) on conflict do nothing;
  return true;
end;
$$;
revoke all on function public.claim_fitness_member_invite() from public, anon;
grant execute on function public.claim_fitness_member_invite() to authenticated;

-- Only the Vercel server can decrypt these AES-GCM envelopes. RLS also binds
-- every read or write of ciphertext to the authenticated owner.
create table public.fitness_garmin_credentials (
  owner_id uuid primary key references public.fitness_owners(owner_id) on delete cascade,
  envelope text not null check (length(envelope) between 45 and 3000 and envelope ~ '^v1\.[A-Za-z0-9_-]+$'),
  updated_at timestamptz not null default now()
);
alter table public.fitness_garmin_credentials enable row level security;
revoke all on public.fitness_garmin_credentials from public, anon, authenticated;
grant select, insert, update on public.fitness_garmin_credentials to authenticated;
create policy own_garmin_credential on public.fitness_garmin_credentials to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

commit;
