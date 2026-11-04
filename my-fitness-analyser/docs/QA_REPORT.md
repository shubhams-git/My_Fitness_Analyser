# F01 refinement QA — 5 November 2026

## Automated checks

`npm run check`: passed; 14 required documents, generated token agreement and
38 text contrast pairs. `npm run test:prototypes`: all five tests passed,
including non-text contrast, sampled calculations and local server boundaries.
JavaScript syntax and Git whitespace checks passed.

## Browser review

Both directions were rendered with the synthetic sample at requested 360, 375,
393, 440, 768 and 1440 pixel widths, plus 852 × 393 landscape. No horizontal
overflow was measured in 14 cases. The browser reports 394 for the requested
393 width in this environment; requested and actual dimensions are distinct.
The comparison backlink was below the touch-target floor in the first pass and
was enlarged. Route info/zoom/fit buttons retain at least 44 CSS-pixel targets.

Both directions were also checked at 360px with a 32px root font (200%) and
reduced motion. No element extended beyond the viewport; button transitions
were 0s. The bottom action becomes part of normal document flow at that size,
and the header grows with its wrapped wordmark. This tests a text-size override,
not iOS Dynamic Type or browser pinch zoom.

All ten review scenarios were rendered in both directions: normal, partial,
empty, loading, load failure, check-in failure, offline, delayed, expired and
completion. The missing-data state has no route line. None of these 20 cases
produced horizontal overflow.

## Interaction review

- Empty check-in: all answers initially blank; submitting focuses effort.
- Discomfort: Mild exposes a location; chosen Knee is retained after failure.
- Failure: four answers plus the location survive. The failure result receives
  focus and remains fully above the sticky action bar; retry completes.
- Completion: focus moves to the completion heading after the form is replaced.
- Offline inline check-in: answers remain pending, focus reaches the pending
  message, retry completes, and None leaves the location null.
- Exploration: selected time block highlights its route interval; keyboard End
  on the chart reaches 20:00. Opening and closing the sheet with Escape preserves
  the selected route interval.
- Synthetic check-in was reset through the UI after review. Real activity
  check-ins were not filled during this refinement pass.

## Visual critique and corrections

The first pass improved number hierarchy but revealed three concrete issues:
the report backlink had a small hit area; the arched Field Notes route clipped
the source button; and the sticky check-in footer could cover a failure message.
These were corrected with a 44px link, a top-centred route control, and deliberate
result focus/spacing. Enlarged-text headers were allowed to grow as well.

Synthetic screenshots and measured browser evidence are stored under ignored
`private-data/prototypes/refinement/`. This is a browser-checked design prototype,
not an actual iPhone Safari pass, WCAG certification or measured owner timing.
Lighthouse/Core Web Vitals, real-device performance and production deployment
have not been measured in this pass. No runtime dependency was added.
