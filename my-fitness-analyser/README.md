# My Fitness Analyser project foundation

Version 1.0.1 · 4 November 2026 · Owner: Shubham

This is the project foundation, not a running application. Product requirements are recorded; visual direction, runtime stack and hosting are proposals. No Garmin account has been accessed, database provisioned, external skill installed or app deployed in this iteration.

Start with [PRODUCT.md](PRODUCT.md), [DESIGN.md](DESIGN.md) and [STATE.md](STATE.md). A coding agent starts with [AGENTS.md](AGENTS.md). [ROADMAP.md](ROADMAP.md) defines the first usable release and deliberately defers advanced features.

## What survives a new conversation

- Stable vision: PRODUCT.md.
- Visual and interaction contract: DESIGN.md and design/tokens.json.
- Why decisions were made: DECISIONS.md.
- Actual completed work, blockers and next action: STATE.md.
- Feature scope and verification evidence: templates/FEATURE.md and the completed feature records.
- Code and schema history: Git commits, migrations and release tags once implementation starts.

These files reduce dependence on conversation memory. They cannot guarantee an agent follows instructions. Checks, review and actual release evidence enforce the important contracts.

## Use this pack

Unzip the package. The repository content is in `my-fitness-analyser/`. To recover its initial Git history, run `git clone my-fitness-analyser.bundle my-fitness-analyser-project` from the extracted package's parent directory. Work in the cloned directory. Keep raw health data and credentials outside Git.

Run `npm run check` with Node 22 or newer. This foundation has no third-party dependencies and needs no install step. This command validates document presence, token shape, text contrast and generated CSS consistency. It does not test an application or validate live Garmin access.

Recommended next iteration: make two populated mobile visual prototypes for the same activity-detail and check-in flow. In parallel, obtain one owner-supplied Garmin original FIT file and check Personal API setup availability. Do not build the full backlog before a visual direction is selected.

## Contents

| File | Responsibility |
| --- | --- |
| PRODUCT.md | Vision, requirements, scope and writing voice |
| DESIGN.md | Provisional visual system, UX and interaction standards |
| ARCHITECTURE.md | Small-system proposal and verified/unverified boundaries |
| DECISIONS.md | Requirement, proposal and supersession register |
| WORKFLOW.md | Feature delivery, resume and change control |
| STATE.md | Compact current handover |
| ROADMAP.md | Ordered increments and release gates |
| docs/DATA_CONTRACT.md | Source precedence, provenance and import correctness |
| docs/QUALITY.md | Engineering and product release checks |
| docs/RESEARCH.md | Dated primary sources and tool shortlist |
| templates/FEATURE.md | One reusable feature specification |
| templates/RESUME.md | Brief instruction to a fresh coding session |
| design/tokens.json | Editable source for proposed design tokens |
| design/tokens.css | Generated token CSS; do not hand-edit |

Historical documents were consulted and reconciled, not copied into active instructions. They remain reference material. The 4 November user request supersedes older assumptions about watch ownership and Strava ingestion.
