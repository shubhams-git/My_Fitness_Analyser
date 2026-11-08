# Visual analysis selected from the owner's references

The reference set works because each view answers one question with a dominant
figure: how did the run unfold, where did effort change, or how has a particular
distance improved? F15 adopts that hierarchy inside the existing athletic design.
It does not stack ten new panels on Training.

| References | Selected application treatment | Engineering decision |
|---|---|---|
| 1, 2: results / best efforts | Per-run benchmark results linked to a chronological Analysis view and Top 10 | Original GPS elapsed-window calculation; one result per activity/distance; half mile added; previous-best improvement uses strictly earlier calendar dates |
| 3, 7, 9: pace, HR, cadence over terrain | One large selectable metric canvas, with recorded running power where available | Metric and terrain have independent scales; distance/time choice; exact inspection linked to the map; real gaps retained, focused pace clips instead of changing measurements |
| 3: splits | Kilometre pace bars with HR and elevation change, plus separate device laps | Interpolate exact distance boundaries; elapsed pauses count; invalid gaps remain unavailable; final fragments below 100 m omitted |
| 4, 8: zones | Visible descriptive pace/HR bars now; reviewed personal zones next | No silent copy of reference thresholds, HR maximum or predicted race pace. Distribution time uses recorded coverage, with missing intervals excluded explicitly |
| 5, 10: concise intelligence | Preserve one main coach conclusion; short deterministic observations live next to measured charts | New visualizations do not spend model quota. Run-specific Gemini takeaways remain their own schema/evidence increment |
| 6: fitness curve | Do not display a borrowed score from incomplete load history | Current rated coverage is insufficient for the implied physiological meaning. Transparent session-RPE load is available; a longer-term model needs appropriate settings/history |

## Primary references

[Strava Pace/Speed](https://support.strava.com/en-us/articles/15401806-pace-speed)
describes pace/elevation overlays, kilometre splits, recorded laps and configured
pace zones. [Elevation](https://support.strava.com/en-us/articles/15401909-elevation)
explains terrain context alongside effort metrics and the differing altitude
sources. Our muted overlay is the member's recorded elevation, not a fabricated
terrain illustration or a third-party corrected altitude service.

[Best Efforts](https://support.strava.com/en-us/articles/15401646-what-are-best-efforts-on-strava)
describes per-activity results, benchmark performance history and annual analysis.
Our application uses its own elapsed-window method and the member's available
history from July 2026. The guide line connects each day's best; individual results
remain dots and the exact selector/list stays available. It is not a fitness curve.

[Athlete Intelligence](https://support.strava.com/en-us/articles/15401629-athlete-intelligence-on-strava)
places interpretation close to the metrics. The app's new deterministic chart
notes are not labelled as Gemini output. The existing AI pipeline and its
outstanding v3 provider verification are documented separately.

## Source boundaries

The supplied screenshots are visual references for this release, not authorization
to create a second copy of their physical run. Garmin timer/elapsed values and
Strava moving-time summaries can differ. F15 keeps each underlying source value;
it does not change Garmin timing to force agreement with a screenshot.

NRC screenshot-only activities retain their summaries and split bars. HR, cadence,
power and continuous stream plots appear only with the underlying recordings.
Full-period comparisons, shared member settings and fictional trophies are not
manufactured to fill an attractive layout.

## Real-record acquisition edge case

The live 5 km run exposed a useful distinction: GPS coordinates start after the
watch has already recorded a short distance/time prefix. The GPS-only span is
34 cm under 5 km, despite a full continuous recorded-distance series covering the
benchmark. V4 retains a measured initial prefix of at most fifteen seconds and
fifty metres. This recovers the 32:43 benchmark without rounding distance upward,
inventing positions or relaxing later missing-GPS/gap rules. Delayed fixes and
mid-run losses have separate regression cases. Route rendering still leaves
missing positions missing.
