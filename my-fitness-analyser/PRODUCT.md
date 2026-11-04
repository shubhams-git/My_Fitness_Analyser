# Product contract

Status: user requirements captured 4 November 2026; implementation/design proposals remain open.
Product name: **My Fitness Analyser**. Selected by the owner on 4 November 2026.
Technical slug: `my-fitness-analyser`. Use this identity in future app titles, installation metadata and exports.

## Promise

Turn running, strength, body-weight and recovery records into clear answers to: what changed, what matters, and what should I do next? Make the answer enjoyable to inspect on an iPhone without a wall of statistics or explanations of the app itself.

## Confirmed requirements

- Personal use, high professional quality, mobile-first and eventually online with private access.
- Prototype B / Field Notes is selected for all future UI development. The owner requests a much more impressive editorial, premium experience with strong coordinated motion, scroll flows, atmospheric gradients and distinctive typography. Selection of B is not approval of its previous visual finish.
- User owns a Garmin Forerunner 965, already paired with the phone, Garmin Connect and Strava. Those connections do not authorize this new application's access.
- New recordings come from Garmin. Strava continues for social sharing only. Historic NRC and Strava screenshots are legitimate user-supplied historical inputs. No ongoing NRC dependency.
- MASS remains the weight-entry source initially. Re-import its JSON without duplicate weigh-ins. Live fetching is a separate integration, not assumed.
- Check-ins take roughly 30 seconds and no more than 45 seconds in the usual workflow, excluding optional notes and activity-upload time.
- Rich activity exploration, accurate route/splits when available, useful progress and weight context. Add features incrementally.
- Visual quality includes hierarchy, typography, touch behaviour, coherent states, smooth useful motion and precise charts. No generic administration dashboard, marketing copy or gratuitous animated decoration.
- Firm, specific findings supported by actual evidence. One short missing-input line when useful; no repetitive disclaimer panels.
- Preserve future options without implementing speculative abstractions or dozens of empty tabs.

## First usable release

One owner can privately import a real Garmin activity file, inspect correct summary and splits, save/edit a four-answer check-in, reload without loss and export the recorded data. A route appears if the file contains GPS and a licensed map setup is ready. The screen still works without GPS or HR. Import MASS JSON for a simple weight trend. One deterministic activity observation is enough initially. Historical screenshot backfill is incremental and can follow the first real-data slice.

The first release does not require a custom training-plan editor, sleep dashboard, AI API, segment discovery, personal heatmap, GPS replay or social features. These remain opportunities, not cancelled goals.

## Insight voice

Lead with a precise finding, followed by at most two pieces of evidence. Optional drill-down shows method and source. Example: “Your first two kilometres stayed within six seconds of each other.” Do not turn this into “Your aerobic fitness improved” without repeated comparable evidence.

No fabricated all-time records. When history is incomplete, say “Best in your imported history.” No claim of no walking merely because moving and elapsed time agree. Confident language never upgrades an association into a cause.

## Candidate information architecture

Today, Activities and Progress; a persistent quick-log action; connections/import/preferences under settings. Plan can enter when plan linking is implemented. This is a proposal to compare in prototypes, not a reason to ship empty destinations.

## Feedback contract

Run: whole-session effort 1–10; conversational breathing (sentences/phrases/few words); discomfort (none/mild/affected the run); finish (plenty left/about right/near limit). Discomfort branches to location and optional detail. Optional context chips and note. All required answers start unanswered. Watch HR does not replace subjective effort.

Strength: completed as planned/modified/cut short; whole-session effort; leg fatigue; discomfort; optional note. Actual load/repetition tracking is opt-in later.

## Scope boundaries

No public social graph, global Strava segments, always-on phone GPS recorder, autonomous plan edits or unrestricted AI database agent. If a second athlete is added, keep Shubham and Sourav's records separate. No requirement for a paid subscription to make core logging usable.
