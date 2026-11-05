# My Fitness Analyser project foundation

Local alpha: run `npm install` then `npm run dev`; open
http://127.0.0.1:4173/. Import an original running/walking `.fit`, inspect it,
save a check-in and export/restore your private library. Data stays on this
computer under ignored `private-data/library/`. See
[local alpha instructions](features/F02-local-alpha.md). Hosted Vercel remains
the synthetic design preview.

Version 1.0.1 · 4 November 2026 · Owner: Shubham

This repository contains the project foundation, verified data-feasibility capture and two interactive UI prototypes. The production application is not implemented. Visual direction, runtime stack and hosting remain proposals. Read-only Garmin retrieval and UI previews work locally; no application database or deployment exists.

Start with [PRODUCT.md](PRODUCT.md), [DESIGN.md](DESIGN.md) and [STATE.md](STATE.md). A coding agent starts with [AGENTS.md](AGENTS.md). [ROADMAP.md](ROADMAP.md) defines the first usable release and deliberately defers advanced features.

## What survives a new conversation

- Stable vision: PRODUCT.md.
- Visual and interaction contract: DESIGN.md and design/tokens.json.
- Why decisions were made: DECISIONS.md.
- Actual completed work, blockers and next action: STATE.md.
- Feature scope and verification evidence: templates/FEATURE.md and the completed feature records.
- Code and schema history: Git commits, migrations and release tags once implementation starts.

These files reduce dependence on conversation memory. They cannot guarantee an agent follows instructions. Checks, review and actual release evidence enforce the important contracts.

## UI prototype

Run `npm run dev` (or `npm run prototype`) and open http://127.0.0.1:4173/ for
the selected **Field Notes** application. Review states, viewport and text/motion
controls are at http://127.0.0.1:4173/studio. Prototype B is the sole future UI
direction; its new visual finish is still being refined with the owner.

The activity picker includes a clearly labelled synthetic sample and any local
private fixtures. Online deployments from GitHub contain the synthetic sample
only. `npm run vendor:motion` refreshes locally served files from pinned GSAP.
See [design research](docs/DESIGN_RESEARCH_2026-11.md) and
[current QA](docs/QA_REPORT.md). To publish the shareable preview, follow
[the hosting steps](docs/HOSTING_PROTOTYPE.md). Never add Garmin credentials or
private activity data to a hosted prototype deployment.

## Use this pack

Unzip the package. The repository content is in `my-fitness-analyser/`. To recover its initial Git history, run `git clone my-fitness-analyser.bundle my-fitness-analyser-project` from the extracted package's parent directory. Work in the cloned directory. Keep raw health data and credentials outside Git.

Run `npm run check` with Node 22 or newer. This foundation command needs no install step and validates document presence, token shape, text contrast and generated CSS consistency. It does not test an application or validate live Garmin access. Run `npm ci --ignore-scripts` for the pinned official Garmin FIT SDK used by the separate inspection scripts.

Real account JSON and seven original FIT files have been captured; historical screenshots and MASS export have been inventoried privately. See [data feasibility](docs/DATA_FEASIBILITY.md) and the [active feature record](features/F01-design-and-feasibility.md). The next decision is the visual direction to refine; broad application work follows that review.

The two interactive prototypes are now ready for owner review. Run `npm run prototype` and open `http://127.0.0.1:4173/` to compare Trackside and Field Notes, source samples, failure states and accessibility options. See the [prototype review guide](docs/PROTOTYPE_REVIEW.md) for deliverables, checks and remaining gates. Check-ins are browser-only demonstrations; this is not a production app release.

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
