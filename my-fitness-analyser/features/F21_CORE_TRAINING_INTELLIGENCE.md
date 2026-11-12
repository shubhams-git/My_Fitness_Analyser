# F21 — Core training intelligence, Release 1

Training and Progress show the recorded activity history before optional goals
or coaching. This increment adds no dependencies, migrations or integrations.

- Training shows seven-day running volume and days with a recorded run, the
  latest activity, and a 28-day workout mix. Recent Journal strength entries
  stay separate because a watch recording may cover the same workout.
- Progress compares the last 7 and 28 calendar days with their immediately
  preceding windows. Totals show how many recorded runs supplied each
  measurement. It shows the longest recorded run within the selected history,
  compares the longest runs across the two 28-day windows, and links to the
  recorded run behind a descriptive pace difference.
- The pace comparison uses an outdoor recording and at least two earlier runs
  from the same source and run type, with matching pace and duration bases and
  distance within 20%. The baseline is the median of up to five eligible runs.
  Conditions and effort can differ. Distance and time totals describe the
  available record, including historical summaries where measured; a gap
  cannot show whether the athlete trained. Treadmill and cycling distances
  never contribute to running totals. All activities compares recorded time.
- FIT, Garmin and historical summary provenance is retained; sample-based
  zones, routes and best efforts never come from screenshots. Read-time
  deduplication uses canonical IDs, explicit legacy aliases, Garmin IDs and
  source hashes. Similar dates or distances alone do not merge activities.
- Hosted coaching keeps the existing consent scope: outdoor Garmin metrics and
  bounded workout context, with no screenshot data, identities, raw sensor
  streams, GPS coordinates or notes. Recent volume and measurement coverage,
  comparable pace, structured effort and strength context can support a next
  action. Paused and planned goals stay outside coaching evidence. If a
  check-in reports that discomfort affected a workout within the last 14 days,
  or on the latest eligible run, a recorded response replaces generated advice
  without calling Gemini. The same applies to the recorded-data fallback when
  no outdoor Garmin run is available in the last 28 days. Existing saved briefs
  remain readable as historical reports when the record changes.

Recorded duration retains timer, running, moving or elapsed basis. Comparing
aggregate time across sources does not imply equivalent effort. Same-day
strength entries from multiple sources can be ambiguous: Training keeps the
Journal count separate; coaching uses the existing conservative Journal-first
context on overlapping days. Nothing in this release estimates recovery,
physiological thresholds or injury risk.

## Subsequent work

1. Optional race objectives: add owner-scoped, dated objectives with custom
   distance and event date. Support create, edit, pause and remove while
   preserving history. Evaluate them against the existing activity projections
   only when active; never require them to calculate training or progress.
2. Recovery: first assess coverage for sleep, HRV and subjective signals.
   Preserve measurement provenance and missing days before showing trends.
3. Automatic sync: use the existing member-scoped connection, deduplication
   and sync lease. Add scheduling, safe retries and visible last-success status.
4. External strength logs: use a source-specific import adapter with stable
   workout/revision identity and owner isolation. Keep workout summaries
   compatible with Journal and Training; retain structured exercises, sets,
   reps, resistance and original units, durations, dates and private notes
   alongside them once a real format is known. A date is not an identity:
   separate workouts on the same day can be legitimate. No schema is needed
   until an actual source and sample export are selected.

## Verification

Local project suite and foundation checks passed. Independent Impeccable
review and Chromium fixture checks covered phone, narrow phone, tablet,
desktop, landscape, empty history and 200% text. Follow-up checks confirmed
the navigation, Sessions heading and comparison table no longer cause
page-wide overflow at enlarged text. No production writes or provider calls
were made. Physical iPhone Safari was not tested.
