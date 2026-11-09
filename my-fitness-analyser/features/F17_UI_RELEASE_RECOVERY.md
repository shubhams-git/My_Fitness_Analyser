# F17 — Entry-point recovery and runner-follow replay

9 November 2026. The owner reported black charts, a malformed nonplaying replay,
and incompatible new typography, and explicitly requested independent Impeccable
agents before/after fixes plus UI/UX Pro Max implementation guidance. Subsequent
feedback liked the satellite progress and requested clearer imagery, a runner
pulling ahead of the viewer, and modestly faster route-aware playback.

## Release defect and repair

Production `/` used stale `index.html`, omitting `interface.css`,
`activity-visuals.css` and `satellite-replay.css`. `/app.html` included them. Real
DOM inspection reproduced black SVG fill/no stroke and a zero-height satellite
canvas on the root, while the explicitly tested activity URL worked. F16's
verification scope missed the actual home URL; HTTP 200 and one styled route
were insufficient release evidence.

There is now one activity HTML document, `app.html`. Vercel, the local server
and the UI review server route `/` and `/index.html` to it without changing the
requested activity query/hash. Remove the drifting duplicate HTML. Regression
tests request all three entries, compare their actual responses, and request
every required CSS asset with its correct content type. Rendered checks must
add computed chart colors, a nonzero replay canvas and actual playback.

## UX decisions

- Preserve carbon/orange/glacier Field Notes and the existing local fonts.
  Manrope owns body/UI/axes; Barlow is reserved for athletic titles/figures.
- Compact the run heading, bring figures/actions earlier, and place phone summary
  facts before the map. Remove the duplicate hero pace preview/slider and giant
  final recap; keep the full exact chart, split/results and check-in tools.
- Brand/home navigation points to Training consistently. Training/Progress use
  direct page names. Stored completed check-ins show Edit check-in in the hero.
- Replay HUD/footer use normal flow around the image, readable labels/attribution,
  48 px buttons and a 44 px timeline. Short-screen/large-text content can scroll
  rather than being clipped; the header stays accessible while scrolling. The
  largest-text phone setting reflows metrics into labelled rows. A focused dialog
  still protects keyboard interaction. Framing measures the actual HUD/footer,
  so the final full route fits the available image area even in landscape.
- Avoid staging session figures with initial opacity animations. Keep the authored
  replay and relevant feedback, not a page full of delayed counters/reveals.

## Chase replay v2

`satellite-replay-v2` reuses MapLibre, EOxCloudless and Mapterhorn. No new library,
key, database write, model call or paid provider is introduced.

- Duration is 24–40 seconds based on recorded route distance. The real 5 km owner
  recording is 29.8 seconds rather than 34 (excluding imagery loading and pauses).
- A 1 s overview, 2.8 s descent, bounded traversal and 1.6 s finish pullback.
  Normalized traversal eases its first/last tenth instead of launching instantly.
- The camera follows a point 12 recorded seconds behind the runner on the same
  continuous GPS segment, with a 0.32 s positional response and bounded short-way
  heading changes. The runner advances ahead while the camera catches up.
  Camera coordinates are visual interpolation, never new activity measurements.
- Descent reaches 76° and settles to 69° tracking rather than stretching the
  whole journey at 78°. Follow zoom stops at native z14. The finish reveals the
  complete actual route overhead. These are useful clarity improvements within
  the source's approximately 10 m resolution, not invented image detail.
- Geometry generation is lazy and occurs only at the bounded trail-update rate;
  camera/marker motion remains frame-driven. Existing gaps, exact recorded metrics,
  pause/resume/seek/restart, hidden-tab pause, reduced motion and teardown remain.

The owner’s reference screenshots, [Strava’s current Flyover guide](https://support.strava.com/en-us/articles/15401641-flyover),
[official release explanation](https://press.strava.com/zi/articles/strava-releases-flyover-transforming-how-athletes-look-back-at-adventures)
and [public recorded playback](https://www.youtube.com/watch?v=MX6_j-fWo-w)
were reviewed. At roughly 2:32–2:45 in the public recording, the cursor stays ahead
while terrain and heading follow the path. The official release’s embedded Drive
video required access; it was not bypassed or requested. The implementation is
independent and keeps this app’s visual identity and its own data.

Sharper street-level aerial imagery/photogrammetric buildings still require an
appropriately licensed higher-resolution source. Existing EOX noncommercial
attribution and terrain credits remain visible; no unlicensed imagery is used.

## Briefing integrity

The independent reviews also observed `170 bpm bpm` and an unsupported claim
that the runner was within personal aerobic limits. Placeholder display dedupes
units; tests cover it. Current evidence has no reviewed personal thresholds, so
that specific unsupported claim is rejected on new report validation and hidden
on stored-report display pending an explicit update. A new `runner-coach-v4`
prompt states the evidence/format contract. Schema remains coaching-review-v3.
No personal report was generated or modified as a UI test.

## Review and checks

Initial independent A/B: design 22/40, technical 10/20; both reproduced production
root failure, with separately observed browser/source evidence. UI/UX Pro Max
provided a focused written direction and implemented replay CSS. Fresh independent
post-implementation agents review the corrected root, chart and actual replay.
Reports/screenshots and full detector JSON are retained in ignored private-data.
Read-only browser evaluation prevents injection; no detector overlay is claimed.

Fresh after-review: A design 32/40 and B technical 16/20, no observed P0/P1.
A found one P2 (seeking End kept Play rather than Play again); the state label
is corrected and manually verified. B's eight raw findings were dormant,
overridden/vendor styles or contextual lighting/chart scaffolding rather than
verified active failures; counts are not presented as a zero-defect guarantee.
Post-review short-screen checks additionally tightened sticky header, button
wrapping and camera insets. Final suite: 107 tests, plus foundation checks.

Final test, rendered viewport, deployment and after-review outcomes appear in
STATE.md. Browser emulation does not claim physical iPhone Safari verification.
Code release cbd6a92 has successful Vercel status. Production `/`, `/index.html`
and `/app.html` return identical nine-stylesheet activity HTML. Actual signed-in
root inspection confirms orange/blue filled figures and a loaded nonzero satellite
canvas, adaptive 29.8 s timeline and correct recorded metrics. No browser errors
were captured. Preview image `private-data/interface-qa/f17-replay-preview.png`
uses the read-only owned export and the same released source; it is not labelled
as a physical-device capture. Temporary review tabs and servers are cleaned up.
Impeccable update was attempted at the owner’s request; the upstream installer
returned HTTP 504, and the owner explicitly deprioritized it. Existing installed
Impeccable remains usable; no project dependency or hook was added by that attempt.
