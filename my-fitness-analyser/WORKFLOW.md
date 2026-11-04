# Delivery and continuity

## Why this approach

Do not implement the entire backend followed by the entire UI, and do not perfect every screen before testing real data. Use a small vertical slice: one user outcome, minimal data path, inspectable interaction, end-to-end verification and a releasable result. Visual exploration and technical feasibility can proceed independently until they meet at the feature contract.

## Session start

1. Read AGENTS.md and its short required reading set. Inspect working tree and commits.
2. Reconcile the latest STATE.md and active feature spec with the actual implementation. Source files/tests determine what exists; product/decisions determine intent.
3. Identify one next action, relevant risks and the evidence needed to call it complete. Do not restart research already resolved unless facts changed or a blocker requires it.

## Per-feature loop

1. Define the user question, scope and explicit exclusions in a feature record.
2. List real source fields, missing data and acceptance examples. Test uncertain integrations with the smallest useful spike.
3. Sketch/prototype the interaction using a real or clearly synthetic fixture. For the initial visual system, compare two meaningful alternatives and record the user's choice before broad UI work. Routine later components inherit that system.
4. Implement the data contract, persistence and UI together. Keep the existing release usable; use a short-lived feature branch and a simple flag if unfinished behaviour would otherwise leak.
5. Verify calculations, import/re-import, authorization, durable save/reload, failure and empty states. Review the rendered interface at target sizes. Test actual Safari separately when available.
6. Review the diff against product/design constraints. Record what passed and what remains unverified. Update the feature record, STATE.md and relevant decisions.
7. Merge/commit a coherent increment, deploy a private preview where configured, perform smoke verification and release only when the feature gates pass. Record a rollback target. Do not call an unpublished local prototype a release.

## Context-compaction protection

- AGENTS.md is a short routing/invariant file. Do not stuff all history into it.
- PRODUCT.md and DESIGN.md change deliberately. STATE.md is a compact current snapshot, not an endlessly appended diary. Decisions retain rationale and supersession.
- Feature records hold detailed work evidence. Tests preserve important behavioural contracts. Tokens/components preserve appearance. Git/migrations preserve implementation history.
- At natural boundaries and before a planned handoff, update STATE.md. Do not rely on predicting an automatic compaction event or on a universal hook that may not exist in the current client.
- A fresh agent can use templates/RESUME.md. It must read the files rather than claim it remembers them. No promise that every client auto-loads arbitrary Markdown documents.
- Add scoped AGENTS.md files only when needed; reference specialist docs on demand to keep the working context small.

## Change control

Changing accent, type scale or chart grammar means updating tokens/design decision and relevant reference screens, not one page alone. A requested feature does not authorize a framework replacement. Changing canonical schema requires a migration and compatibility/restore plan. Replacing a provider requires preserving original records and source aliases.

Use a reviewed pinned skill snapshot and a lockfile when a skill is actually installed. Do not automatically update style instructions on each iteration. New research may inform a change, but must not silently rewrite the design contract.

## Branching and backups

Use main plus one short-lived feature branch. No elaborate GitFlow for one person. Commit small reviewable increments; tag actual releases with a short release record. A private remote protects source history across machines; this pack supplies a Git bundle until a remote is chosen. Back up health records separately and prove restore. Never force-push away user work to simplify an AI session.
