# Field Notes: selected design direction

Updated 7 November 2026. The owner selected Prototype B for all future work.
The owner liked the premium finish but requested a stronger active fitness
identity. Refine one Field Notes application; Trackside remains historical.
The latest athletic treatment awaits owner visual review.

## Identity

A premium training workspace. Carbon surfaces, condensed athletic typography,
signal-orange route/pace, glacier-blue heart rate and directional ambient light.
The route, effort trace and precise figures convey movement and performance.
Use the design brief in docs/ACTIVE_DESIGN.md for the latest rationale.

`design/tokens.json` remains the editable source. selectedTheme is field-notes;
status remains proposed for the evolving visual treatment. Current core values:
canvas #080E16, surface #111C29, raised #1C2B3C, text #F2F7FC, secondary #B8C2CE,
orange #FFAE89. Separate highlight, ambient blue/ember, focus and semantic data
roles keep atmosphere distinct from meaning. All text/control contrast gates
still apply to their actual backgrounds.

Typography: locally hosted Barlow Condensed bold/italic for athletic titles,
findings and figures; Manrope for navigation, supporting copy and controls.
Tabular numerals keep data stable. Barlow is from google/fonts under OFL;
no font CDN. Instrument Serif and Newsreader are historical treatments.

## Composition

Root opens the selected application. /studio contains source, state, viewport
and accessibility review controls. Both use the same normalized activity model.

The opening pairs an athletic activity title and distance with recorded route,
explicit replay and a compact pace trace. A shared cursor links the trace,
elapsed/pace readout, geographic route maps and detailed chart. A keyboard-operable
slider supports manual inspection even with reduced motion. Mobile puts the
essential facts before the route; check-in is reachable beside the distance.
A compact observation introduces the evidence.
The detail chapter pairs a sticky geographic route map with the chart and sampled time
blocks on desktop, then stacks them on mobile. Four unanswered check-in decisions
follow, with the original conditional location, notes and retry semantics. A
closing recap returns to the activity facts.

Avoid generic dashboard cards, empty product destinations, invented trophies,
false readiness claims, imitated proprietary maps or fake terrain. Real MapLibre
street maps show OpenStreetMap roads, parks, buildings and places at each zoom.
Streets is the detailed light treatment inside the carbon app frame; Night keeps
the same geography with carbon roads and green parks. Orange recorded routes have
solid contrasting casings, with labelled start/finish and kilometre markers.
Map cameras stay stable while scrolling and inspecting data. Inline cooperative
gestures preserve document scrolling; Explore map opens the focused, responsive
route explorer. Missing GPS never becomes an invented route. See F09.

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

## Body journal

F10 places recorded weight history beside an explicit quick-entry panel. On a
phone, kg/date and the save action take priority. Keep the decimal keyboard,
blank initial measurement, explicit reuse of a dated previous value, optional
note, inline errors and a persistent owner-scoped draft. Save feedback means a
confirmed server write. Imported MASS records keep their source and are corrected
by re-import; manual edits append revisions and removed entries remain recoverable.

Daily chart values are labelled averages; original readings stay separate. Solid
recorded/dashed mean lines, direct chart inspection, keyboard arrows and labelled
previous/next buttons provide multiple ways to inspect. Shape-preserving curves
pass through the recorded points without false extrema. Use actual dates on the
time axis, fit the extent to recorded dates, break gaps and label the
historical mean's anchor date. No progress score or weight-loss judgement. Data
windows persist in the URL. Import review and backup preparation expose status;
no process-memory token or silent cross-source merge is assumed. See F10.
