# F01: Design and data feasibility

Status: B selected; athletic redesign ready for visual review; physical-device gates pending
Latest iteration: owner liked premium quality but rejected hotel styling. Athletic
Barlow Condensed, carbon/orange/glacier palette, compact session layout, prominent
check-in and linked route/pace replay inspection. See docs/ACTIVE_DESIGN.md and
docs/QA_ACTIVE_DESIGN.md. Previous folio treatment below is historical.
Refinement, 5 November 2026: stronger route/metric hierarchy, ink/champagne Field Notes,
section shortcuts, 200% text review and corrected feedback-result focus. See
docs/DESIGN_RATIONALE.md and docs/QA_REPORT.md. The reference prompt informed this
activity-detail slice; its broad application scope was not adopted.
Owner outcome: choose a mobile activity/check-in design grounded in actual source capabilities.
Scope: authenticated read-only Garmin capture, source inspection, historical/MASS inventory, initial two-prototype study and selected Field Notes design finalization.
Exclusions: production synchronization, database import, deployment, broad screen implementation.
Relevant decisions: R01-R06, D02-D05; source-first sequencing requested in the current conversation.

## Evidence and acceptance

- Passed: real Personal API authentication/list/detail/download; seven original files inspected using the official FIT SDK.
- Passed: source hashes and available summary measurements compared between API and FIT; originals remain private.
- Passed: six screenshots preserved and grouped into two candidate records; dates owner-confirmed, rounding/disagreements retained, absent HR null.
- Passed: MASS structure inspected, including the deleted session marker.
- Passed: two genuinely different populated compositions, shared source selection, synchronized route/chart/time blocks, modal versus inline check-ins, missing-data/failure states and browser responsive/accessibility review. See docs/PROTOTYPE_REVIEW.md.
- Confirmed: owner selected B / Field Notes for all future UI. The new visual treatment remains under review.
- Passed: researched Field Notes redesign, root application and /studio review tools, choreographed motion, replay and preserved data/check-in flows. See docs/DESIGN_RESEARCH_2026-11.md and docs/QA_REPORT.md.
- Pending: actual iPhone Safari and observed owner check-in timing.
- Pending: first 965 Run validation; older owned running files are valid initial data examples, not a substitute for that device-specific check.

## Commands and limits

See `docs/DATA_FEASIBILITY.md` for capture commands and `docs/PROTOTYPE_REVIEW.md` for prototype/browser evidence. `npm run test:prototypes` and `npm run check` pass. Private artifacts include source data, screenshots and browser verification. No production database, background sync or release exists yet.

## Handover

Next action: owner reviews the new Field Notes experience and gives visual/motion feedback before production implementation.
