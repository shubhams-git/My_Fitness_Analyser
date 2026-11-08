# Remaining work after the visualization release

The initial private app is usable: member login/isolation, NRC history, Garmin
sync/imports, real street maps/replay, check-ins, MASS import, weigh-in and gym
logging, weight coaching and the new recorded visualizations are implemented.
The remaining work falls into six workstreams, not six small fixes.

| Priority / workstream | Next concrete deliverables | Completion condition |
|---|---|---|
| 1. Personal zones and goals | Member-reviewed HR/pace thresholds with effective dates; zone bars per run and aggregated over a chosen period; explicit running and weight goals | Changes are owner-scoped and reviewed; old reports retain their settings version; no threshold or goal is guessed from a reference image |
| 2. Intelligence | Verify a live v3 running brief after the reported free Gemini 503; add bounded run-specific/chart-specific takeaways to the evidence currently on screen | Saved report restores after reload; conclusion, quantities and action concern the same run/pattern; failure remains recoverable and no paid fallback is used |
| 3. Advanced training analytics | Quality-checked terrain-adjusted pace; power-duration curve from recorded watts; transparent longer-term load model after usable rated/zone history | Calculations have defined methods, coverage and edge-case tests; no imitation Strava fitness/Relative Effort score or invented watt stream |
| 4. Data onboarding and additional members | Reviewed NRC/Strava screenshot extraction/publishing UI; duplicate reconciliation; individual Garmin connections; invite the second member; scheduled sync with status/retry | A new member brings only their own sources; operator review is explicit; repeated submissions and syncs do not duplicate activities; owner key is never reused for another member |
| 5. Map development | Private route-frequency heatmap and richer repeat-route comparison; later route planning/offline support if still wanted | Real recorded geography and provider permissions; settings/privacy controls; no synthetic traces or pretend navigation |
| 6. Release/device quality | Physical iPhone Safari, touch/rotation and logging timing; full recovery journeys; screen-reader/zoom checks; measured performance and export/restore drills | Observed end-to-end use on the real device, accessible controls and retained drafts, profiled long recordings, owner-scoped restore verified |

## Next bounded release

Start with member-reviewed zone/goal settings. This unlocks the meaningful version
of the two distribution screenshots without multiplying unrelated dashboard
sections. Verify the existing v3 running brief when the free provider is available;
it does not block deterministic charts or logging.

For zones, obtain settings from the member or a reviewed Garmin configuration.
The reference images show different configured and observed maximum heart rates;
those are different concepts, not interchangeable inputs. The displayed predicted
5 km time also does not establish a goal or calibrated pace model for this app.

## What is optional after the private beta

Training-plan editing, exercise sets/reps/loads, personal route planning, offline
map downloads and private challenges can follow real usage. Global leaderboards,
social segments, live safety sharing and partner perks need a separate community
or service; they are outside this private post-session app's present scope.

No new credential is needed for the delivered visualizations. Billing remains
unchanged. Future routing/offline services need a separate provider decision;
they are not silently added as paid dependencies.
