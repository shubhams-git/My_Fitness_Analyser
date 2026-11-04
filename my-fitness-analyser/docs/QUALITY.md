# Professional quality gates

A gate is evidence, not a statement that the model followed best practices. Apply checks relevant to the current increment; do not invent green checkmarks for unimplemented systems.

## Foundation

Required docs resolve, root instructions remain concise, tokens parse, normal text pairs meet the contrast target, generated CSS matches token JSON. The dependency-free `npm run check` covers only these properties.

## First real-data feature

- Compare decoded distance, duration, timestamps and available HR/splits with the original Garmin summary. Investigate rounding or timer disagreements.
- Meaningful fixtures: paused activity, missing HR/GPS, partial split, invalid file, repeated import, historical ambiguous date, MASS updated/deleted record and day crossing Melbourne daylight-saving boundaries.
- Validate inputs and size limits, prevent unsafe file handling, and preserve raw provenance.
- Save feedback to the real database, reload a fresh browser session and verify recovery. A localStorage demo does not pass persistence.
- Check unauthorized and wrong-owner reads/writes, private file access and server-only credentials.
- Re-import, retry and failed network cannot create duplicates or lose answers. Explicit Pending/Saved/Error states.

## Interface

Inspect actual renders at narrow phone, typical phone, tablet and desktop widths with realistic content; verify overflow, keyboard, focus, text enlargement, empty/loading/error/partial/offline states and reduced motion. Real iPhone Safari testing remains a separate recorded manual pass.

Prototype comparison tests: understand the session result at first glance; reach the check-in with one thumb; complete four decisions and Save without typing; keep source facts distinguishable from interpretation. Map interaction cannot steal all page scrolling. Sheet has non-gesture alternatives.

Adopt reference screenshots after the direction is chosen. Visual diffs are reviewed intentionally: new snapshots are not accepted blindly. Use scrubbed/synthetic data in committed baselines. Automated accessibility tools supplement manual checks, not certify the whole product.

## Performance targets, proposed

Local controls respond immediately; network work runs independently. Target p75 LCP <=2.5s, INP <=200ms, CLS <=0.1 when measurable. For a one-user app without field volume, record lab/device measurements and their conditions rather than pretend field percentiles exist. Profile maps, chart scrubbing and long histories on target hardware. Avoid shipping heavy advanced animation/3D libraries without measured benefit.

## Release

The feature meets its written acceptance examples; relevant automated checks pass; visual review is recorded; outstanding limits are explicit; migration/backup/restore and rollback are proportionate to the change. Private HTTPS access, service terms/quotas and credential setup are verified before use. No unrequested purchases, paid subscriptions or public exposure of health data.

At least one restore test precedes the first real-data release. A deployment URL alone is not proof that authentication, persistence or analytics work.

## Check-in timing protocol

Five representative run logs on the actual iPhone, normal and conditional discomfort paths. Report each observed time; aim <=30s typical and <=45s ordinary upper bound. Exclude optional narrative and upload time transparently. A pilot of five is usability evidence, not a population-level statistical claim.
