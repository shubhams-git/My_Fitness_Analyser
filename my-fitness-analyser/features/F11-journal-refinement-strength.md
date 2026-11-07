# F11 — chart refinement and strength recording

8 November 2026. Owner rejects abrupt body-journal lines and an unexplained
range control; requests a design-led revision followed by the next planned task.

Design: keep Field Notes carbon surfaces, Barlow/Manrope, peach recorded values
and blue mean. Make the chart the interaction surface. Replace detached range
input with hover/tap, arrow-key/Home/End inspection and labelled previous/next
buttons. Use bounded cubic Hermite joins through the observations, retain real
sample dots and missing-data breaks, and fit the horizontal extent to recorded
dates. Do not fabricate current readings or interpolate across long absences.
Keep the 7-day statistic unchanged. No new chart library or dependency.

Research: [Anthropic's design-skill guidance](https://claude.com/resources/articles/improving-frontend-design-through-skills)
supports deliberate typography, atmosphere and context-specific art direction;
the already-installed frontend-design skill provides a plan/build/critique loop.
This does not establish claims about a particular unreleased model's capabilities.
[NN/G direct manipulation](https://www.nngroup.com/articles/direct-manipulation/)
supports acting on visible data with immediate feedback.
[D3 curve documentation](https://d3js.org/d3-shape/curve) distinguishes interpolation
methods; shape-preserving joins avoid the false extrema of unconstrained splines.
We use a small bounded implementation, tested against endpoint/extrema/gap cases.

Strength: a focused, responsive sheet records session focus, member-local date,
optional whole minutes and note. Optional check-in has four explicit answers:
completion, whole-session effort, leg fatigue and discomfort, with a required
location when discomfort is present. Blank check-ins remain null; no answer is
assumed. New-session drafts are owner-scoped. Edit/remove/restore append revisions,
operation receipts cover retries, stale journal heads reject saves. Source dates
overlapping another session need an explicit separate-workout acknowledgement,
including MASS imports after a manual log. Source rows are not silently merged.
No exercise-level sets/loads or physiological inference; no new Gemini input.

Storage: additive strength_entries table and invoker latest view. Owner-only RLS,
read-only client grants, narrow membership-checked definer save function with an
empty search_path. Journal head lock serializes weights/imports/strength. Snapshot
includes current manual sessions atomically; complete export includes revisions.
MASS originals and existing records remain intact. Separate table avoids altering
the immutable import schema or pretending manual records have source-file hashes.

Acceptance: smooth honest chart, no range control, direct/keyboard inspection,
responsive and reduced-motion behaviour; authenticated source-labelled strength
history with optional complete check-in, recoverable removal, concurrency/retry
protection, and export inclusion. Synthetic UI/SQL QA never creates owner workouts.
Production migration, deployment and final checks are recorded below when complete.
