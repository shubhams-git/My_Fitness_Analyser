# F05a: training overview and bounded Gemini lab

Owner-directed, 5 November 2026. Supabase work is deferred. Ship a useful local
overview from the actual Garmin data and a separately labelled synthetic-only
analysis pipeline. Use the accepted Field Notes athletic identity.

## Acceptance

- `/training` displays real locally imported activities plus historical summary
  evidence. Last-90-day/all history and running/walking filters work; session
  and chart links open existing activity detail and check-in.
- Weekly distance, actual HR samples, recorded pace and sensor coverage have
  explicit units, null states, time bases and source distinctions. No inferred
  fitness/readiness score, invented GPS or fabricated measurement.
- Explicit Garmin sync refreshes the local record. Library, backup and detail
  flows remain intact. No database dependency is added.
- Gemini is synthetic-only, regardless of key presence. Server forces one
  strict-schema review tool. Local schema/semantic checks run before caching or
  rendering. Chart data comes from deterministic evidence, never model arrays.
- Missing-key, pending, invalid-response and retry states are clear. Official
  docs inform the REST interface and selected model. No live model success is
  claimed until a real synthetic-only call passes.
- Actual desktop/mobile renders, keyboard links, filters, source-limited states,
  motion preference and automated data/response tests are checked.

## Design

Retain Barlow Condensed/Manrope, carbon, signal orange and glacier blue. Broad
typographic hero and a real sensor trace lead into volume, sparse session pace,
coverage, concise observations and the session book. The lab is visibly separate.
Coordinated entrance, trace drawing and bounded section reveals respect reduced
motion and a persisted motion toggle. Native scrolling and immediate navigation
remain available. Existing activity detail is preserved at `/` and `/app.html`.

UI/UX Pro Max and frontend-design informed the hierarchy, accessible targets,
source-aware chart presentation and art direction. The skill's generic palette
recommendation was not adopted over the owner's accepted athletic tokens.

## Implementation and limits

See [engineering contract](../docs/GEMINI_ANALYSIS.md). Current analysis context
excludes check-in answers, strength/MASS and raw streams. No live Gemini request
has been made: owner confirmed billing, key not yet added, synthetic only.
Public preview stays synthetic and does not expose Gemini generation. The
previous private-cloud candidate is retained but its provisioning is deferred.

Verification results are recorded in STATE.md at the iteration boundary.
