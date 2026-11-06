// The geographic canvas is mounted lazily by route-maps.js. No fake basemap.
export function routeView(g,records,state,name) {
  if(!g)return '';
  return `<div class="geo-map" data-real-map="${name}">
    <div class="geo-canvas" aria-label="Recorded route on an interactive street map"></div>
    <div class="geo-style" role="group" aria-label="Map appearance"><button type="button" data-map-style="streets" aria-pressed="true">Streets</button><button type="button" data-map-style="night" aria-pressed="false">Night</button></div>
    <button type="button" class="geo-fit" data-action="fit-route" aria-label="Fit full recorded route"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5M8 12h8m-4-4v8"/></svg></button>
    <div class="geo-status" role="status"><strong>Locating your effort.</strong><span>Loading streets, parks and places…</span></div>
    <div class="geo-recovery" hidden><strong>Street map unavailable.</strong><span>Your recorded activity is safe. Check your connection and try again.</span><button type="button" data-map-retry>Retry map</button></div>
  </div>`;
}
