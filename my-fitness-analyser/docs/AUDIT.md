# Prototype refinement audit — 5 November 2026

Update: B is now selected; root opens the app and /studio holds review tools.
The newer research/audit conclusions are in docs/DESIGN_RESEARCH_2026-11.md.
The snapshot below describes the pre-selection second study.

Scope: improve the two F01 activity/check-in prototypes. The attached Sonnet
prompt is inspiration, not a new application specification.

- Routes: `/` compares both directions; `/app.html` renders either direction.
  The local Node server serves filtered `/api/data` and allowlisted evidence
  images. The GitHub/Vercel adapter serves a synthetic demonstration.
- Domain: `prototypes/data.mjs` normalizes Garmin/FIT and screenshot fixtures,
  preserves unavailable values, builds sampled elapsed-time blocks, and attaches
  versioned observations. Keep these calculations and source boundaries.
- Presentation: `app.js` renders both compositions and their state matrix.
  HTML templates have no TypeScript types; there is no production framework.
  Refine this reviewable prototype without selecting a production architecture.
- Check-in: four unanswered required responses, conditional discomfort location,
  optional notes/context, browser drafts, simulated failure/offline/retry.
  Keep the questionnaire and browser-only persistence meaning.
- Quality: existing Node tests cover calculations, token contrast and server
  boundaries; foundation checks cover token generation and documents. Browser
  inspection is needed for the visual and interaction changes.
- Weaknesses: key measurements are close in scale to supporting facts; route
  and summary feel disconnected; report-like framing dominates; mobile labels
  and action areas need a more deliberate hierarchy.

Retained: data, provenance, charts, keyboard inspection, state controls, native
dialogs, draft semantics, fonts and dependency footprint. Changed: composition,
metric hierarchy, Field Notes palette, section navigation and material treatment.
No 3D maps, broad navigation destinations, invented records or historical totals.
