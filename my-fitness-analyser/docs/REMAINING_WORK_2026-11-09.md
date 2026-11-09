# Remaining work after the visualization release

The initial private app is usable: member login/isolation, NRC history, Garmin
sync/imports, real street maps/replay, check-ins, MASS import, weigh-in and gym
logging, weight coaching and the new recorded visualizations are implemented.
The remaining work falls into six workstreams, not six small fixes.

10 November: F19 delivers personal HR/pace settings with effective dates and
per-run/monthly charts. Values await member entry. Explicit goals are next.
Missing October/early-November Strava history remains reviewed backfill; imports
must reconcile existing canonical runs.

F16 additionally delivers the requested satellite overview/descent/follow replay,
with no new key or billed provider. Its free 10 m imagery is coarser than premium
city aerial imagery; a sharper licensed provider remains optional. The six
workstreams below remain the broader roadmap.

| Priority / workstream | Next concrete deliverables | Completion condition |
|---|---|---|
| 1. Personal goals (zones delivered) | Explicit running/weight goals and progress; member enters reviewed zones in Account | Goals are owner-scoped, dated and deliberate; no target is guessed from a reference image |
| 2. Intelligence | Verify a live v3 running brief after the reported free Gemini 503; add bounded run-specific/chart-specific takeaways to the evidence currently on screen | Saved report restores after reload; conclusion, quantities and action concern the same run/pattern; failure remains recoverable and no paid fallback is used |
| 3. Advanced training analytics | Quality-checked terrain-adjusted pace; power-duration curve from recorded watts; transparent longer-term load model after usable rated/zone history | Calculations have defined methods, coverage and edge-case tests; no imitation Strava fitness/Relative Effort score or invented watt stream |
| 4. Data onboarding and additional members | Reviewed NRC/Strava screenshot extraction/publishing UI; duplicate reconciliation; individual Garmin connections; invite the second member; scheduled sync with status/retry | A new member brings only their own sources; operator review is explicit; repeated submissions and syncs do not duplicate activities; owner key is never reused for another member |
| 5. Map development | Private route-frequency heatmap and richer repeat-route comparison; later route planning/offline support if still wanted | Real recorded geography and provider permissions; settings/privacy controls; no synthetic traces or pretend navigation |
| 6. Release/device quality | Physical iPhone Safari, touch/rotation and logging timing; full recovery journeys; screen-reader/zoom checks; measured performance and export/restore drills | Observed end-to-end use on the real device, accessible controls and retained drafts, profiled long recordings, owner-scoped restore verified |

## Next bounded release

Next: explicit goals, building on the delivered zone editor and distributions.
Later extend the AI evidence contract without rewriting saved reports.
Verify the existing running brief when the free provider is available;
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
