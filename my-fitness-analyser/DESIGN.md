# Field Notes: selected design direction

Updated 5 November 2026. The owner selected Prototype B for all future work.
The earlier visual finish was not accepted as sufficiently premium. Refine one
Field Notes application; Trackside survives only in Git and legacy shared styles.
The exact new palette/type/motion treatment awaits owner visual review.

## Identity

An illuminated personal training folio. Ink and midnight depth, ivory editorial
letterforms, warm champagne light around the athlete's route and recorded facts.
The intended feeling is ownership, craftsmanship and composed authority. These
are design goals, not psychological outcomes that can be guaranteed.

`design/tokens.json` remains the editable source. selectedTheme is field-notes;
status remains proposed for the evolving visual treatment. Current core values:
canvas #080D13, surface #111B25, raised #202D3B, text #F5F0E6, secondary #B8C2CE,
champagne #DFC28D. Separate highlight, ambient blue/gold, focus and semantic data
roles keep atmosphere distinct from meaning. All text/control contrast gates
still apply to their actual backgrounds.

Typography: locally hosted Instrument Serif for titles, findings and narrative
transitions; Manrope for navigation, measurements and controls. Tabular numerals
keep data stable. Instrument Serif regular and italic are from google/fonts with
OFL licence; no font CDN. Newsreader and the older shortlist are historical.

## Composition

Root opens the selected application. /studio contains source, state, viewport
and accessibility review controls. Both use the same normalized activity model.

The opening pairs a large activity title and distance with the recorded route,
followed by essential facts. A full-width observation introduces the evidence.
The detail chapter pairs a sticky GPS outline with the chart and sampled time
blocks on desktop, then stacks them on mobile. Four unanswered check-in decisions
follow, with the original conditional location, notes and retry semantics. A
closing recap returns to the activity facts.

Avoid generic dashboard cards, empty product destinations, invented trophies,
false readiness claims, imitated proprietary maps or fake terrain. The optical
route treatment is a presentation of recorded GPS geometry, not a 3D terrain map.

## Motion

Motion is central to the brief. Choreograph a clear entrance, route drawing,
bounded scroll depth, section continuity and direct selection/replay feedback.
Use native scroll; sections remain reachable by links and keyboard. A deliberate
12-second replay follows recorded elapsed timestamps. Play/pause is explicit;
manual chart/block inspection and source/dialog changes stop replay.

The motion toggle is in the desktop header and preview settings on mobile. OS
reduced motion takes priority. Reduced mode shows all content in a static
composition, disables replay and removes scroll movement. No mandatory intro,
autoplay replay, endless foreground animation, randomized counters or scroll trap.

GSAP core and ScrollTrigger 3.15.1 are pinned and served locally with notices.
Dispose of animation contexts, observers and replay on activity replacement.
Cursor movement updates marker attributes/readouts; route/chart geometry is
cached until activity, chart series or viewport changes. Do not regenerate the
whole SVG on every pointer event.

## Functional and accessibility contracts

Four run check-in answers, all initially unanswered. Keep required discomfort
location and optional notes/context, browser draft recovery and simulated
error/offline retry. Preview completion is explicitly browser-only.

Missing data stays null. GPS gaps remain gaps. Device laps and sampled time
blocks have different labels. Screenshot summaries do not become GPS or chart
series. Every finding retains method and provenance.

Minimum 44 CSS-pixel primary targets, visible focus, labels, non-colour selected
cues, accessible text/table chart inspection and no hover-only actions. Body and
inputs start at 16px; use scalable text and safe areas. At 200% text, use normal
flow for the action dock and let headers/metrics grow. Fixed UI must not obscure
focused controls. Hide the redundant quick-check-in dock during inline entry.

Verify actual renders at phone, landscape, tablet, desktop and ultrawide sizes,
with missing-data/failure states and motion preferences. Token tests alone are
not WCAG certification; desktop browser review is not actual iPhone Safari or
observed owner completion timing. Record performance measurements before claiming
Core Web Vitals or frame-rate targets.

## Research and current evidence

See [research and art direction](docs/DESIGN_RESEARCH_2026-11.md), the latest
[QA report](docs/QA_REPORT.md), and the active feature. Work directly on master,
pulling GitHub master before new work, unless a new branch is genuinely needed.
