# F07 — private members and real records

7 November 2026. Owner request: replace synthetic online history with each user's
own records, provide professional email/password login, persist browser access
and prepare independent Shubham/Saurav source onboarding. Work stays on master.

## Engineering choices

Use Supabase Auth for credentials and a shared schema with owner_id RLS/FKs.
fitness_owners is an invite allowlist; fitness_profiles supplies name/timezone.
The verified Auth ID rebinds the request repository namespace. Do not trust
body/query ownership, clone a database per person, add a custom password table,
or globally filter users through FITNESS_OWNER_ID. Existing Shubham Auth user
already has a confirmed email/password; preserve it and link its existing history.

Project the accepted screenshot revision into the established UI, preserving null
sensors, minute/date precision and rounded pace/split values. Remap NRC aliases
so one physical run is shown once. Keep measurements separate from check-ins.
The append-only feedback RPC locks by member/activity and compares revision
before appending. Old owner JSONB/FIT state remains a compatibility bridge until
those adapters move to relational ingestion; merge without demo/pre-July rows.

Tokens stay in Secure/HttpOnly/SameSite cookies. Refresh cookies last 30 days,
renewed on refresh; access cookies cap at one hour. Supabase revocation/settings
can shorten access. Sign-out revokes the current session and clears cookies,
private drafts and rendered views across tabs. Back-forward cache reloads.
No tokens in localStorage or public signup. Existing account password unchanged.

The athletic login reuses Barlow Condensed/Manrope and carbon/orange/glacier
tokens. It supports password managers, paste, Show/Hide, visible labels, focused
live errors, loading state and reduced-motion media rules.

## Source onboarding

- Shubham: linked NRC history is read after sign-in. Server Garmin key is bound
  only to its bootstrap Auth UUID. Explicit Sync and manual FIT enforce July 2026
  onward. No implicit provider call on login.
- Saurav: invite/create his Auth user through Supabase; he sets his own password.
  Add his Auth UUID to fitness_owners and fitness_profiles administratively. His
  history starts empty; his rows/objects cannot access Shubham's. Do not copy the
  first member's history into a new account.
- NRC/Strava: Account accepts original JPG/PNG, 20 per batch and 3.5 MB per file.
  Backend checks signature, hashes bytes, uploads privately and creates an
  idempotent owner review entry. Publication uses reviewed extraction; no free
  Gemini transmission, guessed metrics, direct canonical writes or same-day merge.
- Future Garmin: backend verification plus encrypted per-member secret/Vault
  storage precedes a second connection. Never put keys in browser drafts or
  public-readable rows, and never use a global-key fallback. FIT import works
  meanwhile. Strava remains screenshot/social; no new API dependency. Hosted
  MASS ingestion is a separate upcoming slice.

## Recovery

Export v2 contains owned evidence/check-in revisions/profile, pending screenshot
submissions, legacy state and checksum-verified originals. Build server-side,
store privately and download via a 60-second signed URL. Reject v2 in the v1
restore path with a reviewed-DB-restore requirement; no silent data loss. Existing
v1 restore remains. No automatic deletion or credential export.

## Verification

- 51 tests, foundation, cloud format and diff checks pass. PostgreSQL executes
  SQL with synthetic Auth/Storage schemas; Auth HTTP is mocked independently.
  Cases include second-member ownership/membership, transient refresh, expired
  logout, wrong-user Garmin, source projection, screenshot retry and corrupt
  pending-evidence export rejection.
- Live migration applied. SQL confirms Shubham profile/email links to existing
  NRC activities and all three new tables enable RLS. No password changes, live
  synthetic records or check-ins created.
- Chrome: desktop/mobile login, invalid credentials, 375px account with 44px+
  controls, empty-member history. Real archive projected in loopback shows 14
  runs and correct six-row long-run splits. Four-answer save/reload is memory-only.
  These are not authenticated production or physical Safari tests.
- Production deployment verification will be appended after the master push.

Remaining: owner credential login/reload/sign-out, production signed export/sync,
physical iPhone Safari and observed check-in timing. No unperformed checks claimed.
