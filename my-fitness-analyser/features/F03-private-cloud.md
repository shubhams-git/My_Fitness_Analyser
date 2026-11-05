# F03a: private online access preparation

Status: implemented release candidate; publishing blocked on provider connections
and actual deployment verification. Local Garmin functionality remains available.

Scope: private Vercel/Supabase boundary, verified owner sign-in, private FIT
storage, multi-device conflict handling, cloud API adaptation and deployment guide.
Keep the selected athletic Field Notes UI and existing Node/FIT/analysis modules.
No real health data has been uploaded to Supabase by this increment.

Tests: 20 passed, including authenticated/anonymous/other-owner boundaries,
session renewal, cookie attributes, version conflict retry and actual PostgreSQL
execution of RLS/storage/lease policies using synthetic schemas. Sign-in reviewed
at desktop and phone widths. Actual Supabase/Vercel/iPhone verification remains
pending. Run `npm run test:prototypes`, `npm run check` and `npm run check:cloud`.
The last command is expected to fail until cloud variables are configured.

See docs/PRIVATE_DEPLOYMENT.md for exact setup, limits, gates and source review.
MASS weight UI and full F03 MVP remain separate work; this is private access only.
