# Data contract, conceptual v0.1

The private v1 schema and additive v2 activity-evidence slice are installed.
See F06 and STATE.md for population/verification status; other domains and hosted
UI cutover remain staged. Preserve these invariants across later migrations.

## Canonical activity

Owner ID; internal ID; sport; start instant in UTC and original timezone/local date; provider summary values; elapsed/timer/moving durations kept distinct; distance in metres; nullable HR/cadence/elevation; source references; raw-object hash; schema/parser version. Workout feedback is separate and remains editable without changing provider data.

Source-provided values, derived results and user answers have distinct provenance. Keep source summaries and independently derived measurements when they disagree; do not silently substitute. Convert units at the boundary. Preserve precision internally and round at display.

## Source strategy

1. Original Garmin FIT/API for future recorded activities. Verify that fields are actually populated.
2. User-supplied historical NRC/Strava screenshots for summary/split evidence; require confirmation of uncertain extraction. Multiple screenshots may describe one workout.
3. MASS JSON: preserve source IDs, dateKey, timestamps, kg, update markers and tombstones. Deleted source rows stay excluded from active totals. An absent row in a partial export is not proof of deletion.
4. User check-ins/notes for subjective context. Do not infer exact RPE from prose or pre-answer symptom status.
5. Versioned training plan imported later; actual completion is distinct from scheduled work.

A historical screenshot may have no exact start timestamp. Allow a nullable time and explicit date precision rather than inventing midnight as an observed start. “Today” in a screenshot needs a reliable capture date or owner confirmation. Displayed partial split distances may be rounded; mark them approximate until an original file is obtained.

## Deduplication and updates

Exact stable provider ID or content hash first. A Garmin activity and its Strava mirror are aliases of the same activity. Fuzzy date/duration/distance matching proposes a merge; ambiguous cases require review. Preserve disagreements and allow correction/unmerge. Repeating an identical import creates no new canonical records or duplicate feedback.

Parse and validate before commit. Batch transactions/rollback boundaries prevent partial corruption. An OCR extraction is a suggestion until confirmed, not a new measurement. Keep input provenance and errors; retry is safe.

## Streams

Store timestamped coordinates/measurements where present. Do not reconstruct a precise series by tracing an image chart. Preserve pause/events, missing samples, gaps, invalid markers and device-specific fields. Downsample only for display; metrics use the chosen validated series and documented eligibility rules.

## Historical evidence available

Earlier NRC/Strava images and the new NRC overview/detail folders are preserved
as private evidence; images are grouped into canonical workouts rather than
counted as sessions. F06 records the import/recovery method; personal counts and
field-level source links remain in private manifests. MASS export and Garmin
FIT/API captures have also been inspected locally. Do not confuse local evidence
with completed cloud population of those other domains.

## Future metrics

Best effort requires a specified distance-window algorithm, elapsed/timer rule, valid distance stream, tie rules and imported-history coverage. Geographic segment matching is a separate problem. HR drift requires eligible time-series and session conditions; it is not inferred from pace splits. Never derive injury probability, tibial force saved or fixed speed gain from weight loss.

## Security and recovery

Owner isolation covers database rows, private files, analytics and any AI evidence bundle. Store personal data outside source control. Tests use synthetic fixtures. Keep an export format with schema version and a verified restoration path. Do not log tokens or full GPS traces. An AI-generated note has no authority to execute SQL, alter plans or change source data.
