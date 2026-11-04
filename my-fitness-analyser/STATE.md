# Current state

Updated: 5 November 2026 (Australia/Sydney)
Active increment: F01, prototypes ready for owner review (features/F01-design-and-feasibility.md)

## Completed

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

## Not implemented

No production application UI, database importer, Garmin sync, MASS live integration, application authentication or cloud deployment. Two local browser-only prototypes now exist; check-ins do not write real training records. Design selection and runtime stack remain open. Initial authenticated retrieval is verified, not background sync or durable application storage. No new third-party skill was installed.

## Known owner context

Shubham; iPhone 17 Pro Safari; Forerunner 965 arrived 4 November 2026, with one short walk and no 965 Run yet in the inspected capture. Account also contains older owned FR255 Music activities, including running. Garmin is future recording source; strength logging need not rely on Garmin; Strava social-only; historical NRC/Strava screenshots; MASS weigh-ins. One athlete initially. Supplied screenshots are incomplete history; owner will supply more with dates.

## Verification

Windows/Node v26.5.0: npm run check and five npm run test:prototypes cases passed. Browser review covered both directions at nominal 360/393/440/768/1440 widths, twenty scenario cases, larger-text/reduced-motion overrides, check-in recovery and linked inspection. Browser evidence retains requested versus measured dimensions. Earlier seven FIT/API comparisons and capture hashes also passed. See docs/PROTOTYPE_REVIEW.md and docs/VERIFICATION.md. Actual iPhone Safari, observed owner timing, database persistence, production sync and restore remain unverified.

## Next action

Review the two populated prototypes with the owner and select the visual direction to refine.

## Inputs needed at the next increment

Owner visual choice and feedback; later an actual iPhone Safari pass and five timed check-ins. A normal FR965 Run will eventually validate that device's running-field coverage; current running samples are from FR255 Music. Future screenshots will arrive with dates. Production storage/authentication and hosting remain later work. Do not request passwords or paste keys into chat.

## Open decisions

Visual direction; exact runtime/hosting; remote visibility; production API retry/rate-limit/expiry behavior and 965 running coverage. Initial list/detail/download endpoints are now verified for this account. Do not re-ask settled ownership, screenshot-date or Strava-role questions.
