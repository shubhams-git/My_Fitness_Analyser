# Current state

Updated: 4 November 2026
Active increment: F01, design and data feasibility (features/F01-design-and-feasibility.md)

## Completed

- Reconciled current user request with three earlier STRIDE research/brief documents.
- Recorded product contract, candidate visual system, design tokens, data rules, feature workflow and quality gates.
- Rechecked first-party Garmin Personal API documentation, official Garmin source projects, OpenAI agent/skill documentation and relevant design/testing sources.
- Created dependency-free token generator/checks and portable initial Git history.
- Renamed the active project to My Fitness Analyser; updated package identity, documentation, archive paths and Git snapshot.
- Verified live, read-only Personal API authentication, activity list, detail and original-file download using the owner's local .env key. Seven owned activities captured; owner confirmed older entries belong to him.
- Decoded seven original FITs with pinned official @garmin/fitsdk 21.221.0; integrity, capture hashes and available summary comparisons passed. Today's source is FR965; older source is FR255 Music. Optional running fields and irregular sample coverage inspected.
- Preserved six screenshots privately and transcribed two grouped activities, with owner-confirmed dates, explicit rounding/disagreements and missing HR null. Inventoried MASS format 2, including session tombstone and sparse wellness rows.
- Added reproducible capture/inspection/verification scripts and docs/DATA_FEASIBILITY.md. Personal evidence and detailed review are under ignored private-data; no token/key was saved in captures.

## Not implemented

No application UI, database importer, production Garmin sync, MASS live integration, application authentication, cloud deployment or installed third-party skill. Both design directions and the runtime stack remain proposals. Local authenticated Garmin retrieval is verified; it is not background sync or durable application storage.

## Known owner context

Shubham; iPhone 17 Pro Safari; Forerunner 965 arrived today, with one short walk and no 965 Run yet. Account also contains older owned FR255 Music activities, including running. Garmin is future recording source; strength logging need not rely on Garmin; Strava social-only; historical NRC/Strava screenshots; MASS weigh-ins. One athlete initially. Supplied screenshots are incomplete history; owner will supply more with dates.

## Verification

On Windows/Node v26.5.0: npm run check passed; script syntax checks passed; read-only API capture succeeded for seven activities; seven FIT integrity/decoder checks, seven API/FIT summary comparisons and fourteen detail/archive hash checks passed. See docs/VERIFICATION.md and the ignored capture's verification.json. No browser/device, database persistence, production sync or restoration checks have been performed.

## Next action

Build two populated mobile Activity Detail/Quick Check-In prototypes using the inspected Garmin running and historical-source capabilities; compare hierarchy, touch behaviour and missing-data/failure states before selecting one visual system.

## Inputs needed at the next increment

No additional test run is required to start core prototypes. An eventual normal FR965 Run will validate that device's actual running-field coverage; current running samples are from FR255 Music. Future screenshots will arrive with dates. Production credentials/storage configuration and hosting remain later runtime work. Do not request passwords or paste keys into chat.

## Open decisions

Visual direction; exact runtime/hosting; remote visibility; production API retry/rate-limit/expiry behavior and 965 running coverage. Initial list/detail/download endpoints are now verified for this account. Do not re-ask settled ownership, screenshot-date or Strava-role questions.
