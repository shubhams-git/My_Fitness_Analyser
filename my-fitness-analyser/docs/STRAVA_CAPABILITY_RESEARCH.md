# Free training instruments: reference and delivery map

Reviewed 8 November 2026 against Strava's official Help Center. These are
original features using the member's own imports, not access to Strava's paid
service or copies of its private algorithms. No Strava API or new paid service
is introduced. Existing Garmin/Gemini free-tier availability remains subject to
their own quotas. Ordinary chart viewing makes no Gemini request.

## Reference inventory

The [subscription inventory](https://support.strava.com/en-us/articles/15402044-what-features-are-included-in-a-strava-subscription)
groups paid features into segments, training, exploration, recording and perks.
The table maps that inventory rather than suggesting every item is a chart.

| Reference capability | Application equivalent / delivery state | Data and boundary |
|---|---|---|
| Training log | Delivered: monthly calendar, sport filter, exact day sessions and detail links | Canonical dated activity summaries; multiple sessions on a day stay separate |
| Cumulative stats | Delivered: distance/time month comparison, calendar inspection and daily value table | Imported window only; preceding calendar month, not preceding nonempty month; current month ends today |
| Best efforts | Delivered: fastest elapsed windows at nine benchmark distances, pace-distance curve and top-three records per benchmark | GPS plus monotonic timestamp/distance stream; screenshot summaries do not qualify; imported records, not lifetime PRs |
| Pace analysis | Existing recorded time trace; delivered focused/full-range switch and time-at-pace distribution | Source samples; omitted tail counts disclosed; no inferred race threshold |
| Workout/lap analysis | Existing source kilometre splits, recorded laps and linked time-block inspection | Provider splits and elapsed sample blocks retain separate bases |
| Heart-rate analysis | Existing HR trace; delivered time-weighted HR distribution | Fixed numerical bands, explicitly not personalised training zones |
| Custom HR / pace zones | Next analytics increment: owner-supplied boundaries with effective dates | Needs member-reviewed zone settings; do not use age-derived defaults or infer thresholds from these short runs |
| Relative Effort | Planned original duration × session-RPE load with a named, versioned method | Needs complete explicit effort answers and duration coverage; not labelled Strava Relative Effort |
| Fitness/Freshness | Deferred until representative load history exists | An impulse-response calculation is not measured fitness/readiness; display model assumptions and coverage, never invented physiology |
| Matched activities | Planned conservative GPS route matching + compatible-basis pace history | Must compare shape, direction, endpoints and distance; screenshots' similar thumbnails do not establish a GPS match |
| Grade Adjusted Pace | Deferred: transparent terrain adjustment estimate after elevation-quality checks | Requires distance/elevation streams and validated smoothing/grade method; no claim of Strava GAP equivalence |
| Power curve / weighted power / FTP zones | Deferred, sport-specific | Requires measured power and reviewed FTP; running/weight data alone do not justify manufacturing cycling watts |
| Custom goals | Planned member-owned weekly/monthly distance/time goal | Requires saved goals/revisions, not a preset target chosen by the UI |
| Training plans | Future explicit planning surface | Not generated from incomplete history or presented as a guaranteed result |
| Personal heatmaps | Planned private route-frequency overlay on existing street basemap | Requires multiple real GPS routes; only one eligible running route in the audited snapshot |
| Create / suggested routes | Existing map explores recorded routes; route planning is separate | Needs routing engine/licensing and pedestrian constraints; a recorded route replay is not turn-by-turn navigation |
| Offline maps | Not delivered | Requires service-worker tile policy, provider permission, storage controls and offline-device verification |
| Overall / filtered leaderboards | Outside this private app's available data | Requires a real, consented community/segment dataset; no fabricated rankings |
| Segment comparisons / live segments | Personal segment timing is a future feature; device live integration not delivered | Needs segment definitions, matching tolerance and supported recording/device integration |
| Group challenges | Future optional private challenge | Real members, consent and goal rules; no simulated friends |
| Beacon / live performance | Not delivered by this post-session analysis app | Requires live location permission, recipients, recording/background support and safety/reliability design |
| Weather | Future optional historical context | Needs timestamp/location precision and a permitted weather source; never guessed from date alone |
| Recover Athletics / partner perks / app icons / priority support | Separate services, not replicated | No claim that their services are unlocked here |

## Individual primary references and implications

- [Training Log](https://support.strava.com/en-us/articles/15402077-training-log):
  weekly visual history with date navigation and sport/measurement filters. Our
  calendar instead uses explicit dates and opens real sessions, with unknown
  import gaps kept distinct from rest days.
- [Best Efforts](https://support.strava.com/en-us/articles/15401661-how-do-best-efforts-work-for-running-on-strava):
  GPS-based elapsed timing and historical comparisons. Our nine benchmarks are
  400 m, 1 km, mile, 2 km, 2 miles, 5 km, 10 km, half marathon and marathon.
  Timestamp gaps over 15 seconds conservatively split eligible recordings.
- [Pace analysis](https://support.strava.com/en-us/articles/15401806-pace-speed)
  and [pace zones](https://support.strava.com/en-us/articles/15402116-how-does-pace-zone-analysis-work-on-strava):
  Strava's training-zone analysis depends on performance settings/GAP. Our fixed
  pace-band distribution is deliberately descriptive, not threshold advice.
- [Custom heart-rate zones](https://support.strava.com/en-us/articles/15401923-how-do-i-customize-my-heart-rate-zones-on-strava):
  custom endpoints are needed for personalised analysis. We do not guess the
  member's physiological limits from an age formula.
- [Relative Effort](https://support.strava.com/en-us/articles/15401794-what-is-relative-effort-on-strava)
  uses heart rate/perceived exertion. Our prospective load model must declare its
  own inputs and cannot claim to reproduce that proprietary score.
- [Fitness & Freshness](https://support.strava.com/en-us/articles/15402032-how-fitness-freshness-is-calculated)
  uses accumulated training impulses. A handful of recent wearable sessions is
  not enough to populate a credible long-term fitness curve.
- [Matched activities](https://support.strava.com/en-us/articles/15401955-how-do-i-view-my-matched-activities)
  considers route identity/direction/distance. Source timing bases and GPS
  completeness must also be compatible in this application.
- [GAP](https://support.strava.com/en-us/articles/15402117-what-is-grade-adjusted-pace-gap-on-strava)
  estimates flat-equivalent pace from grade. A screenshot elevation total cannot
  supply the underlying terrain series.
- [Power](https://support.strava.com/en-us/articles/15402161-power)
  includes duration power curves and FTP distributions; these need recorded watts
  and calibrated settings rather than extrapolation from pace.
- [Personal heatmaps](https://support.strava.com/en-us/articles/15402028-personal-heatmaps)
  combine GPS history and date/sport filters. This app's basemap is already real
  OpenStreetMap geography, with source attribution retained.

## Calculation and presentation rules

`recorded-progress-v1` operates on already canonical owner-scoped activities.
All fields remain in their source units; aggregation does not rewrite records.
Best-effort results are approximate interpolated windows in elapsed samples,
and stationary time inside a window counts. A reset, missing position/distance,
non-increasing time, gap >15 s or interval speed >12 m/s splits the stream.
One result per activity/distance prevents a single run filling all podium places.

Cumulative totals use steps, not a smoothed curve that invents distance between
training days. The body-weight trend remains a separately labelled smoothed
estimate with actual observations and a held tail; these charts have different
mathematical meanings and should not share an arbitrary smoothing treatment.

Distribution intervals use the last observed sample for at most 15 s. Unknown
or stationary pace is unclassified. Percentages use covered time, with the
unclassified duration visible. Fixed bands do not imply personalised zones.

Focused pace scaling only activates when extreme tails dominate a sufficiently
large recording. It reveals its omitted sample count; full range is one action
away. Selection still reports original values and does not move the map camera.
