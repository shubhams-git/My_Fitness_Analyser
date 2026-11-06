# Credential verification — 6 November 2026

Owner requires free products only. Gemini project's Free plan was explicitly
confirmed by the owner. This supersedes earlier assumptions about active billing.

- Gemini model-list request authenticated (HTTP 200). One synthetic-only
  Interactions request to gemini-3.8-flash with high thinking returned HTTP 503.
  No successful live analysis is claimed. No automatic retry or paid fallback.
- Google currently lists standard 3.8 Flash input/output including thinking as
  free on its Free tier. Account/model listing does not prove remaining quota.
  GEMINI_FREE_TIER_CONFIRMED gates generation; it is an owner attestation, not
  an API-verified billing lock. Keep this project's billing disabled to prevent
  paid-tier charges. Personal Garmin/MASS records remain excluded from Gemini.
- Supabase publishable key authenticated Auth settings (HTTP 200). Secret key
  verified the admin user list read-only: zero Auth users. Runtime does not use
  that privileged key. Public signups currently enabled; app table request
  returned PGRST205/404, so migrations are not ready.
- Local aliases were added without printing secrets: NEXT_PUBLIC_SUPABASE_URL
  to SUPABASE_URL; NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to SUPABASE_ANON_KEY;
  existing API_KEY to GARMIN_PERSONAL_API_KEY. Original variables are retained.
- Still needed: owner Auth account/UUID, application SQL migration, allowlist
  entry, APP_ORIGIN and Vercel Production variables. Hosting from GitHub does
  not transfer local .env values. No credentials uploaded to Vercel this turn.

Use docs/PRIVATE_DEPLOYMENT.md for migration and authorization gates. Do not set
FITNESS_CLOUD_ENABLED=1 before those gates are ready. Current cloud journal
support is still deferred; credentials alone do not complete that feature.

Next development priority from the owner: replace decorative route outlines
with a real street-labelled basemap, keeping recorded route/pace interaction
and no-GPS states. Choose a documented free map setup and verify attribution,
tile limits and location-request privacy before implementation.

Official sources checked:
- https://ai.google.dev/gemini-api/docs/pricing#gemini-3.8-flash
- https://ai.google.dev/gemini-api/terms#unpaid-services
- https://supabase.com/docs/guides/getting-started/api-keys
- https://vercel.com/docs/environment-variables
