# F24 — Private member onboarding

Members can sign in with email and password or use a configured Google,
Facebook or GitHub account. New members use their invited email and verify it
through Supabase. The Before User Created hook restricts account creation.
A transactional claim binds the invitation to the verified Auth UUID.
Existing members keep their UUID, records and password. Use the same verified
email across login methods so Supabase can link identities to the existing account.

New members land in Account to connect Garmin. Training, Sessions and Journal
open once their key is saved. Account verifies the key with Garmin before
saving or replacing it. Sync uses the authenticated owner's stored credential,
the existing owner-scoped lease and the existing activity and recovery importer.
Supported activity history begins 1 July 2026, with a 1,000-activity limit per
sync. Available sleep, HRV and wellness summaries cover up to 28 days.

The application encrypts keys using AES-256-GCM with a fresh nonce and the
owner UUID as authenticated data. Supabase RLS scopes the encrypted row to its
owner. The Vercel server has the encryption key in production. Profile,
activity and backup responses omit the Garmin credential and token. Keep a
protected backup of the encryption key with production recovery credentials.
Replacing the encryption key requires re-encrypting stored rows before switching.

## Production setup

The production Supabase migration is tracked by filename and SHA-256 in
`fitness_release.migrations`. The legacy owner Garmin key was encrypted from
the existing Production Vercel value and inserted for the existing owner in the
same transaction. Garmin accepted the decrypted value during verification.

Vercel Production uses `FITNESS_MEMBER_ACCOUNTS=1` and
`GARMIN_CREDENTIAL_ENCRYPTION_KEY`, a sensitive 64-digit hexadecimal value
representing 32 random bytes. Hosted sync reads from the database. The loopback
local Garmin tool still reads its local environment.

Supabase Site URL is the production origin. Its allowlisted application callback
is `APP_ORIGIN/api/auth/callback`. Email confirmation stays required. The
Before User Created Postgres hook uses `public.check_fitness_member_invite`.
Live Supabase Auth rejected an uninvited signup with HTTP 403.

To add a member, insert the exact email they will verify through their mailbox
or chosen OAuth provider. They can then open the app and choose Create an account
or an enabled provider. Open password confirmation links in the same browser
used to register.

```sql
insert into public.fitness_member_invites(email)
values (lower(btrim('friend@example.com')))
on conflict (email) do nothing;
```

Configure an OAuth app with each provider, then enter its client ID and secret
under Supabase Authentication → Sign In / Providers. Each provider uses the
Supabase callback `https://PROJECT_REF.supabase.co/auth/v1/callback`. The app
enables a provider button when Supabase reports it is active. For Facebook
in development mode, add the intended members as app testers.
[Google setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-google),
[Facebook setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-facebook),
[GitHub setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-github).

For password signups outside the Supabase project team, configure an SMTP
service under Authentication → Email. Supabase's built-in sender is restricted
to project-team addresses. Keep email confirmation on.
[Supabase SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp).

## Verification

The tests exercise provider redirects and the PKCE cookie, verified invitation
claims, database-level credential isolation, encryption ownership binding,
invalid Garmin key handling, the onboarding requirement and owner-specific sync.
Production OAuth and email signup for invited friends await provider credentials
or custom SMTP. An end-to-end second-member sync awaits an invited member with
their own Garmin key.
