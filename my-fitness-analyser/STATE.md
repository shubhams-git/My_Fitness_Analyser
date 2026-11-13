# Current state

Updated: 14 November 2026 (Australia/Sydney)
Completed local increment: task-first Field Notes (F23)

## Implemented

- Journal weight insights include a “Worth knowing” note when Gemini supplies a
  valid one. The note teaches a specific mechanism or research takeaway.
  Refresh an older insight to get the revised note, which is saved with
  the private report and needs no additional Gemini request or database migration.

- Journal weight insights no longer have an app-imposed daily cap or a
  cooldown. Requests still share key rotation and Gemini backoff with Training.

- Four independent UI and UX audits led to a runner-first Training view, a
  Sessions archive, shorter sign-in, clearer Journal actions, and task-based
  Account and Progress layouts. Shared writes reach their endpoints again;
  run check-ins guard duplicate submission, and saved Journal entries can retry
  a failed refresh. Verified with synthetic Chromium and local fixtures.
  The hosted Activity endpoint sends the selected recording and summary rows for
  the remaining history. See [F23](features/F23_UI_UX_AUDIT.md).

- Training and Journal weight insights share Gemini 3.6 Flash defaults, a
  220-second request timeout, and app-wide rotation across distinct keys.
  Existing weight insights remain available until refreshed.

- Cold Activity, Training, Progress and Journal visits show a branded first
  paint with working navigation and page-specific loading content. Initial reads
  start alongside page assets. Slow and failed requests retain the shell.
  Verified at phone width in Chromium with delayed and failed API responses.


- Training and Progress switch within one document. Training and Journal reuse a
  short-lived tab snapshot during a background refresh. The first visit shows
  navigation while data loads, and independent Supabase reads run in parallel.

- F22 adds durable, owner-scoped coaching jobs, shared Gemini pacing and
  model timing/usage details. A synthetic 3.5 Flash-Lite Generate Content brief
  passed validation, and a recorded brief covers exhausted provider attempts.
  141 tests and foundation/config checks passed;
  the hosted Supabase dispatcher and a saved production report were verified.
  The current route prefers 3.6 Flash with default thinking, then 3.5 Flash-Lite. See [F22](features/F22_DURABLE_TRAINING_ANALYSIS.md). Garmin
  Personal API is pull-only; the automatic sync design is documented there.

- Satellite route replay now runs for 20–24.5 seconds after imagery loads.
  Local Chromium played the synthetic 4.8 km preview to completion in 22.8
  seconds and showed the full trail over satellite imagery. Pending deployment.

- Running coaching prefers Gemini 3.8 Flash, then 3.6 Flash and 3.1
  Flash-Lite. A cached fallback offers an explicit retry. Hosted training
  and weight model attempts reserve distinct consecutive keys through a
  shared database row. The rotation migration and Vercel key pool still
  need to be applied to production with owner approval.

- Coaching models now write an evidence-backed assessment, up to three
  independent findings, and a next-run action. Training shows findings
  inline with supporting measurements per claim. The same local validation
  applies to all model routes. This increment is ready for review locally.

- F21: Training and Progress show recent running, coverage, comparable pace
  and workout context without a goal or AI consent. Goals remain optional.
  Coaching uses recorded advice when discomfort affected a workout or recent
  outdoor-run evidence is absent. Full local tests and foundation checks pass;
  independent Impeccable and synthetic Chromium review completed. This change
  has not been deployed. See [F21](features/F21_CORE_TRAINING_INTELLIGENCE.md).

- Coaching refresh recovery: replaced the three-request daily database cap with
  a short cooldown, added bounded key retries, and return a labelled run-record
  brief during provider outages. Production reached Gemini, and the app showed
  the run-record brief after two provider 503s and a rejected Flash-Lite response.
  Flash-Lite now receives a verdict-only schema. All 128 tests passed.

- F20: weekly distance, benchmark time and weight goals; dated revisions,
  progress and zone-aware Gemini evidence. Bounded free-model fallback with
  optional confirmed-free key pool. Migration applied; 126 tests pass.
  Impeccable review fixes applied. See features/F20_GOALS_AND_COACHING.md.

- F19: member-entered running HR/pace zones in Account, with dates, declared source,
  reversible range mode and immutable history. Run analysis and monthly Progress
  classify actual samples with the version effective on each run. No guessed
  thresholds or screenshot streams. Live schema: owner RLS enabled, anonymous RPC
  denied, member RPC allowed, zero settings rows. Exports retain history. 116 tests
  and foundation checks pass. UI/UX Pro Max design and independent Impeccable
  reviews/re-edits cover links/anchors, error focus, disabled states, retries and
  validation. Phone/desktop preview uses memory-only test thresholds; actual Safari
  remains unverified. Existing Gemini reports/prompts are unchanged. Code f96e59c
  has successful Vercel status; all four new assets return200 with correct types.
  Actual signed-in Account loads blank settings, Cancel works, Progress retains
  measurement/anchor and shows the honest unconfigured state. No warning/error
  logs captured. No real setting was submitted. See F19.

- F18: pace-band bars/cells are centred, including true zero rows. Replay now uses
  separate bounded header/map/footer rows, visible-viewport sizing, scroll locking
  and original page/focus restoration. Close/stats stay in their own area. Follow
  framing is ~1.74x closer, with an eight-second recorded trailing position and a
  smooth pullback beginning before the finish. Large About/credits block removed;
  legally required imagery/data credits remain as small map-edge text. Street
  provider branding/info toggle replaced with required data links. 108 tests and
  foundation checks pass; final Impeccable UI source detector has no findings.
  Independent after-review has no observed P0/P1. Rendered phone/short/landscape,
  enlarged text, seek/finish, Close/Escape and scroll restoration checked. Physical
  iPhone Safari remains unverified by automation. Code 5366bae is deployed with
  successful Vercel status. All three production activity aliases match; live
  signed-in replay has a loaded ~538 px map stage, visible metrics, complete-route
  finish and restored activity focus. No warning/error logs captured. See
  features/F18_MOBILE_REPLAY_POLISH.md.

- F17: two independent Impeccable reviews reproduced the root release defect:
  stale index.html omitted chart/replay/interface styles, producing black plots
  and a zero-height replay canvas. Root, index and app aliases now use one HTML
  document, with response/CSS regression checks. UI/UX Pro Max guides readable
  replay controls and shared Manrope UI, compact run facts/actions and removal of
  duplicate pace preview/recap. Replay v2 uses a trailing camera, gradual pace,
  native imagery zoom and a finish pullback; the owner's 5 km preview is 29.8 s.
  Source imagery remains ~10 m. Brief units are deduplicated, unsupported personal
  limits hidden/rejected, runner-coach-v4 prepared without a generation request.
  107 tests and foundation checks pass. Fresh independent after-review agents
  score design 32/40 and technical 16/20, with no observed P0/P1. Their one minor
  finish-button label issue is corrected. Parent checks phone/landscape, enlarged
  text, reduced-motion manual inspection and retry; framing fits the route between
  HUD/controls, with a sticky Close area for short/zoomed views. Code cbd6a92 is
  deployed successfully. All three production aliases return identical HTML with
  nine stylesheets. Actual signed-in `/` has colored filled pace/HR figures and a
  loaded ~898 px replay canvas, 29.8 s timeline, recorded 14:57/2.27 km inspection
  and no browser errors. Live replay is left paused for inspection. Largest-text
  reduced-motion mode stays stopped with a working timeline and no horizontal
  overflow; physical Safari remains unverified. See F17 for evidence and limits.

- F16: dedicated satellite replay with a city overview, descent, 78° following
  camera, real terrain/sky and growing GPS trail. Recorded pace/elevation/distance,
  pause/resume/restart/timeline/finish, motion-off manual inspection, hidden-tab
  pause, map teardown and street-map restoration. EOxCloudless 2024 and Mapterhorn
  need no key or billing change; credits remain visible. Imagery is approximately
  10 m and has no photogrammetric 3D buildings. 104 tests and foundation checks
  pass. Rendered 320×568, 393×852 and 844×390 previews use a private read-only owner
  export; motion-off, completion and focus restoration are observed. Physical
  iPhone Safari remains unverified. See features/F16_SATELLITE_REPLAY.md.

- F15: large filled pace/HR/cadence/elevation/power explorer with real terrain
  context and distance/time inspection linked to maps. Visible metric-specific
  distributions, true kilometre splits, per-run results and chronological best
  efforts/Top 10. Half mile added; recorded-progress-v4 and activity-instruments-v1.
  Mobile analysis hides the obstructing check-in dock. 99 tests and foundation
  checks pass. Initial release de14224 is deployed; live owner charts and splits
  verified. A measured pre-GPS acquisition prefix edge case is corrected in v4,
  recovering the real 5 km 32:43 result; release ba2e853 deployed and verified on the real run. All six covered distances
  appear, and benchmark/source selection persists in Progress. A direct latest-run
  View analysis link makes the new charts findable from Training. No database/model call or billing
  change. See F15 and docs/REMAINING_WORK_2026-11-09.md for six remaining workstreams.

- F14: two independent Impeccable assessments; daily Training separated from
  Sessions and Progress. Current coach, latest run/check-in and seven-day summary
  lead. Stale run/weight prose is demoted. Profile-timezone calendar, persisted
  Progress context and readable axes. Full split/best-effort/check-in evidence,
  v3 run/v2 weight structured reports, generated weight advice, semantic direction checks and
  data-edit publication guard. Personal GPS route matching and rated session-RPE
  load added without new services or SQL. 92 tests and foundation checks pass.
  Real high-thinking synthetic Gemini run/weight probes validate the engineering;
  personal weight report generated, saved and restored after reload. App releases
  f458508/6bbfdfc are on master and Vercel is successful. Both personal v3 running
  attempts returned Google HTTP 503; no v3 report is claimed as published. Static
  modules return 200 and anonymous training stays 401. Preview servers stopped.
  See F14.


- F13: Impeccable 4.8.0 installed and applied to a rendered/source interface pass.
  Common mobile/desktop navigation, compact athletic hierarchy, readable account
  text, correct saved-check-in copy and visible HR scale. New Progress calendar,
  monthly distance/time comparisons and GPS-derived best-effort curve/rankings.
  Activity pace/HR distributions and disclosed focused/full pace scaling.
  Six new analytical regressions; 82 tests pass. No SQL or account data changes.
  App release 89cf59a is on master and Vercel reports success. Production real
  history, month/calendar selection and GPS effort ranking are verified; no
  captured console errors or horizontal overflow. Local audit servers stopped.
  Official Strava capability inventory and remaining boundaries are recorded in
  docs/STRAVA_CAPABILITY_RESEARCH.md; audit evidence in features/F13_INTERFACE_AND_PROGRESS.md.

- F12: continuous calendar-aware smoothed weight trend with quiet actual
  dots/deviation stems, interpolated missing days and a labelled flat dashed held
  tail. Original readings remain intact. Weight-specific Gemini consent, audit and
  private reports; explicit generation from deterministic trend/rate/coverage facts,
  bounded schema and quantities resolved from evidence. No new body-composition
  claims or paid fallback. Three-table scoped migration applied with owner RLS and
  anonymous generation denied. Real Gemini 3.6/high-thinking weight report generated,
  validated, persisted, restored after reload and exported with canonical evidence.
  First request returned 503; a valid reading-count citation exposed an overly
  narrow validation rule, now corrected and regression checked. Prompt v2 leads
  with the numeric pattern. All 29 weight rows and original bytes remain intact.
  Phone/landscape and 200% Chrome zoom checked; physical Safari remains unverified.
  76 tests pass. App code 4b0ce8f is pushed and Vercel reports success. Final page
  has no captured console errors and no range sliders; source/insight backup and
  screenshot evidence are recorded in F12. Original zoom/viewport restored.

- F11: body chart uses bounded smooth joins through real readings, recorded date
  extent and direct tap/hover/keyboard/button inspection; no range input. New
  manual strength sheet records focus/date/optional duration and note, with an
  optional explicit four-answer check-in and discomfort location. Edits/removal/
  restore are immutable and retry/stale-save protected. Overlapping manual/MASS
  sessions require separate-workout acknowledgement in either import order.
  New strength_entries table has owner RLS, read-only grants and a restricted
  membership-checked mutation function. Live catalog: RLS enabled, anonymous
  execute denied, zero test sessions, existing 29 weights/four MASS sessions intact.
  Synthetic phone/desktop save/reload/edit/remove/restore, validation, duplicate
  warning and rotation tested; 71 automated tests pass. Code 8287fe0 is pushed;
  Vercel reports success. Live chart/blank session form, 200% zoom reflow and
  complete export verified; zero live test sessions, zero journal sliders and
  no captured console errors. All source hashes and original MASS bytes match.
  See F11 and docs/REMAINING_ROADMAP.md (five major remaining workstreams).

- F10: cloud body journal and explicit kg/date/note weigh-in capture, immutable
  edits, reversible removal, owner-scoped browser drafts, request receipts and
  stale-save protection. MASS review/import preserves source identities, t/dateKey,
  update/deletion markers and exact original bytes. Same-day sources stay separate
  and require acknowledgement before daily averaging. The additive live schema
  has owner RLS and restricted mutation functions. Owner's 29 MASS weights and
  four active sessions are populated, with the source tombstone retained. A real
  v2 export was field/hash reconciled; no live manual test reading was fabricated.
  67 tests pass. Phone/landscape, input validation, save/edit/remove/restore,
  repeat import and two-tab conflict handling checked with a loopback synthetic
  PostgreSQL fixture; real MASS population/reload/export checked live. See F10.

- F09: real MapLibre/OpenFreeMap street maps replace optical route illustrations.
  Streets and Night cartography retain street/place labels, parks, buildings and
  surrounding geography at each zoom. Pan, zoom, north reset and fit-to-route;
  recorded start/finish/km markers; route inspection synchronises time/pace/HR
  with charts. Cooperative inline gestures and a focused route explorer support
  mobile use. Renderer/worker are same-origin, lazily mounted and disposed.
  Missing GPS stays missing. No API key or paid service. 61 tests pass. Real
  production Garmin route verified with geographic zoom/pan and 2 km inspection.
  375px portrait, landscape, large text and reduced motion checked in Chromium;
  actual iPhone Safari remains pending. See F09 for verification.

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

76 automated tests pass. PostgreSQL tests execute owner/storage isolation, source
publication, stale-save rejection and cross-owner foreign keys using synthetic
schemas. HTTP tests cover fail-closed hosting, refresh, wrong-owner Garmin,
idempotent screenshot intake and corrupt exports. Foundation/config-format and
diff whitespace checks pass. Production deployment results are recorded in F07.
Map code release 481ce29 is pushed and its Vercel production build is Ready.
Journal code release b98e002 is pushed and its Vercel production build is Ready.
Repeat live MASS import leaves one import and journal revision 1, with no duplicate
rows. The final 4.7 MB backup completed in 17 seconds in this observed run; all
source fields and original bytes reconcile. Production journal shows 29 readings,
no captured console errors and no horizontal overflow at 200% Chrome zoom. Browser
zoom was restored to 75% and temporary viewport overrides were reset. See F10.
Live geographic route/inspection evidence is recorded in F09. Production
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
- Actual owner manual weigh-in capture and physical iPhone Safari still need
  user/device observation; synthetic SQL/UI tests do not claim those checks.
- NRC/Strava uploads are private intake, not automatic extraction or an operator
  review UI. Previously published NRC history is available to its owner.
- No scheduled sync, training-plan editor or search grounding.
  Opted-in members can explicitly request a run briefing; ordinary browsing and
  declined accounts never trigger personal Gemini calls. See F08 for exact tests.
- Standalone weight insight has its own sharing choice and explicit Generate/Update
  action. Cross-domain running/strength/body coaching remains a later workstream.

## Next action

Review F23 on physical iPhone Safari, including first load and a timed run check-in.
