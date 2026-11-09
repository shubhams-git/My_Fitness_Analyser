# F19 — Personal running zones

10 November 2026. Extends the approved Field Notes application after F18.

## Delivered

Account → Your running zones provides independent heart-rate and pace settings.
Five HR zones use four ascending start boundaries; six pace zones use five
descending start boundaries. Values start blank. Members enter Garmin, coach or
their own reviewed settings. No max HR, calibration, goal or physiology is inferred.

The inline editor has effective date, declared source, reversible personal/range
mode, immutable history, validation targeting, save/retry and stale-save reload.
Backdated versions are allowed from 1 July 2026. Each run selects the greatest
effective date, then latest revision. Revising an earlier period retains later
periods; same-date corrections retain both original source versions.

Run analysis uses personal zones when matching settings and usable samples exist;
otherwise original recorded ranges remain. Monthly Progress sums time in the zones
effective on each run, with coverage and settings versions. Single-version charts
show ranges; mixed versions omit a misleading common range. Screenshot summaries
remain in history without invented sensor samples or time in zones.

Bars use real seconds, direct labels and table semantics. Largest remainders make
displayed integer shares total 100%, without changing seconds/bar widths. Long
durations use hours/minutes. No proprietary Strava score or model is reproduced.

## Engineering

- Immutable training_zone_versions: owner/kind/revision, effective date,
  boundaries, source, operation UUID, canonical payload and creation time.
- Owner SELECT policy; direct writes denied. A membership-checked RPC with a
  restricted search path is the only mutation path. Caller cannot choose owner.
- Per-kind lock, expected revision and idempotent receipt; browser retry identities
  and drafts are separate by measurement. Save/reload lock tabs and fields.
- JS/SQL validate dates, counts, integers and ordering. Paginated reads have stable
  order. Evidence exports include zone history.
- personal-zones-v1 weights each actual sample up to 15 seconds. Longer gaps,
  absent HR and unusable/stationary pace stay unclassified. Walks and screenshot
  averages do not become running streams.
- No new credential, dependency, paid provider or automatic generation request.
  Existing Gemini reports/prompts are unchanged. Zone-aware AI evidence needs a
  separate explicit contract increment; this release's conclusion is deterministic.

## Design and review

UI/UX Pro Max focused searches guided form recovery and categorical comparison.
Inherit approved Barlow/Manrope, carbon and orange/HR-blue signals. Extend Account,
current run analysis and Progress without another navigation page.

Two independent Impeccable after-reviews found P2s. Re-edits fix measurement links,
all three URL updaters stripping the anchor, disabled-state copy/radio defaults,
error association/focus, reload/save races, cross-measurement retry identity and
validation returning HTTP500. Narrow reviewer rechecks confirm these fixes; no
observed P0/P1. Chart columns, exact pace endpoints and long durations also improve.

One final detector has two inherited linked-CSS warnings (historical distance
gradient and legacy glow) and a grid advisory on account.html. Those selectors do
not style the new Account zone editor/chart in the inspected render; this is not
reported as a zero-warning or whole-app accessibility audit.

## Verification

116 tests pass. New PostgreSQL/PGlite tests exercise two owners, anonymous and
nonmember denial, immutable versions, retries, conflicts, invalid input and
backdating. Deterministic/API tests cover exact boundaries, unequal sampling,
gaps, screenshots, effective/disabled versions, coverage, 100% shares, HTTP400/409,
verified-owner RPC shape, measurement links and empty states. Foundation checks
pass (38 contrast pairs; foundation scope only).

Phone 393×740 and desktop 1280×850 rendered previews cover form/error focus,
both measurements, memory-only saves, turning zones off, earlier classification,
Account/Progress/run links and no horizontal overflow. Preview uses an ignored
owned activity snapshot; test thresholds never enter the live member account.
Physical iPhone Safari is not claimed.

The live additive schema is applied. Catalog: RLS enabled; anonymous RPC denied;
member RPC allowed; zero settings rows. No owner thresholds were guessed or saved.
Existing activity/weight records are untouched. Production verification follows
in STATE.md after deployment.

Garmin supports manually adjusted, sport-specific HR zones:
https://www8.garmin.com/manuals/webhelp/GUID-3A791586-B59F-4B37-B9C5-5A41F8C6BE0B/EN-GB/GUID-30C91919-943C-44E9-8048-901AC0881AEA.html

## Next

Explicit running/weight goals, then zone-aware coaching evidence and chart-specific
findings. October/early-November Strava backfill remains a reviewed intake and must
reconcile canonical runs rather than duplicate Garmin/NRC entries.
