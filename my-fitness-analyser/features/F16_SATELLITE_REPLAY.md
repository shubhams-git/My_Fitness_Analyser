# F16 — Satellite route replay

9 November 2026. The owner supplied Strava playback references and requested a
satellite city overview, descent into a near-horizontal view, and tracking camera
with a growing route. This is an explicit replay action; normal street-map and
chart inspection retain a stable camera. Work on master.

## Design and delivery

- A focused native dialog, fullscreen on phones, opens from **Replay route**.
  The imagery leads; Barlow Condensed metrics and restrained Field Notes controls
  stay readable above it. Title, pace, recorded elevation, distance and elapsed
  time remain visible. No other dashboard content competes with playback.
- A held overhead overview (1.2 s), cubic descent (3.3 s), elapsed-time traversal
  (27.5 s), and finish hold (2 s). The follow view uses 78° pitch, real sky/fog,
  and terrain with exaggeration 1. Camera bearing looks ahead within a continuous
  GPS segment, uses the short turn across north, and limits rotation to 75°/s.
  Position smoothing does not modify the athlete's recorded route or metrics.
- Pause/resume, restart, play again, keyboard/touch timeline, Escape/close and
  focus restoration. Scrubbing pauses playback; metrics use the last recorded
  sample at the selected elapsed time. GPS interpolation is only visual and only
  between adjacent valid fixes in one continuous segment. Missing fixes and gaps
  over 30 seconds are not connected. Missing metrics remain unavailable.
- The app/system motion-off path keeps a top-down map with deliberate manual
  timeline inspection, with no automatic replay. Hiding the tab pauses playback.
  Dialog teardown aborts listeners/observers, cancels frames and releases WebGL;
  underlying street maps are unmounted during replay and restored on close with
  their prior camera position, appearance and selected recorded moment.
- Imagery loading, a bounded timeout, retry/close recovery, optional-terrain
  degradation and context-loss recovery. Attempt generations prevent an obsolete
  asynchronous library load from creating another replay after retry/close.

## Imagery and cost decision

EOxCloudless 2024, approximately 10 m Sentinel-2 imagery, uses the official WMTS
endpoint and a z14 native-zoom ceiling. Follow zoom is capped at 14.65 to limit
overzoom. EOX explicitly permits personal/noncommercial use with visible
attribution under CC BY-NC-SA 4.0. This private personal app fits that use; a
commercial release requires a new licensing decision. All replay views keep the
full provider/year/licence credit visible, including screenshot captures.

Mapterhorn provides public Terrarium terrain tiles. Its attribution/source link
is always visible. Terrain tiles stop at z12 here to bound network/GPU cost;
terrain failure falls back to imagery with an explicit note. Only viewed tiles
are requested, with credentials omitted and no referrer. No GPS JSON, account
identity, AI request, new database migration, provider key or billed service is
introduced. The local CSP allows only the two added tile origins.

The free imagery is coarser than Strava's high-resolution city imagery. Buildings
remain photographic, not photogrammetric 3D meshes. Do not describe this as a
Google Earth/Strava 3D reconstruction. ArcGIS anonymous World Imagery and Vicmap
paid aerial basemaps were rejected without an appropriate licence; NASA's coarse
global imagery was unsuitable for route-scale viewing. A future licensed sharper
imagery provider can replace the raster source without changing playback.

Primary references consulted 9 November 2026:

- [EOX licence and personal use](https://cloudless.eox.at/documentation/license)
- [Official EOX WMTS access](https://cloudless.eox.at/documentation/usage)
- [WMTS capabilities](https://tiles.maps.eox.at/wmts/1.0.0/WMTSCapabilities.xml)
- [Mapterhorn tile access](https://mapterhorn.com/data-access/)
- [Terrain sources and attribution](https://mapterhorn.com/attribution/)
- [MapLibre sky, fog and terrain example](https://maplibre.org/maplibre-gl-js/docs/examples/sky-fog-terrain/)
- [Vicmap basemap licence service fee](https://www.land.vic.gov.au/maps-and-spatial/data-services/vicmap-basemaps)

## Verification

Pure model fixtures cover storyboard timing/end boundaries, recorded sample
metrics versus visual interpolation, late GPS acquisition, mid-route missing
fixes/time gaps, missing metrics/stationary pace, invalid timestamps, dateline
crossings and bounded/smoothed heading changes. The existing application suite
also checks local CSP and static serving. Local UI QA uses an ignored read-only
copy of the owner's export; it performs no database writes or model calls.

Final rendered/device and deployment observations are recorded in STATE.md.
Browser viewport emulation does not establish physical iPhone Safari performance.

The final Impeccable detector was run once over the changed markup/style targets.
It reported four inherited whole-page app.html findings (existing metric gradient,
legacy decorative grid/glow and the unused vendor geolocation pulse rule), no
replay-specific finding. This is not a claim that the entire legacy page has no
design debt. A forced local all-404 imagery test exposed MapLibre's completion of
errored tile loads: replay now requires a successfully loaded satellite tile in
addition to source readiness. The observed timeout shows Retry, disables replay
controls, recreates one canvas on retry, and closes back to the street map/focus.


## Higher-resolution imagery

14 November 2026. The deployed camera follows at zoom 14.8 and high pitch.
EOxCloudless imagery is nominally 10 m per pixel and its source stops at z14.
Enlarging those tiles during the chase amplifies the softness. Changing their
display size or increasing their zoom cap cannot add native detail.

Use MapTiler Cloud Free's satellite-v2 raster tiles (native 512 px) with an
origin-restricted MAPTILER_BROWSER_KEY set in the Vercel Production environment
or local .env. The private activity response gives the browser this restricted
public-use key. Requests go straight to MapTiler only on explicit replay. Free
plan usage through MapLibre is metered in requests and pauses at the quota. Keep
the visible logo and text credit. EOxCloudless is the fallback for missing
configuration or imagery failures, including quota. Mapterhorn continues to
supply terrain. The camera, HUD, recorded route and controls retain their
existing behavior. No database migration is needed.

MapTiler documents about 1 m per pixel in much of populated coastal Australia.
Its official browser demo rendered central Melbourne using real z15/z16 tiles
with visible roof and street detail, and tile bodies decoded at 512 px. The
app's Chromium test used fixture responses to confirm z15 requests, timeline
inspection, close, HTTP 429 fallback and correct attribution. The exact
activity's imagery and physical iPhone Safari require the deployed browser key.

- [MapTiler satellite dataset](https://docs.maptiler.com/schema-raster/satellite/)
- [Official satellite preview](https://docs.maptiler.com/sdk-js/examples/satellite-map/)
- [Free plan pricing](https://www.maptiler.com/cloud/pricing/)
- [Free plan attribution](https://docs.maptiler.com/guides/map-design/attribution/add-attribution/)
- [Browser-key origin restrictions](https://docs.maptiler.com/guides/developer/credentials/api-key/)
