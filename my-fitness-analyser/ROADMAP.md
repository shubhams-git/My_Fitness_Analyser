# Incremental roadmap

| Increment | User-visible outcome | Completion evidence |
| --- | --- | --- |
| F00 Foundation, completed | Shared vision, candidate design system and repeatable process recorded | Docs/tokens checks and portable Git snapshot; no claim of an app release |
| F01 Design and feasibility, direction selected | Field Notes athletic UI selected and refined | Real FIT/API inspection and interactive UI verified; physical-device gates remain |
| F02 Core activity slice, local alpha available | Import a real FIT; inspect summary/laps; save/edit feedback; export/restore locally | F02a verified; private online ownership/authentication and physical-device pass remain open |
| F03 First usable MVP, local MASS slice available | MASS weight/session journal, deterministic statistics and complete export/restore | F03b IDs/deletions/math/restore verified locally; private deployment remains deferred |
| F04 Garmin sync, local manual pull available | Pull new workouts through verified Personal API | F04a verified live: pagination, retry, idempotency and sync status; background/private online sync remains open |
| F05a Training intelligence, local slice available | Real-data training overview and separate synthetic Gemini lab | Schema/evidence/cache tests pass; live Gemini awaits key and remains synthetic only |
| F05b Historical backfill, partial | Correct historical Nike/Strava evidence joins the log | Two summary seeds displayed; durable review/import archive workflow remains pending |
| F06 Plan context | Match actual workouts to versioned planned sessions | Rescheduling/unscheduled/modified sessions; old plan preserved |
| F07 Recovery and deeper analysis | Available sleep/HRV and comparable-run insights | Real fields verified; suitable baseline; explicit eligibility rules and deterministic tests |
| F08 Earned advanced features | Best efforts, map/graph linking, personal segments or AI explanations | Prioritise one by actual value; accurate math/data coverage and evidence validation |

This is sequencing, not a promise to build every idea. A useful necessary map interaction may move earlier if it fits the first slice. Live sync and historical backfill can swap when access or owner effort favours it. Record any material sequence change and its reason.

First MVP success: owner can repeatedly import, inspect and annotate real training without duplicate records or lost feedback, and can inspect weight history. Premium quality applies to that small experience; broad scope is not the measure of professionalism.
