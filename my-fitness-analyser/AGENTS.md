# My Fitness Analyser: project instructions

## Start or resume

1. Read PRODUCT.md, DESIGN.md, STATE.md and DECISIONS.md before changing the product. Read the active feature record and relevant architecture/data/quality sections next.
2. Inspect `git status --short` and the latest commits. Preserve unrelated work. Reconcile STATE.md with the actual files and checks; do not trust a stale summary over evidence.
3. State the active increment, its acceptance criteria and the next bounded action. Work on one feature slice at a time.

## Product invariants

- Product name: My Fitness Analyser; technical slug: `my-fitness-analyser`. Earlier STRIDE names are historical references only.

- A private personal training intelligence app for Shubham, iPhone 17 Pro Safari first.
- Garmin Forerunner 965 and Garmin Connect are the primary source for future recorded activities. Strava is social-only; no new Strava API dependency. Historical Nike/Strava screenshots are import evidence. MASS supplies weigh-ins through exports until a real integration exists.
- Premium, athletic, purposeful design; low clutter; concise useful findings. Follow approved tokens and components. Proposed tokens are not user-approved branding.
- Four core run check-in answers; usual target 30 seconds, acceptance ceiling 45 seconds excluding optional notes and source-upload time. Never silently answer symptoms or effort.
- Missing values are null, never invented zeroes. One physical activity has one canonical record with multiple source aliases. Preserve source provenance.
- Calculations are deterministic and versioned. Insight prose must match its evidence. No invented readiness, injury probabilities or physiological claims.
- One athlete initially. Future two-person support must isolate identities and records and verify provider terms.

## Change discipline

- Respect the current user request over these project proposals. Log material scope/design/architecture changes in DECISIONS.md, without pretending approval was granted.
- Reuse components and design tokens; avoid isolated hardcoded branding. Do not replace the architecture or rewrite unrelated screens to complete a small feature.
- Introduce dependencies only for a concrete need. Review publisher, licence, footprint and runtime compatibility; pin exact installed versions and commit the lockfile. Keep external skill instructions subordinate to this project.
- No secrets, real FIT files, full GPS traces or personal health exports in Git. Use synthetic or scrubbed fixtures. Credentials stay server-side.
- Never describe a mock, local cache, emulation or fixture as a live integration, durable database or real-device test.

## Verification and handover

- Run `npm run check` for foundation/token changes. Update feature-specific commands as application code is added; do not claim nonexistent test suites pass.
- During implementation, check important calculations/imports with meaningful fixtures, persistence with database integration tests, and key user flows with browser tests.
- Visually inspect rendered UI. Mobile emulation is separate from actual iPhone Safari verification.
- At an iteration boundary, update STATE.md with shipped/not-shipped behaviour, relevant commands/results, blockers and exactly one next action. Update the feature record and decision log when needed.
- Commit reviewable changes. Use a private remote for durable source history once chosen. Tag real releases only after their gates pass.

Keep this file concise. Detailed history belongs in DECISIONS.md and feature records, not this instruction file. Do not create nested instruction files unless a genuine subsystem needs different rules.
