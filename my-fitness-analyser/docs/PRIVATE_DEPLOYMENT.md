# Private online release candidate

7 November: Supabase is provisioned with private evidence and membership data;
Vercel is connected to GitHub master. F07 is the authenticated real-data cutover.
See features/F07-private-members.md for actual verification and remaining gates.

## Account setup and migration

1. Select the existing Vercel project
   or a separate private project, with application root `my-fitness-analyser`.
2. Choose a Supabase project/region and verify its current plan and quotas before
   creation. No paid subscription is assumed. Keep public signups disabled.
3. Create the owner's Supabase Auth account through the provider dashboard.
   The owner sets their password directly; never paste it into chat or source.
4. Apply the tracked migrations in chronological order, beginning with
   `supabase/migrations/20261105_private_library.sql`, then the relational evidence
   and member profile/feedback migrations. Do not reapply already executed DDL.
   It creates owner-scoped library state, conflict-checked updates, sync leases
   and a private `fitness-private` bucket. This is a new migration, not a reset.
5. Copy the owner's Auth user UUID into the owner allowlist using SQL:

```sql
insert into public.fitness_owners(owner_id)
values ('REPLACE_WITH_OWNER_AUTH_UUID') on conflict do nothing;
insert into public.fitness_profiles(owner_id,display_name)
values ('REPLACE_WITH_OWNER_AUTH_UUID','REPLACE_WITH_MEMBER_NAME')
on conflict do nothing;
```

The runtime uses the user's access token plus RLS. It does not need a service-role
key. A second account must be invited to fitness_owners; then it receives its own
records, never the bootstrap owner's. RLS isolates rows/storage paths. UI assets can be public; health APIs and
originals require verified authentication.

## Production configuration

Set these as **Production-only** Vercel environment variables, through the provider
UI/connection, not Git. `.env.example` contains names only.

- `SUPABASE_URL`: `https://PROJECT_REF.supabase.co`
- `SUPABASE_ANON_KEY`: project's anon/publishable key (never service role)
- `FITNESS_OWNER_ID`: bootstrap Garmin owner's Auth UUID (not the signed-in identity)
- `APP_ORIGIN`: exact HTTPS app origin, without a trailing slash
- `GARMIN_PERSONAL_API_KEY`: existing owner's key, server-only
- `FITNESS_CLOUD_ENABLED=1`: enables guarded real-data endpoints

Hosted routes always require Auth, even when FITNESS_CLOUD_ENABLED is zero.
That flag selects private mode for the local server. Never ship personal-provider
keys to public design previews. APP_ORIGIN must match the exact production host;
preview hosts need their own origin/configuration. `npm run check:cloud` checks
format without printing values or making network calls; it now passes locally.

The existing Vercel configuration routes private API operations through one
guarded handler and reserves a 300-second maximum duration for that function;
verify availability against the selected project's plan. Function request/response
payloads have a 4.5 MB platform cap, so this alpha bounds ordinary operations to
3.5 MB and refuses oversized library responses safely. Large-history pagination,
large backup restoration and durable background jobs remain later work.
[Vercel limits](https://vercel.com/docs/functions/limitations).

## Release verification, before importing real data

1. Deploy and confirm anonymous GET `/api/data` returns 401 with no activity data.
2. Sign in with the owner account. Verify a fresh library's import/sync controls.
3. Verify another account cannot log in to this library or read its rows/files.
4. Import a synthetic FIT, save four answers, sign out and back in, reload from
   another browser and verify the answers. Test simultaneous saves and sync claims.
5. Export the synthetic library. Verify a short-lived backup link and restoration;
   originals must remain inaccessible without authorization.
6. Verify cookies are Secure/HttpOnly/SameSite, responses are not cached, and a
   revoked/expired session fails or refreshes through Supabase Auth correctly.
7. With the actual project and private URL verified, sync the owner's Garmin
   records. Alternatively restore a local export under the online size limit.
8. Test iPhone Safari and record observed check-in timings.

Report the exact checks performed; a deployed sign-in page alone is not verified
owner login, and PostgreSQL stand-in tests are not a live two-person login test.

## Implementation and verified evidence

- `cloud/auth.mjs`: Auth-server owner verification, refresh rotation, sign-out,
  HttpOnly cookies and origin checks for mutations. Tokens stay out of browser JS.
- `cloud/supabase.mjs`: same library operations as local mode, private original
  objects and optimistic revision checks for concurrent devices. Upload failures
  cannot commit a state pointer to an unsaved file. Failed concurrent commits can
  leave unreferenced private objects; no automatic deletion is performed.
- `cloud/handler.mjs`: authenticated data, FIT/check-in import/save, restore,
  explicit Garmin sync with a database lease, and private backup downloads.
- `tests/cloud.test.mjs`: real PostgreSQL execution via pinned PGlite, with
  synthetic Supabase auth/storage schema stand-ins. Owner/anonymous/storage
  policies, conflicts and leases passed. Auth HTTP calls are mocked separately;
  these are not live Supabase integration tests.

The alpha merges relational screenshot history with versioned owner JSONB/FIT
state. Export v2 includes relational rows and checksum-verified originals,
including pending screenshot uploads; restore v2 needs reviewed database tooling.
Normalized Garmin/MASS ingestion and larger-history pagination remain later work.
No framework migration. Membership records never contain passwords.

## Sources and dependency review

- [Supabase Auth REST](https://supabase.github.io/auth/): password and refresh flows.
- [Server-side session guidance](https://supabase.com/docs/guides/auth/server-side/advanced-guide): verified user identity and no-store responses.
- [Row security](https://supabase.com/docs/guides/database/postgres/row-level-security) and [private storage policies](https://supabase.com/docs/guides/storage/security/access-control).
- [Conflict error guidance](https://supabase.com/kb/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions): PT409, avoiding automatic serialization retries.
- PGlite 0.5.15, official Electric SQL package, Apache-2.0, approximately 26 MB
  unpacked, development-only. It executes the migration in PostgreSQL locally;
  it is not imported by application runtime code or included as a cloud database.
