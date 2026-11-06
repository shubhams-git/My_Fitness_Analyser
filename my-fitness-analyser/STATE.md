# Current state

Updated: 5 November 2026 (Australia/Sydney)
Active increment: database v2 design review before population (docs/DATABASE_DESIGN_V2.md)

## Completed

- 6 November design-only audit: live Garmin inventory now has 11 activities, including a new FR965 GPS run, treadmill and indoor cycling. Newly inspected originals decode without errors. Daily summary/HR/sleep/HRV response shapes verified read-only; captures remain local/private. Proposed 16-table relational/evidence design and resumable population plan recorded in docs/DATABASE_DESIGN_V2.md. No v2 migration or personal-data insertion into Supabase performed; owner requested design discussion first. Earlier seven-record library remains intact.

- 6 November live database setup: applied the tested SQL migration plus owner allowlist in the existing signed-in Supabase dashboard. Verified owner account/allowlist, RLS on all three app tables and private storage bucket; library remains empty. Anonymous library REST read denied (401/42501). APP_ORIGIN normalized and check:cloud passes. Hosted app still synthetic; private application sign-in/save verification and personal-data upload remain separate gates.

- 6 November credential check: Gemini key authenticates model listing; Supabase URL/publishable key authenticate Auth settings, admin read finds zero Auth users, app tables absent (PGRST205). Local environment aliases mapped to existing runtime names. Owner confirms Gemini Free plan and free-products-only constraint. Added free-tier attestation gate and high-thinking 3.8 Flash configuration. One synthetic generation returned HTTP 503; no live analysis success claimed. See docs/CREDENTIAL_STATUS.md.

- Added `/journal` with MASS import review, duplicate/update/deletion handling, raw source preservation, daily weight readings, trailing seven-day means, date windows, keyboard chart inspection and session history. Imported the supplied export locally: 29 weights, four active sessions (two Strength, two Cardio), one excluded session tombstone. Repeat import adds no duplicates. See features/F03-mass-journal.md.
- Complete-library export/merge restore now includes MASS originals and records. A fresh private restore verified seven Garmin activities, 29 weigh-ins and four active MASS sessions. Earlier backups do not erase an existing journal. Preview is read-only and stale previews fail before saving. Public journal preview is synthetic only.
- Owner explicitly defers Gemini/Vercel/Supabase credentials and asks for autonomous product progress. External setup is not the next blocking task. Gemini remains synthetic-only; no new model/provider call was made for this increment.

- Added `/training`: actual local Garmin sessions plus historical screenshot summaries, last-90-day/all windows, running/walking filters, weekly distance, actual HR trace, source-labelled pace, sensor coverage and session links. The accepted athletic typography/palette continues with bounded motion and a static preference. Root detail remains intact; mobile navigation now reaches both Training and Activities.
- Added the Gemini synthetic-only evidence/tool pipeline: bounded aliased facts, strict request-specific JSON Schema, Ajv validation, evidence checks, source-backed charts, single-flight requests and a versioned private local response cache. Official Google docs mark 3.5 Flash deprecated; the configurable default is 3.6 Flash. Owner confirmed active billing but has not added the key; **use synthetic only**. No live Gemini request was made. See docs/GEMINI_ANALYSIS.md.
- Repeated live Garmin pull: seven unchanged supported records, zero updates/failures. Full overview shows nine sessions (seven Garmin, two historical summaries); last 90 days contains four. No owner check-in answers were generated. Supabase provisioning is explicitly deferred by the owner.

- Prepared Vercel/Supabase private-access candidate: owner-verified sign-in, HttpOnly cookies, owner-scoped PostgreSQL policies, private FIT bucket, revision-checked saves, sync leases and cloud API routes. Sign-in UI follows the accepted athletic theme. Twenty local tests pass, including PostgreSQL migration/RLS execution with synthetic schemas. Deployment is not complete: Vercel CLI authentication was invalid and both provider connections were unconfirmed. No real health data uploaded. See docs/PRIVATE_DEPLOYMENT.md.

- Live Garmin Personal API sync now saves originals, summaries and activity streams into the local library. Eight activities found; seven supported records saved, one breathwork unsupported. Repeat pull: zero added/updated, seven unchanged, no failures. FR965 treadmill run has HR but no GPS/usable distance; its UI selects HR and withholds misleading pace. Credentials remain server-only. See features/F04-garmin-local-sync.md.

- Owner accepted the athletic premium direction and requested basic features. Added local FIT import, atomic disk library, duplicate hashes, saved check-ins, export/merge restore and expanded route explorer. See features/F02-local-alpha.md. Private data stays in ignored private-data/library. Hosted Vercel remains a synthetic design preview.

- Latest owner feedback: premium quality accepted, hotel-like styling rejected; active fitness identity requested. Pulled origin/master (already current at 4c405be). Replaced serif/champagne treatment with self-hosted OFL Barlow Condensed, carbon/orange/glacier tokens, compact training hierarchy and prominent check-in action. Added recorded pace trace with keyboard inspection, linked replay time/pace/chart/route cursor, replay beacon and chart entrance. See docs/ACTIVE_DESIGN.md and docs/QA_ACTIVE_DESIGN.md. This iteration is local, awaiting visual review.

- Reconciled current user request with three earlier STRIDE research/brief documents.
- Recorded product contract, candidate visual system, design tokens, data rules, feature workflow and quality gates.
- Rechecked first-party Garmin Personal API documentation, official Garmin source projects, OpenAI agent/skill documentation and relevant design/testing sources.
- Created dependency-free token generator/checks and portable initial Git history.
- Renamed the active project to My Fitness Analyser; updated package identity, documentation, archive paths and Git snapshot.
- Verified live, read-only Personal API authentication, activity list, detail and original-file download using the owner's local .env key. Seven owned activities captured; owner confirmed older entries belong to him.
- Decoded seven original FITs with pinned official @garmin/fitsdk 21.221.0; integrity, capture hashes and available summary comparisons passed. The 4 November walk source is FR965; older source is FR255 Music. Optional running fields and irregular sample coverage inspected.
- Preserved six screenshots privately and transcribed two grouped activities, with owner-confirmed dates, explicit rounding/disagreements and missing HR null. Inventoried MASS format 2, including session tombstone and sparse wellness rows.
- Added reproducible capture/inspection/verification scripts and docs/DATA_FEASIBILITY.md. Personal evidence and detailed review are under ignored private-data; no token/key was saved in captures.
- Built Trackside and Field Notes as two local interactive Activity Detail/Quick Check-In compositions, using the same source samples. Trackside is route-led with a sheet; Field Notes is observation-led with inline feedback.
- Implemented sampled time-block/route/chart synchronization, keyboard chart inspection, source provenance/images, blank required answers, conditional discomfort location, browser draft recovery and simulated completion/failure/offline retry.
- Added comparison controls for source, state, viewport, larger text and reduced motion. Fonts are served locally with licences; shared tokens remain proposed with separate focus and stronger control boundaries.
- Verified five prototype tests, ten responsive cases, twenty visible-state cases and narrow larger-text/reduced-motion layouts. Private screenshots/evidence and docs/PROTOTYPE_REVIEW.md record what passed and remaining gates.
- Pushed the original prototype and synthetic-only Vercel setup on codex/prototype-vercel, commit e0948bb. UI/UX Pro Max is installed globally and its local search works.
- Refined both prototypes on codex/f01-design-refinement: integrated Trackside route/metrics, more distinct scale, ink/champagne Field Notes, section shortcuts, clearer chart readouts, reachable controls and 200% text review. Error/pending/completion focus is explicit. See docs/AUDIT.md, docs/DESIGN_RATIONALE.md and docs/QA_REPORT.md.

- Owner selected B / Field Notes for all future UI; current finish was rejected as too flat. Pulled master from GitHub to 35f10d0 and continued directly on master.
- Researched current official GPT-6.1 Sol/Codex guidance, perception research, motion guidance and skills. Recorded sources and design hypotheses in docs/DESIGN_RESEARCH_2026-11.md.
- Built the selected root application and /studio, a coordinated typographic entrance/route draw, scroll-linked depth, sticky detail route, linked marker inspection, optional timestamp-based replay, activity transitions, motion controls and a static reduced-motion alternative.
- Added exact GSAP 3.15.1 with same-origin assets/notices and self-hosted OFL Instrument Serif. Cached SVG geometry and changed cursor movement to update markers/readouts rather than redraw the full route/chart.
- Preserved blank required responses, conditional location, draft recovery, error/offline retry and source provenance. Corrected section history rebuilding, redundant entry dock and keyboard/result visibility. Latest QA is in docs/QA_REPORT.md.

## Not implemented

No verified private online deployment or provisioned cloud database, scheduled/background Garmin sync, manual strength entry/check-in or unified session calendar. Authentication/cloud storage code is prepared but unverified against live Supabase; credentials/setup are deferred by owner direction. Local Garmin and MASS libraries remain usable. Public Vercel stays synthetic and its Gemini generation is disabled. No live Gemini generation, personal-data AI analysis, physiological body/strength analysis or generated-output quality evaluation is claimed.

## Known owner context

Shubham; iPhone 17 Pro Safari; Forerunner 965 arrived 4 November 2026, with one short walk and no 965 Run yet in the inspected capture. Account also contains older owned FR255 Music activities, including running. Garmin is future recording source; strength logging need not rely on Garmin; Strava social-only; historical NRC/Strava screenshots; MASS weigh-ins. One athlete initially. Supplied screenshots are incomplete history; owner will supply more with dates.

## Verification

F03b: 38 automated tests pass, including nine MASS/data/import/restore/HTTP tests.
The real supplied file passed browser import/reload/re-import with no duplicates;
malformed JSON leaves saved data unchanged. Date filters, keyboard cursor,
source reading table, source session classification, motion and mobile navigation
checked. Responsive layouts: 320, 393, 768 and desktop; no page overflow or short
nav/button targets in inspected views. Actual complete backup restored to a fresh
private local library. No owner check-in answers or hosted personal data created.
No actual iPhone, 200% text or performance claim for this increment. See F03b.

F05a: 29 automated tests pass, including window/source/duration rules, evidence
privacy, strict schema/reference/claim rejection, mocked Interactions parsing,
cache/single-flight behavior, missing key/quota handling, HTTP origin/body guards
and synthetic public-preview links. Foundation checks and diff whitespace pass.
Actual overview checked at phone and desktop; mocked review checked at 320,
393, 768, 1440 and 1920px without horizontal overflow or short nav/button targets.
History/type filters, keyboard session link and mobile return navigation checked.
Separate loopback fixtures verify rendered review/citations/chart/provenance,
invalid-response retry and empty history; they make no provider requests.
Missing-key lab state is verified against the actual local app. Live Garmin
refresh passed. OS reduced-motion guards are implemented; the manual motion
toggle was exercised. No physical Safari, 200% text or performance benchmark is
claimed for this new overview. See features/F05-training-intelligence.md.

F03a: 20 local tests pass. Auth HTTP tests are mocked; PostgreSQL RLS and storage
policies run via PGlite with synthetic Supabase schemas. Actual provider and
iPhone checks are pending. `check:cloud` reports missing cloud variable names.

F04a: 14 automated tests pass. Live account sync and repeat idempotency verified;
real-data browser checks are recorded in features/F04-garmin-local-sync.md.

F02a: ten automated tests pass, including disk reload and backup restore. Browser
FIT import/reload/re-import and expanded-map zoom/time inspection checked on phone
and desktop. Same-origin POST rejection and invalid-feedback rejection verified.

Latest athletic iteration: seven automated tests and foundation checks pass;
nine responsive layouts, ten phone states, 200% text/reduced motion, replay and
keyboard synchronization, screenshot-only source and check-in validation checked.
See docs/QA_ACTIVE_DESIGN.md. Evidence below describes the preceding folio pass.

Six prototype tests and foundation/token checks pass. Browser review covered ten requested responsive layouts from 360 to 2560px and landscape, twenty state/width cases, five imported source layouts, 200% text/reduced motion, replay/pause, marker inspection, activity switching/back, section navigation, draft recovery and check-in retries. Browser rounding differences are recorded separately. No physical iPhone Safari, observed owner timing, Core Web Vitals/frame-rate benchmark, production persistence or production sync is claimed. See docs/QA_REPORT.md.

## Next action

Review the proposed database v2 design with the owner before implementing migrations and populating personal records.

## Inputs needed at the next increment

Gemini/Vercel/Supabase credentials will be supplied later; keep progressing on local product features. Billing is confirmed active and only synthetic model inputs are authorized. Later owner visual feedback, actual iPhone Safari and timed check-ins remain useful. A normal outdoor FR965 Run will validate additional device fields. Future screenshots arrive with dates. Do not request passwords or paste keys into chat.

## Open decisions

Final visual treatment for selected B; exact production runtime/hosting; remote visibility; production API retry/rate-limit/expiry behavior and 965 running coverage. Initial list/detail/download endpoints are now verified for this account. Do not re-ask settled ownership, screenshot-date or Strava-role questions.
