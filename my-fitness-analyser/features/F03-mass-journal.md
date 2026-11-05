# F03b: MASS body and session journal

Implemented locally, 5 November 2026. The owner asked to keep progressing while
Gemini, Vercel and Supabase credentials are deferred. Advance the missing MASS
slice of the first usable release rather than wait on external services.

## Delivered

- `/journal`, linked from training and activity detail, uses the selected athletic
  identity, a recorded-weight chart, keyboard/touch inspection, source readings,
  seven-day mean, date windows and a MASS session log.
- The supplied format 2 export is imported locally: 29 weight readings, four
  active sessions and one retained deletion marker. Two active focus labels are
  Cardio; two are known strength labels. They are labelled separately, not all
  called strength workouts. No cross-provider merge is inferred from dates.
- Review before import shows new/updated/deleted/unchanged/older rows. Repeating
  the real import reports 29 unchanged weights and five unchanged session rows,
  with no duplicates. The fifth session is a tombstone, not an active workout.
- Original JSON, normalized rows and source update/deletion times enter the
  existing atomic local library. Complete export/restore now includes MASS.
  Earlier backups without MASS preserve a current MASS journal on merge restore.
- Public preview uses generated data only; it has no import action. Private
  cloud journal support is explicitly unavailable until a later cloud increment.

## Data rules

This adapter supports the **inspected MASS format 2**, not an assumed universal
API. Validate app/format, real dateKey, stable IDs, numeric kg, update/deletion
timestamps, session focus, nullable duration, field lengths and file/row bounds.
dateKey is the source calendar day; source t is retained independently. Never
replace the day with a timestamp interpreted in the computer's timezone.

One source ID per collection. The highest update/deletion revision wins. Equal
revision with different content rejects the whole import. Older versions are
skipped. Explicit tombstones exclude active rows and prevent old exports from
reviving them. Missing rows in partial exports do not delete anything. Ambiguous
same-day activity matches with Garmin are not merged or added to Garmin volume.

The chart uses daily averages when a date has multiple weigh-ins. Each recorded
day gets one vote in a trailing seven-calendar-day mean; at least three recorded
days are required. Missing days are not imputed. Seven-day calculations include
available earlier history even when part lies before the selected view window.
Lines break across gaps longer than seven days. The axis is explicitly zoomed
to the recorded range. History change compares the first and last daily values
in the selected range and is null with fewer than two days. No body-composition,
readiness, calorie or fitness-improvement claim follows from weight change.

MASS focus labels Cardio and known strength labels are classified conservatively;
unrecognized focus stays a generic Session. No sets, loads or reps are fabricated.
Profile goals, nutrition, measurements and wellness are not shown or analysed.
The **whole original export** is retained privately as backup evidence, including
those unmodelled fields. It never enters Gemini or the public preview.

## Import and recovery

Same-origin loopback POSTs only. Preview validates without saving. A random
server-held token lasts ten minutes, with at most four staged files; commit
checks the normalized journal digest again to reject stale previews. A token's
concurrent/retried commit shares one result. File limit 10 MB; maximum 10,000
weight/session rows. Original input hashes are verified during restore and
canonical rows are reconstructed from originals before any library mutation.

Restore merges newer local revisions, preserving current data; it is not a
destructive reset. Use activity detail's existing Restore action to restore a
complete-library export. A private pre-import snapshot and a fresh post-import
restore were retained under ignored private-data/qa/mass. Health data is not in
Git. This is local disk persistence, not provisioned Supabase storage.

## Verification

Nine MASS tests cover parsing/units/dateKey/DST boundaries, duplicate IDs,
updates/conflicts, deletion/resurrection rules, partial exports, daily/rolling
math, missing duration, original/hash verification, fresh-library recovery,
synthetic public data, read-only review, stale preview and isolated HTTP commit
retries/origin rejection. The complete suite has 38 passing tests.

Actual UI import/reload/re-import, invalid JSON recovery, source classification,
pointer date-window changes, keyboard chart inspection and motion toggle were
checked. Empty history was rendered before first import. Responsive checks at
320, 393, 768 and desktop widths show no page overflow or short nav/button targets.
The decorative hero gradient initially blocked pointer filters; pointer handling
was corrected and the actual click flow rechecked. Original Garmin detail still
opens with journal navigation. No physical iPhone Safari, 200% text certification,
live cloud or performance benchmark is claimed.

The local complete-library restore verified seven Garmin activities, 29 weight
readings and four active MASS sessions. No owner effort/symptom answers were
generated. No new dependency was introduced.

## Design decisions and limits

Keep existing Barlow Condensed/Manrope, carbon, orange and glacier tokens. Once
history exists, shorten introductory copy so records take precedence. Use the
recorded trace, neutral change values and explicit coverage instead of a weight
loss score. Exact physiology remains outside this feature.

UI/UX Pro Max searches returned generic dashboard/gateway recommendations rather
than a verified fit for this journal. The existing accepted identity and the
skills' general interaction/chart/accessibility guidance were used as fallback;
no generated palette or generic landing-page pattern was adopted.

The table currently renders the selected history without pagination; import
limits are safety bounds, not a tested large-history performance guarantee.
Manual strength logging/check-ins and a unified session calendar remain next.
