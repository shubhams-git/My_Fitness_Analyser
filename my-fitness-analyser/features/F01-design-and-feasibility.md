# F01: Design and data feasibility

Status: designing; initial data feasibility verified
Owner outcome: choose a mobile activity/check-in design grounded in actual source capabilities.
Scope: authenticated read-only Garmin capture, source inspection, historical/MASS inventory, two visual prototypes.
Exclusions: production synchronization, database import, deployment, broad screen implementation.
Relevant decisions: R01-R06, D02-D05; source-first sequencing requested in the current conversation.

## Evidence and acceptance

- Passed: real Personal API authentication/list/detail/download; seven original files inspected using the official FIT SDK.
- Passed: source hashes and available summary measurements compared between API and FIT; originals remain private.
- Passed: six screenshots preserved and grouped into two candidate records; dates owner-confirmed, rounding/disagreements retained, absent HR null.
- Passed: MASS structure inspected, including the deleted session marker.
- Pending: two genuinely different populated compositions, missing-data/failure states, responsive/accessibility review and owner selection.
- Pending: first 965 Run validation; older owned running files are valid initial data examples, not a substitute for that device-specific check.

## Commands and limits

See `docs/DATA_FEASIBILITY.md` for capture/inspection/verification commands and official sources. Private artifacts include an owner review and verification records. No application database, live background sync, browser test or release exists yet.

## Handover

Next action: build the two Activity Detail/Quick Check-In prototypes from the inspected field capabilities and compare them with the owner.
