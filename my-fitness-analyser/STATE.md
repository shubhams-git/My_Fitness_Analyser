# Current state

Updated: 5 November 2026 (Australia/Sydney)
Active increment: F04a Garmin local sync (features/F04-garmin-local-sync.md)

## Completed

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

No private online deployment, cloud database, scheduled/background Garmin sync, MASS import UI or application authentication. Explicit local Garmin sync and manual FIT imports support disk-backed check-ins and backup restoration. Reference/synthetic samples remain labelled previews.

## Known owner context

Shubham; iPhone 17 Pro Safari; Forerunner 965 arrived 4 November 2026, with one short walk and no 965 Run yet in the inspected capture. Account also contains older owned FR255 Music activities, including running. Garmin is future recording source; strength logging need not rely on Garmin; Strava social-only; historical NRC/Strava screenshots; MASS weigh-ins. One athlete initially. Supplied screenshots are incomplete history; owner will supply more with dates.

## Verification

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

Prepare the private online environment so the owner can access the real-data library from the iPhone.

## Inputs needed at the next increment

Owner visual/motion feedback on Field Notes; later an actual iPhone Safari pass and five timed check-ins. A normal FR965 Run will eventually validate that device's running-field coverage; current running samples are from FR255 Music. Future screenshots will arrive with dates. Production storage/authentication and hosting remain later work. Do not request passwords or paste keys into chat.

## Open decisions

Final visual treatment for selected B; exact production runtime/hosting; remote visibility; production API retry/rate-limit/expiry behavior and 965 running coverage. Initial list/detail/download endpoints are now verified for this account. Do not re-ask settled ownership, screenshot-date or Strava-role questions.
