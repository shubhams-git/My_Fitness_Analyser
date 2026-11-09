import { replayModel,replayPhase,followCamera,replayMetrics,replayFraming,angleDelta } from './replay-model.js';
import { loadMapLibrary } from './route-maps.js';

const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function satelliteStyle(){return {version:8,name:'Field Notes / Satellite',sources:{
  satellite:{type:'raster',tiles:['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg'],tileSize:256,maxzoom:14},
  terrain:{type:'raster-dem',tiles:['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'],tileSize:512,maxzoom:12,encoding:'terrarium'}
},layers:[{id:'earth',type:'raster',source:'satellite',paint:{'raster-fade-duration':250,'raster-saturation':-.08}}],sky:{'sky-color':'#477ba5','horizon-color':'#c7d9df','fog-color':'#c7d9df','sky-horizon-blend':.65,'horizon-fog-blend':.65,'fog-ground-blend':.12}};}

export function openSatelliteReplay({activity,reduced=false,onClose}){
  const model=replayModel(activity.records);if(!model.available)return null;
  const opener=document.activeElement,abort=new AbortController();let map,marker,raf=0,generation=0,dead=false,ready=false,playing=false,clock=0,last=0,lastData=-1,camera=null,overview=null,framing=null,loaded=false,terrainFailed=false,imageryFailed=false,imageryLoaded=false;
  const dialog=document.createElement('dialog');dialog.className='satellite-replay';dialog.setAttribute('aria-labelledby','satellite-title');dialog.dataset.phase='loading';
  const controlIcon=(path)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="${path}"/></svg>`;
  dialog.innerHTML=`<div class="satellite-canvas"></div><div class="satellite-shade" aria-hidden="true"></div><div class="satellite-hud"><header class="satellite-header"><div><h2 id="satellite-title">${escape(activity.title)}</h2><p>Route replay <span>· Satellite</span></p></div><button type="button" class="satellite-close" aria-label="Close route replay">${controlIcon('m6 6 12 12M6 18 18 6')}</button></header><dl class="satellite-metrics"><div><dt>Pace <span>/km</span></dt><dd data-replay-metric="pace">—</dd></div><div><dt>Elevation <span>m</span></dt><dd data-replay-metric="elevation">—</dd></div><div><dt>Distance <span>km</span></dt><dd data-replay-metric="distance">—</dd></div></dl></div><div class="satellite-message" role="status"><strong>Finding your start.</strong><span>Loading satellite imagery…</span><button type="button" data-replay-retry hidden>Retry imagery</button></div><footer class="satellite-footer"><div class="satellite-position"><span data-replay-phase>Satellite overview</span><span><output data-replay-elapsed aria-live="off">0:00</output> elapsed</span></div><label class="sr-only" for="satellite-time">Replay position</label><input id="satellite-time" type="range" min="0" max="${model.duration}" step=".05" value="0" disabled><div class="satellite-controls"><button type="button" data-replay-restart disabled>${controlIcon('M3 10a9 9 0 1 1 1 8M3 4v6h6')}<span>Restart</span></button><button type="button" data-replay-play disabled>${controlIcon('m9 5 11 7-11 7V5Z')}<span>Loading…</span></button><span class="satellite-credit"><a href="https://cloudless.eox.at" target="_blank" rel="noopener noreferrer">EOxCloudless</a> by EOX IT Services GmbH<br>Contains modified Copernicus Sentinel data 2024 · <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-NC-SA 4.0</a><br>Terrain <a href="https://mapterhorn.com/attribution/" target="_blank" rel="noopener noreferrer">© Mapterhorn &amp; sources</a></span></div><details class="satellite-info"><summary>About this view</summary><p>Real satellite imagery at approximately 10 m resolution, draped over open terrain. Buildings are photographic, not 3D models. Imagery and terrain providers receive the viewed tile area; your run records stay in the app. Metrics use recorded samples; GPS gaps stay open.</p></details></footer>`;
  document.body.append(dialog);dialog.showModal();document.documentElement.classList.add('replay-open');
  const $=s=>dialog.querySelector(s),play=$('[data-replay-play]'),slider=$('#satellite-time'),message=$('.satellite-message');
  const setPlaying=value=>{playing=value;play.querySelector('span').textContent=value?'Pause':clock>=model.duration?'Play again':'Play';play.querySelector('path').setAttribute('d',value?'M9 5v14M15 5v14':'m9 5 11 7-11 7V5Z');};
  function pause(){setPlaying(false);cancelAnimationFrame(raf);last=0;}
  function frame(){framing=replayFraming(dialog.clientHeight,$('.satellite-hud').offsetHeight,$('.satellite-footer').offsetHeight);map.setPadding({top:0,bottom:0,left:0,right:0});overview=map.cameraForBounds(model.route.bounds,{padding:framing.fit,maxZoom:13.2});}
  function draw(dt=0,seek=false){
    if(!ready||dead)return;
    const phase=replayPhase(clock,model.end,model.duration),first=model.route.points[0],sample=model.sample(phase.time),anchor=sample.coordinate?sample:{...sample,coordinate:first.coordinate,heading:model.sample(first.row.t).heading};
    if(phase.name==='overview')camera={center:overview.center.toArray(),bearing:0};
    else if(phase.name==='descent')camera={center:overview.center.toArray().map((v,n)=>v+(first.coordinate[n]-v)*phase.descent),bearing:anchor.heading*phase.descent};
    else camera=followCamera(seek?null:camera,sample,dt)||camera;
    const exit=phase.name==='finished'?1-(1-phase.outro)**3:0,followPitch=76-7*Math.min(1,Math.max(0,(clock-3.8)/1.4));
    if(phase.name==='finished'){const end=sample.coordinate||model.route.points.at(-1).coordinate,heading=sample.heading??0;camera={center:end.map((v,n)=>v+(overview.center.toArray()[n]-v)*exit),bearing:heading+angleDelta(heading,0)*exit};}
    const zoom=phase.name==='overview'?overview.zoom:phase.name==='descent'?overview.zoom+(14-overview.zoom)*phase.descent:14+(overview.zoom-14)*exit;
    const padding=Object.fromEntries(Object.entries(framing.chase).map(([key,v])=>[key,v*phase.descent*(1-exit)]));
    map.jumpTo({center:camera.center,bearing:camera.bearing,zoom,pitch:reduced?0:(phase.name==='descent'?76:followPitch)*phase.descent*(1-exit),padding});
    if(sample.coordinate&&phase.name!=='overview'&&phase.name!=='descent'){marker.setLngLat(sample.coordinate);marker.getElement().hidden=false;}else marker.getElement().hidden=true;
    if(seek||Math.abs(clock-lastData)>=.09||phase.name==='finished'){map.getSource('replay-trail').setData(sample.trail);lastData=clock;
      const metrics=replayMetrics(sample.row);for(const [key,value]of Object.entries(metrics)){const out=$(`[data-replay-metric="${key}"]`);if(out)out.textContent=value;} $('[data-replay-elapsed]').textContent=metrics.elapsed;slider.value=clock;slider.setAttribute('aria-valuetext',`${metrics.elapsed} recorded time; ${phase.name}`);
    }
    dialog.dataset.phase=phase.name;$('[data-replay-phase]').textContent=phase.name==='overview'?'Your route, from above':phase.name==='descent'?'Descending to your start':phase.name==='finished'?'Finish reached':sample.gap?'GPS gap · waiting for next fix':'Following your run';
  }
  function tick(now){if(!playing||dead)return;const dt=last?Math.min((now-last)/1000,.25):0;last=now;clock=Math.min(model.duration,clock+dt);draw(dt);if(clock>=model.duration){pause();return;}raf=requestAnimationFrame(tick);}
  function start(){if(!ready||reduced||dead||document.hidden)return;if(clock>=model.duration){clock=0;camera=null;draw(0,true);}setPlaying(true);last=0;raf=requestAnimationFrame(tick);}
  function fail(){if(dead)return;pause();ready=false;imageryFailed=true;dialog.dataset.phase='error';message.hidden=false;message.querySelector('strong').textContent='Satellite imagery unavailable.';message.querySelector('span').textContent='Check your connection, retry, or close to return to your street map.';$('[data-replay-retry]').hidden=false;play.disabled=true;slider.disabled=true;$('[data-replay-restart]').disabled=true;}
  function destroy(){if(dead)return;dead=true;pause();clearTimeout(timeout);abort.abort();resize.disconnect();marker?.remove();map?.remove();dialog.remove();document.documentElement.classList.remove('replay-open');onClose?.();if(opener?.isConnected)opener.focus({preventScroll:true});}
  $('.satellite-close').addEventListener('click',()=>dialog.close(),{signal:abort.signal});dialog.addEventListener('close',destroy,{signal:abort.signal});
  play.addEventListener('click',()=>playing?pause():start(),{signal:abort.signal});
  $('[data-replay-restart]').addEventListener('click',()=>{pause();clock=0;camera=null;draw(0,true);start();},{signal:abort.signal});
  slider.addEventListener('input',()=>{pause();clock=Number(slider.value);draw(0,true);setPlaying(false);},{signal:abort.signal});
  $('[data-replay-retry]').addEventListener('click',()=>{if(dead)return;message.hidden=true;$('[data-replay-retry]').hidden=true;map?.remove();marker?.remove();map=null;marker=null;ready=false;loaded=false;terrainFailed=false;imageryFailed=false;imageryLoaded=false;clock=0;camera=null;dialog.dataset.phase='loading';message.hidden=false;message.querySelector('strong').textContent='Finding your start.';message.querySelector('span').textContent='Loading satellite imagery…';play.querySelector('span').textContent='Loading…';$('.satellite-close').focus({preventScroll:true});clearTimeout(timeout);timeout=setTimeout(fail,25000);void create();},{signal:abort.signal});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();},{signal:abort.signal});
  window.addEventListener('pagehide',destroy,{signal:abort.signal});
  const motion=matchMedia('(prefers-reduced-motion: reduce)');motion.addEventListener('change',e=>{if(e.matches){reduced=true;pause();draw(0,true);play.disabled=true;$('[data-replay-restart]').disabled=true;}},{signal:abort.signal});
  const resize=new ResizeObserver(()=>{if(!map||dead)return;map.resize();frame();if(ready)draw(0,true);});for(const el of [dialog,$('.satellite-hud'),$('.satellite-footer')])resize.observe(el);
  let timeout=setTimeout(fail,25000);
  function create(){const attempt=++generation;return loadMapLibrary().then(m=>{
    if(dead||attempt!==generation)return;map=new m.Map({container:$('.satellite-canvas'),style:satelliteStyle(),center:model.route.points[0].coordinate,zoom:11,maxPitch:82,interactive:false,attributionControl:false,renderWorldCopies:true,canvasContextAttributes:{preserveDrawingBuffer:false},transformRequest:url=>({url,credentials:'omit',referrerPolicy:'no-referrer'})});
    const dot=document.createElement('span');dot.className='satellite-runner';dot.setAttribute('aria-hidden','true');marker=new m.Marker({element:dot}).setLngLat(model.route.points[0].coordinate).addTo(map);dot.hidden=true;
    map.getCanvas().setAttribute('aria-label','Satellite route replay. Use the playback controls to play, pause or inspect your run.');map.getCanvas().tabIndex=-1;
    frame();map.jumpTo(overview);
    map.on('load',()=>{if(dead||attempt!==generation)return;loaded=true;map.addSource('replay-trail',{type:'geojson',data:{type:'FeatureCollection',features:[]},tolerance:0});
      for(const [id,color,width]of [['trail-casing','#17212b',9],['trail','#ff793e',5]])map.addLayer({id,type:'line',source:'replay-trail',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':color,'line-width':width}});
      if(!terrainFailed)map.setTerrain({source:'terrain',exaggeration:1});
    });
    map.on('sourcedata',e=>{if(attempt===generation&&e.sourceId==='satellite'&&e.tile?.state==='loaded')imageryLoaded=true;});
    map.on('idle',()=>{if(dead||attempt!==generation||ready||imageryFailed||!imageryLoaded||!loaded||!map.isSourceLoaded('satellite'))return;clearTimeout(timeout);ready=true;message.hidden=true;play.disabled=reduced;slider.disabled=false;$('[data-replay-restart]').disabled=reduced;setPlaying(false);draw(0,true);if(reduced){$('[data-replay-phase]').textContent='Motion off · inspect with the timeline';}else start();});
    map.on('error',e=>{if(dead||attempt!==generation)return;if(e.sourceId==='terrain'){if(!terrainFailed){terrainFailed=true;map.setTerrain(null);$('.satellite-info p').textContent='Terrain unavailable; satellite imagery is shown on a flat surface. Imagery providers receive the viewed tile area; your run records stay in the app. Metrics use recorded samples; GPS gaps stay open.';}return;}if(e.sourceId==='satellite'||!ready)fail();});
    map.on('webglcontextlost',fail);
  }).catch(fail);}
  void create();
  return {destroy};
}
