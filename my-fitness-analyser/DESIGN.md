# Design contract v0.1

Status: proposed, awaiting visual comparison and owner selection. The stable principles below reflect the brief; the concrete visual settings are candidates. Do not label them approved.

## Intended feeling

Precise, athletic, composed and tactile. The feeling of care should come from details that agree: line weights, aligned numerals, thoughtful information hierarchy, responsive controls and a clear relationship between the map, chart and selected split.

Use original branding. Reference leading sports apps for interaction quality, not their logos, proprietary maps or complete screen copies.

## Shortlist for the next design iteration

| Direction | Hierarchy and layout | Palette and character | Trade-off |
| --- | --- | --- | --- |
| A. Trackside (recommended starting point) | Activity detail opens on route; prominent essential metrics; compact sheet for splits and check-in | Graphite, cool white, mineral blue; crisp sans; restrained depth | Strong sports utility, but must avoid generic dark-dashboard treatment |
| B. Field Notes | Insight-led opening; generous editorial rhythm; route and metrics integrated into a continuous page | Deep ink, softened white, sea-glass accent; more expressive typography | Distinctive and calm; requires discipline to keep analysis dense enough |

Compare genuinely different compositions and interactions, not only two recolours. Show the same real activity and missing-data state in both. Choose one shared system after review; do not implement two full products.

## Candidate tokens

`design/tokens.json` is the single editable token source. `npm run tokens` regenerates CSS; `npm run check` rejects drift. Exact values can change during the visual comparison. Once selected, log the decision and update all shared primitives together.

Candidate A: canvas #0C1015; surface #151C24; raised #202B38; main text #F3F5F7; secondary text #A7B0BB; accent #7DB0FF. Candidate B has its own ink/sea-glass palette in the token file.

Define semantic colours (action, focus, positive, warning, danger) independently of visual series (pace, HR, elevation). A faster run is not automatically green or “good.” Pair colour with text, shapes or line styles. No colour-only status. Avoid translucent effects as the sole separation between controls and map.

## Typography and layout

- System sans is the prototype baseline for fast, dependable iPhone rendering; compare one licensed display family only if it improves character. Record actual font files and licensing if adopted.
- Body and editable input text start at 16px; secondary labels 14px; key metrics 40–48px. Responsive/clamped sizes, tabular numerals, stable unit placement and wrapping at large text sizes.
- Spacing scale 4/8/12/16/24/32/48px. Content gutters begin at 20px and adapt to width. Avoid boxing every fact.
- Control, panel and sheet radii have distinct roles; proposed values 12/20/28px. Do not apply one radius universally.
- Desktop uses available width intelligently, not an oversized phone card. Core flows remain identical.

## Interaction and motion

- Primary controls have at least 44×44 CSS-pixel hit areas. Inputs/choices have visible labels, focus and selected states. Do not disable browser zoom.
- Reachable primary action; no required hover. Sheet drag always has an accessible button alternative and reliable focus/scroll behaviour.
- One action, immediate feedback; preserve entered data during navigation and network failures. “Saved” means server acknowledgement; show “Pending” for an offline queue.
- Candidate durations: press 120ms, UI transition 180ms, sheet transition 280ms. Values are starting settings, not frame-rate guarantees.
- Animate spatial relationships and continuity. Do not delay content to play an entrance sequence. No looping pulse, decorative number roulette, excessive parallax or swipe-only controls.
- Respect reduced motion: remove spatial/spring movement and retain essential state feedback. Limit animation work to opacity/transform when suitable; profile the actual device.

## Chart and map grammar

Every chart answers a named question. Units, selected interval, time window and missing-data gaps are explicit. Do not smooth data in a way that conceals interruptions or manufactures precision. Touchable inspection also has a text/table alternative.

Activity detail should progress toward: select a split → highlight exactly its corresponding route interval → align chart selection and summary. Preserve camera/selection when opening detail. Store raw GPS separately from any display downsampling or map-matched route. Never invent a route from a screenshot summary.

Do not imply an all-time PR with a medal when only selected activities are imported. Map tiles require a provider/licence decision and attribution. A map failure must not block the activity record.

## All states are designed

Default, selected, pressed, focused, loading, empty, partial data, error/retry, queued offline, sync delayed, key expired and success. Numeric absence uses a concise label or dash, never a fake zero. No blanket caution banners. Use one actionable error near its cause.

Respect iPhone safe areas, dynamic viewport, onscreen keyboard, browser back/forward and text enlargement. A bottom action must not cover content or focused controls.

## Acceptance

Two populated prototypes are reviewed visually before broad screen implementation. Evaluate 360px, 393–440px, 768px and desktop layouts, keyboard and reduced motion. These widths are test classes, not a claim about the exact physical iPhone viewport.

Text contrast target: at least 4.5:1 for normal text, 3:1 for qualifying large text. Interactive non-text contrast is checked separately. Target WCAG 2.2 AA for implemented flows; do not claim compliance from token checks alone.

A real iPhone Safari pass is recorded separately from desktop/WebKit emulation. Regressions in agreed hierarchy, tokens or accessibility are release defects, not aesthetic preferences to defer forever.
