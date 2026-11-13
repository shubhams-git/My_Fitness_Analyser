import {activityKind,activityLabels} from './activity-kind.js';
import { replayModel } from './replay-model.js';
// Preserve null/stationary samples and time gaps in the compact pace trace.
export function paceTrace(records) {
  const values=records.filter(r=>Number.isFinite(r.speed)&&r.speed>=1000/3600).map(r=>1000/r.speed);
  const end=records.at(-1)?.t;
  if(!values.length||!(end>0))return '';
  const min=Math.min(...values),max=Math.max(...values);
  let d='',drawing=false;
  for(let i=0;i<records.length;i++){
    const r=records[i];
    if(!Number.isFinite(r.speed)||r.speed<1000/3600){drawing=false;continue;}
    if(i&&r.t-records[i-1].t>30)drawing=false;
    d+=`${drawing?'L':'M'}${(r.t/end*600).toFixed(2)},${(12+(1000/r.speed-min)/Math.max(max-min,1)*60).toFixed(2)} `;drawing=true;
  }
  return d;
}

export function fieldNotesView({activity,archiveUrl='/training?view=sessions',previewLibrary=false,icon,dateText,distance,duration,paceText,summaryPace,escape,routePanel,stats,observationPanel,analysisPanel,blocksPanel,sourceNote,inlineCheckin,miniRoute,persisted=false}) {
  const kind=activityKind(activity), detailed=kind==='run';
  const gps=detailed&&activity.records.some(r=>Number.isFinite(r.lat)&&Number.isFinite(r.lon));
  const canReplay=gps&&replayModel(activity.records).available;
  return `<div class="fn-header activity-tools">
    <a class="text-button fn-back-sessions" href="${escape(archiveUrl)}">${icon('chevron')} Back to sessions</a>
    <div class="fn-header-actions">
      ${previewLibrary?'<button class="text-button" data-action="activities">Activity library</button>':''}
      ${activity.synthetic?'<button class="fn-avatar" data-action="review" aria-label="Preview settings">S</button>':''}
    </div>
  </div>
  <main id="main" class="fn-main">
    <section class="fn-hero ${detailed?'':'fn-workout'}" aria-labelledby="activity-title" id="overview">
      <div class="fn-aura" aria-hidden="true"></div>
      <div class="fn-intro"><p class="fn-date">${escape(detailed?activity.sport:activityLabels[kind])} <span></span> ${dateText(activity.date)}${activity.time?`<span class="fn-time">${escape(activity.time)}</span>`:''}</p><h1 id="activity-title">${escape(activity.title)}</h1><div class="fn-source"><span class="fn-source-dot"></span>${escape(activity.source)}${activity.synthetic?'<span class="synthetic-label">Synthetic data</span>':''}<button data-action="source" class="text-button" aria-label="View activity provenance">${icon('info')}</button></div></div>
      ${detailed?`${gps?`<div class="fn-art">${routePanel()}${canReplay?`<div class="fn-replay-controls"><button class="fn-replay" data-action="route-replay" aria-haspopup="dialog">${icon('play')}<span>Replay route</span></button></div>`:''}</div>`:''}
      <div class="fn-primary"><div class="fn-distance"><span>${distance(activity.distance)}</span><small>km</small></div><p>${activity.distance!==null&&activity.distance<10?'Distance below 10 m · pace unavailable':'Distance covered'}</p><div class="fn-session-actions"><button class="primary-button" data-action="checkin">Log how it felt</button><a href="#session-details" class="fn-data-link">${activity.records.length?'Run analysis':'Recorded splits'} ${icon('chevrondown')}</a></div></div>
      <div class="fn-hero-footer">${stats()}</div> `:`<div class="fn-hero-footer">${stats()}</div>`}
    </section>
    ${detailed?`<section class="fn-finding fn-chapter" id="session-finding" aria-label="Session observation"><div class="fn-chapter-label"><span class="fn-hairline"></span><span>Session takeaway</span></div>${observationPanel()}<div class="fn-finding-foot"><a href="#session-details" class="fn-round-link" aria-label="Explore the session details">${icon('chevrondown')}</a></div></section>
    <section class="fn-details fn-chapter${gps?'':' fn-summary-only'}" id="session-details" aria-label="Recorded session details">${gps?`<aside class="fn-atlas"><h2>Route and effort</h2><div class="fn-mini-map"><div class="route-svg">${miniRoute}</div></div><div class="fn-atlas-caption"><span class="route-selection">Full activity</span><span>Recorded GPS</span></div><p class="fn-atlas-note">Choose a time block to connect the route and chart.</p></aside>`:''}<div class="fn-detail-content">${!gps?'<p class="fn-atlas-note">No GPS in this record.</p>':''}${activity.records.length?`${analysisPanel()}<details class="av-device-data"><summary>Minute blocks and device laps</summary>${blocksPanel()}</details>`:blocksPanel()}</div></section>
    <section class="fn-notes-section fn-chapter"><div class="fn-notes-aside"><p>A quick check-in captures what the watch can’t.</p></div>${inlineCheckin()}</section>`:''}
    ${sourceNote()}
    <footer class="fn-session-footer"><a href="/training">Back to training ${icon('arrow')}</a><button class="text-button" data-action="source">Activity sources ${icon('layers')}</button></footer>
  </main>`;
}
