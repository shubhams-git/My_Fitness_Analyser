# F15 — Recorded run visualizations

9 November 2026. Owner supplied ten Strava reference screenshots and requested a
stronger visual analysis experience plus a clear remaining-work review. Extend
Field Notes; keep the focused Training home. No new dependencies, database
migration, paid service or model request. Work directly on master.

## Delivered slice

- Large metric explorer: pace, heart rate, cadence, elevation and running power,
  shown only when recorded. Filled traces and a muted, independently scaled
  terrain overlay. Distance/time controls, touch/pointer inspection, keyboard
  arrows/Home/End and linked geographic cursor. A chart selection preserves exact
  source values; no physical range slider competes with the figure.
- Visible pace/HR distribution for the selected metric, rather than a buried
  disclosure. These remain descriptive bands; personal zones need settings.
- True kilometre splits, interpolated from distance/timestamps, with pace bars,
  time-weighted heart rate and elevation change. Sample gaps invalidate the
  affected split; stationary time counts. Device laps and minute blocks remain
  available in a separate native disclosure.
- Per-run results for six useful distances when covered: 400 m, half mile, 1 km,
  mile, 2 miles and 5 km. Each result opens that benchmark and run in Progress.
- Best-effort Analysis and Top 10 views. Exact result selector, previous/next,
  elapsed-time history, daily-best guide line, actual improvements over earlier
  dates and source run links. Same-day order is not inferred. Ten benchmarks
  include the newly supported half mile. Calculation version recorded-progress-v4;
  visualization/split version activity-instruments-v1.
- Phone metric navigation stays in one scrollable row. The check-in dock steps
  aside while session details are being inspected, preserving chart visibility.
  OS and explicit reduced-motion settings both disable the new area transition.

## Reference decisions

Photos 1/2 informed results and chronological benchmark inspection; 3/7/9 informed
terrain-backed traces; 4/8 informed readable distribution bars. Photo 10 reinforces
a short useful finding close to evidence. Photo 6's fitness score is not copied:
the current effort coverage does not justify a physiological or proprietary score.
No screenshot thresholds, predicted race times, achievements or summary numbers
were silently adopted as this member's settings or inserted as duplicate runs.

## Verification

99 tests pass, including seven new cases covering split interpolation/partial
distance, paused timing, gaps/resets, metric and distance selection, focused/full
range, zero power, device summaries and same-day comparison ordering. Foundation
checks and whitespace checks pass. Read-only owned-data loopback view and labelled
synthetic benchmark history exercise the available/empty cases. Narrow-phone
320 px review verifies no page overflow, normal-size controls, keyboard time
inspection and dock removal during analysis. Responsive browser review is not
physical iPhone Safari verification.

One final Impeccable source scan reports eight shared legacy-style findings:
two gradient-text, one pulsing-dot, two dark-glow, two grid-background and one
repeating-stripes. No new detector rule was introduced by the instrument modules.
The scan follows existing shared styles; it is not reported as a clean run.
No new heuristic score or injected overlay is claimed.

Initial release de14224 was deployed successfully. New assets return 200;
anonymous training stays 401. Live owner 5 km data supplies all five charts,
HR distribution and kilometre splits, with no captured console errors.

Live verification identified a real edge case: the watch recorded distance/time
before the first GPS fix; the remaining GPS-only distance was 4999.66 m. Retain
only a brief measured initial prefix (at most 15 s / 50 m), leaving subsequent
missing positions/gaps ineligible. This recovers the observed 5 km window at
1962.811 s (32:43), matching the supplied reference, without adding coordinates
or rounding 4999.66 up to 5000. Regression checks cover delayed initial fixes and
mid-run losses. A fresh private export was read solely for this check; no account
row or activity was changed. Final v4 deployment verification pending.

Local servers stopped and temporary viewport overrides reset.

## Next

Member-reviewed pace/heart-rate zones and goals, with effective dates. See the
[remaining work review](../docs/REMAINING_WORK_2026-11-09.md). The previously
reported Gemini v3 HTTP 503 verification item is still open; this slice makes no
new Gemini request and does not relabel deterministic chart observations as AI.
