# F09 — real geographic route exploration

7 November 2026. Replace the GPS-only optical illustration with a genuine,
interactive street map. Owner specifically requests streets, locations and
surrounding geography at different zoom levels, with premium athletic presentation.

## Acceptance

- Real street, park, water, building and place geography at appropriate zooms.
- Pan, pinch, keyboard navigation, zoom controls, north reset and fit-to-route.
- Detailed Streets and carbon Night treatments; clear start/finish and km markers.
- Recorded point inspection linked to time, pace, HR and existing charts/replay.
- Phone portrait/landscape, reduced motion, visible focus and honest failure states.
- Missing GPS stays missing. No new credentials, billing or invented route geometry.

## Delivered implementation

MapLibre GL JS 6.16.0 (BSD-3-Clause, official npm package) renders OpenFreeMap's
Liberty vector style over OpenStreetMap/OpenMapTiles data. Same-origin ESM and
worker are vendored with the licence; JS ~1.11 MB, worker ~0.52 MB, CSS ~72 KB
uncompressed. There is no framework/bundler rewrite. Runtime loads only near a map.
The provider supplies free public maps without an API key; no paid fallback.
Map data and labels remain geographic; theme changes only cartographic paint.

Inline maps use cooperative gestures to retain page scrolling; the expanded
explorer owns normal map gestures. Native browser dialog supports Escape and
focus return. Map cameras are independent of scroll animation and record cursors.
Recorded fixes remain local GeoJSON overlays; map service requests contain the
viewed geographic tile area and network metadata, not raw workout/HR data.
Provider attribution remains visible and source disclosure explains these requests.

Maps mount lazily, resize with their containers, and dispose on activity rerender
and modal close. Missing/invalid fixes and >30-second time gaps split polylines.
Clicks select nearby recorded fixes; keyboard time sliders provide an alternative.
Screenshot imports never acquire reconstructed GPS from map images.

## Verification

61 automated tests pass, including geographic gaps, single fixes, dateline bounds,
recorded-point hit testing, non-mutating style treatments and static worker/CSP
serving. Foundation and diff checks pass. Browser-rendered checks use the real
locally archived short Garmin walk: street/place labels and neighbourhood context
appear on zoom-out; Night works; keyboard time inspection shows recorded pace/HR;
375px portrait, 852px landscape, largest-text and reduced-motion remain operable.
NRC screenshot activity has zero map canvases and an explicit missing-GPS state.
These are desktop Chromium viewport tests, not actual iPhone Safari validation.
A static-serving test caught general .mjs exposure; the allowlist permits only
vendored .mjs assets, preserving server/source denial. Production checking caught the separate /app.html entry missing map CSS. Both
entry documents now include renderer/map styles, and HTTP tests enforce this.
Production recheck passed on the signed-in owner's real 6 November Garmin run
(4.15 km): street labels including Franklin Street/North Road and Princes Highway
Reserve, a wider Oakleigh/Huntingdale/Clayton neighbourhood after zoom-out, keyboard
panning, fit and Night cartography. Selecting the recorded 2 km marker displayed
16:40 / 9:04 per km / 172 bpm and moved the shared time cursor. No DB or source
measurements were changed. Provider sprite gaps use a generic POI fallback, and
minor-road labels appear from zoom 14 so fitted short routes retain useful names.
7d1c474 deployed successfully; final polish deployment verification follows.

References: [MapLibre installation/CSP](https://maplibre.org/maplibre-gl-js/docs/),
[OpenFreeMap quick start](https://openfreemap.org/quick_start/),
[terms](https://openfreemap.org/tos/), [privacy](https://openfreemap.org/privacy/).
