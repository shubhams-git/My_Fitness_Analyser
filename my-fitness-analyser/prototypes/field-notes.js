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

export function fieldNotesView({activity,icon,logo,dateText,distance,duration,paceText,summaryPace,escape,routePanel,stats,observationPanel,analysisPanel,blocksPanel,sourceNote,inlineCheckin,miniRoute,reduced,systemReduced,persisted=false,cloud=false}) {
  const kind=activityKind(activity), detailed=kind==='run';
  const gps=detailed&&activity.records.some(r=>r.lat!==null&&r.lon!==null);
  const canReplay=gps&&replayModel(activity.records).available;
  return `<header class="fn-header"><a href="/training" class="fn-brand" aria-label="My Fitness Analyser training">${logo}<span>My Fitness Analyser<small>Your training, collected.</small></span></a><nav aria-label="Activity navigation"><a href="/training">Training</a><a href="/training?view=progress">Progress</a><a href="/journal">Journal</a>${cloud?'<a href="/account">Account</a>':''}<button data-action="activities">Activities</button></nav><div class="fn-header-actions"><button class="fn-motion" data-action="motion" aria-pressed="${!reduced}" ${systemReduced?'disabled':''} aria-label="${systemReduced?'Motion follows system reduced-motion setting':'Toggle visual motion'}"><i aria-hidden="true"></i><span>${systemReduced?'System motion off':reduced?'Motion off':'Motion on'}</span></button><button class="icon-button" data-action="source" aria-label="Activity sources">${icon('layers')}</button>${cloud?'':'<button class="fn-avatar" data-action="review" aria-label="Preview settings">S</button>'}</div><div class="fn-reading-progress" aria-hidden="true"></div></header>
  <main id="main" class="fn-main">
    <section class="fn-hero ${detailed?'':'fn-workout'}" aria-labelledby="activity-title" id="overview">
      <div class="fn-aura" aria-hidden="true"></div>
      <div class="fn-intro"><p class="fn-date">${escape(detailed?activity.sport:activityLabels[kind])} <span></span> ${dateText(activity.date)}${activity.time?`<span class="fn-time">${escape(activity.time)}</span>`:''}</p><h1 id="activity-title">${escape(activity.title)}</h1><div class="fn-source"><span class="fn-source-dot"></span>${escape(activity.source)}${activity.synthetic?'<span class="synthetic-label">Synthetic data</span>':''}<button data-action="source" class="text-button" aria-label="View activity provenance">${icon('info')}</button></div></div>
      ${detailed?`<div class="fn-art">${routePanel()}<div class="fn-replay-controls"><button class="fn-replay" data-action="route-replay" aria-haspopup="dialog" ${!canReplay?'disabled':''}>${icon('play')}<span>${!canReplay?'Replay unavailable':'Replay route'}</span></button><a class="fn-data-link" href="#session-details">Run analysis ${icon('arrow')}</a></div></div>
      <div class="fn-primary"><div class="fn-distance"><span>${distance(activity.distance)}</span><small>km</small></div><p>${activity.distance!==null&&activity.distance<10?'Distance below 10 m · pace unavailable':'Distance covered'}</p><div class="fn-session-actions"><button class="primary-button" data-action="checkin">Log how it felt ${icon('arrow')}</button><a href="#session-details" class="fn-data-link">Explore session ${icon('chevrondown')}</a></div></div>
      <div class="fn-hero-footer">${stats()}<a class="fn-scroll-cue" href="#session-finding"><span>Explore this session</span>${icon('chevrondown')}</a></div> `:`<div class="fn-hero-footer">${stats()}</div>`}
    </section>
    ${detailed?`<section class="fn-finding fn-chapter" id="session-finding" aria-label="Session observation"><div class="fn-chapter-label"><span class="fn-hairline"></span><span>Session takeaway</span></div>${observationPanel()}<div class="fn-finding-foot"><a href="#session-details" class="fn-round-link" aria-label="Explore the session details">${icon('chevrondown')}</a></div></section>
    <section class="fn-details fn-chapter" id="session-details" aria-label="Recorded session details"><aside class="fn-atlas"><div class="fn-chapter-label"><span class="fn-hairline"></span><span>Session analysis</span></div><h2>Route</h2><div class="fn-mini-map">${gps?`<div class="route-svg">${miniRoute}</div>`:`<div class="fn-missing-route">${icon('route')}<p>No GPS in this record.<br>Your session facts are preserved.</p></div>`}</div><div class="fn-atlas-caption"><span class="route-selection">Full activity</span><span>${gps?'Recorded GPS · street map':'Source summary'}</span></div><p class="fn-atlas-note">${gps?'Choose a time block to connect the route and chart.':'Available summaries and displayed splits stay intact.'}</p></aside><div class="fn-detail-content">${analysisPanel()}${activity.records.length?`<details class="av-device-data"><summary>Minute blocks and device laps</summary>${blocksPanel()}</details>`:blocksPanel()}</div></section>
    <section class="fn-notes-section fn-chapter"><div class="fn-notes-aside"><p>A quick check-in captures what the watch can’t.</p></div>${inlineCheckin()}</section>`:''}
    ${sourceNote()}
    <footer class="fn-session-footer"><a href="/training">Back to training ${icon('arrow')}</a><button class="text-button" data-action="source">Activity sources ${icon('layers')}</button></footer>
  </main>`;
}
