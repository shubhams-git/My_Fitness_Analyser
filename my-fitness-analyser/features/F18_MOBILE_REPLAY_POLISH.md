# F18 — Mobile replay and distribution alignment

9 November 2026. Owner-directed refinement of the selected Field Notes UI.

## Acceptance and implementation

- Pace distribution labels, bars, durations and shares share a vertical centre.
  Override the inherited absolute top inset; preserve actual widths, including 0.
- Replay has bounded header / map stage / footer rows. The canvas occupies the
  stage only. Stats and Close no longer rely on a sticky element inside a scrolling
  dialog. VisualViewport dimensions/offsets follow mobile browser chrome changes;
  body scroll is locked and its original styles, page position and opener restored.
- Phone, short portrait and landscape retain controls and metrics. The existing
  enlarged-text mode has a compact responsive layout; overflow remains reachable
  inside header/footer instead of scrolling the entire replay out of view.
- Preserve bird's-eye opening and descent. Follow at zoom 14.8 (roughly 1.74x the
  former zoom 14) from an eight-recorded-second trailing position within the same
  GPS segment. Existing smooth camera/heading, elapsed traversal, gaps and actual
  measurement readouts remain. The completed trail can leave the close viewport.
- Smooth pullback begins during the final 12% of traversal playback and settles
  on the full completed route. Duration remains route-aware, 24–40 s; this owner's
  5 km route is 29.8 s. Calculation version satellite-replay-v3.
- Remove the replay About panel and large footer attribution block. Mandatory
  EOX/Copernicus/licence/terrain credits remain in a quiet map-edge caption.
  Street maps show a small visible OpenMapTiles/OpenStreetMap data credit instead
  of OpenFreeMap branding and an expandable information button.

## Decisions and limits

No provider, paid plan, key, dependency or database change. Close framing deliberately
accepts raster overzoom to honour the requested proximity. It adds no resolution to
EOX's approximately 10 m imagery and makes no claim of premium aerial/3D buildings.

EOX expressly requires clearly visible interactive-map credit, including company
and modified Copernicus data year. Those cannot be removed completely:
https://cloudless.eox.at/documentation/license
https://mapterhorn.com/attribution/
https://openfreemap.org/tos/
https://www.openstreetmap.org/copyright

VisualViewport provides the visible height/offset rather than assuming the layout
viewport always equals the mobile browser's visible area:
https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport

## Verification

108 prototype tests pass, including monotonic early pullback, bounded duration,
GPS gaps, sample fidelity and camera behavior. Foundation checks pass (38 contrast
pairs; foundation scope only). Final Impeccable source detector returns no findings
for the five changed UI targets; this is not a whole-app accessibility certificate.

Rendered owned-snapshot Chromium preview: 393×720 and 393×568 portrait, 852×393
landscape, enlarged text, loaded follow view, manual End and completed route.
All six pace-distribution rows have matching cell/bar centres; true zero stays 0.
Independent Impeccable after-review finds no observed P0/P1: loaded desktop replay,
manual seek, completion, Close/Escape, exact scroll/focus/body-style restoration,
street-map restoration and no captured browser warning/error logs.

Ignored private-data/interface-qa retains review, detector, test output and visual
proof. Preview uses an owned read-only export, blocks writes and provider generation.
Viewport emulation is not a physical iPhone Safari test. Production verification
is recorded in STATE.md after deployment.
