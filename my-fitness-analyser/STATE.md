# Current state

Updated: 7 November 2026 (Australia/Sydney)
Active increment: F09 real geographic route exploration

## Implemented

- F09: real MapLibre/OpenFreeMap street maps replace optical route illustrations.
  Streets and Night cartography retain street/place labels, parks, buildings and
  surrounding geography at each zoom. Pan, zoom, north reset and fit-to-route;
  recorded start/finish/km markers; route inspection synchronises time/pace/HR
  with charts. Cooperative inline gestures and a focused route explorer support
  mobile use. Renderer/worker are same-origin, lazily mounted and disposed.
  Missing GPS stays missing. No API key or paid service. See F09 for verification.

- F08: reversible per-member Gemini sharing choice in Training and Account,
  consent audit, separate explicit Generate action, minimised run evidence,
  request-specific structured report validation, private cache and source-backed
  chart/evidence disclosures. New consent/report SQL migration applied live.
  57 tests pass; Gemini 3.6 high-thinking synthetic response validated after an
  earlier response was rejected. 3.8/3.7 probes returned 503. Production checks
  are recorded in F08. A real-history production briefing was generated, validated,
  persisted and restored after reload. Its evidence/chart values and Account
  opt-out/re-enable were checked live. JSONB key-order cache rejection was fixed
  with canonical hashing and legacy compatibility. Owner's AI choice is enabled;
  no other member has been opted in. Credentials were not extracted or entered.
- Owner confirms production Garmin sync succeeded and both Garmin and NRC history
  are visible. This is owner-reported evidence, not an agent repeat-sync audit.

- Premium athletic email/password sign-in, server-verified invite membership,
  renewable 30-day HttpOnly refresh cookies, sign-out and owner-scoped drafts.
- Shared schema with per-user rows and private Storage namespaces. Existing
  confirmed Shubham Auth identity is preserved. Its profile links to the existing
  NRC activities; no password changed and no duplicate user made.
- Hosted data/training/journal require authentication and never return demo data.
  Previous synthetic adapters and the cloud-disabled flag caused the mismatch
  between the populated database and online screens.
- NRC projection preserves source precision, accepted revisions, aliases, splits
  and missing sensors. Existing FIT/Garmin state is merged without a destructive
  migration. Check-ins use separate immutable revisions and reject stale saves.
  Full-kilometre labels work beyond two kilometres.
- Account provides own Garmin sync status, FIT upload, private NRC/Strava screenshot
  review intake, complete evidence export and user-driven password change.
- Profiles/feedback/submissions migration is applied live. SQL confirms the
  profile, owned NRC history and enabled row security. No real check-in answers
  or synthetic test activities were inserted.
- Export v2 includes relational records, pending submissions, legacy FIT state
  and verified original bytes. Restore v2 needs a reviewed DB workflow.

## Verification and deployment

57 automated tests pass. PostgreSQL tests execute owner/storage isolation, source
publication, stale-save rejection and cross-owner foreign keys using synthetic
schemas. HTTP tests cover fail-closed hosting, refresh, wrong-owner Garmin,
idempotent screenshot intake and corrupt exports. Foundation/config-format and
diff whitespace checks pass. Production deployment results are recorded in F07.
Commit ee38eb5 is pushed and the Vercel production build is Ready. Production
root redirects to sign-in; anonymous data/training/journal/profile return 401
without records; invalid credentials return 401 and logout clears cookies.

Chrome: sign-in desktop/phone, account at 375px, empty-member training, real NRC
projection including the long run, check-in save/reload. The latter is a loopback
memory-only fixture, not live Auth/DB writes. On 7 November the owner confirmed
successful production sign-in and that his NRC runs appear. This is owner-reported
verification, not an independent row-by-row UI reconciliation. Credentials were
not shared. Reload/sign-out, actual iPhone Safari and timing remain pending.

## Existing capabilities and evidence

F06 archived every supplied NRC original and extraction manifest privately,
published/reconciled relational history without invented GPS/HR, and verified
replay and isolated restore. F04 provides local real Garmin/FIT sync; F03b provides
local MASS import, weight trends and source sessions. See their feature records
and ignored private-data reports. Personal evidence/credentials never enter Git.
Work stays on master; no new branch for this increment.

## Remaining boundaries

- Saurav has no invited account yet; his email/identity setup is required. RLS and
  membership support a second athlete now. No self-service public signup.
- The server Garmin key is available only to its configured owner. Other members
  use manual FIT until encrypted per-member connections are delivered.
- Hosted MASS population/import and direct weigh-in capture are not delivered;
  hosted journal stays empty until owned readings are deliberately imported.
- NRC/Strava uploads are private intake, not automatic extraction or an operator
  review UI. Previously published NRC history is available to its owner.
- No scheduled sync, manual strength log, training-plan editor or search grounding.
  Opted-in members can explicitly request a run briefing; ordinary browsing and
  declined accounts never trigger personal Gemini calls. See F08 for exact tests.

## Next action

Verify the deployed geographic map against the owner's real Garmin run, then
collect actual iPhone Safari feedback on map gestures and label legibility.
