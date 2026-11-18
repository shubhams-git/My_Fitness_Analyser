import { replayModel,replayPhase,replayFlight,replayMetrics,replayFraming,replayPullback } from './replay-model.js';
import { replayLightning } from './replay-lightning.js';
import { loadMapLibrary } from './route-maps.js';

const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function satelliteStyle(mapTilerBrowserKey){return {version:8,name:'Field Notes / Satellite',sources:{
  satellite:mapTilerBrowserKey?{
    type:'raster',tiles:[`https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}?key=${encodeURIComponent(mapTilerBrowserKey)}`],tileSize:512,maxzoom:22
  }:{type:'raster',tiles:['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg'],tileSize:256,maxzoom:14},
  terrain:{type:'raster-dem',tiles:['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'],tileSize:512,maxzoom:12,encoding:'terrarium'}
},layers:[{id:'earth',type:'raster',source:'satellite',paint:{'raster-fade-duration':250,'raster-saturation':-.08}}],sky:{'sky-color':'#477ba5','horizon-color':'#c7d9df','fog-color':'#c7d9df','sky-horizon-blend':.65,'horizon-fog-blend':.65,'fog-ground-blend':.12}};}

const eoxCredit='<a href="https://cloudless.eox.at" target="_blank" rel="noopener noreferrer">EOxCloudless</a> by EOX IT Services GmbH · Contains modified Copernicus Sentinel data 2024 · <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-NC-SA 4.0</a>';
const mapTilerCredit='<a class="satellite-provider-logo" href="https://www.maptiler.com/" target="_blank" rel="noopener noreferrer"><img src="https://api.maptiler.com/resources/logo.svg" alt="MapTiler"></a><a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener noreferrer">© MapTiler</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>';

export function createReplayMap(Map,container,model,key,options={}){
  return new Map({
    container,style:satelliteStyle(key),center:model.route.points[0].coordinate,zoom:11,
    maxPitch:60,interactive:false,attributionControl:false,
    transformRequest:url=>({url,credentials:'omit',referrerPolicy:'no-referrer'}),
    ...options
  });
}

export function addReplayRoute(map,model){
  map.addSource('replay-route',{type:'geojson',data:model.completeTrail,tolerance:0});
  for(const [id,color,width] of [['route-casing','#17212b',6],['route-guide','#9dafba',2.5]]){
    map.addLayer({id,type:'line',source:'replay-route',layout:{'line-cap':'round','line-join':'round'},
      paint:{'line-color':color,'line-width':width}});
  }
}

export function frameReplayMap(map,model,flight,footer,hud=0){
  const {clientHeight:height}=map.getContainer();
  const {fit,chase}=replayFraming(height,hud,footer);
  map.setPadding({top:0,bottom:0,left:0,right:0});
  const bounds=bearing=>{
    const shot=map.cameraForBounds(model.route.bounds,{padding:fit,maxZoom:14,bearing});
    if(!shot)return {center:model.route.points[0].coordinate,zoom:11,bearing};
    return {...shot,center:shot.center.toArray(),bearing};
  };
  return {fit:bounds(0),opening:bounds(flight.openingBearing),closing:bounds(flight.closingBearing),chase};
}

export function replayShot(model,clock,reduced){
  const phase=reduced?{name:'inspection',time:clock/model.duration*model.end}:replayPhase(clock,model.end,model.duration);
  const sample=model.sample(phase.time);
  const following=phase.name==='following';
  const exit=reduced?0:replayPullback(clock,model.duration);
  const coordinate=following||phase.name==='finished'||reduced?sample.coordinate:model.route.points[0].coordinate;
  const energy=following?Math.min(1,phase.followSeconds*2)*(1-exit):0;
  const wake=energy>0?model.wake(phase.time,sample,model.end/model.duration*.75):[];
  const covered=model.coveredTrail(phase.time);
  return {phase,sample,exit,effect:{coordinate,covered,points:wake,seconds:clock,energy,overview:following?(1-exit)*Math.min(1,phase.followSeconds):0}};
}

export function openSatelliteReplay({activity,mapTilerBrowserKey,opener,reduced=false,onClose}){
  const model=replayModel(activity.records);if(!model.available)return null;
  const flight=replayFlight(model),abort=new AbortController();
  let map,raf=0,generation=0,dead=false,ready=false,playing=false,clock=0,last=0,lastData=-1,lastPhase=null,framing,effect,loaded=false,terrainFailed=false,imageryFailed=false,imageryLoaded=false,useMapTiler=Boolean(mapTilerBrowserKey),resumeOnLoad=true,exportJob,storyUrl;
  const dialog=document.createElement('dialog');dialog.className='satellite-replay';dialog.setAttribute('aria-labelledby','satellite-title');dialog.dataset.phase='loading';
  const controlIcon=(path)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="${path}"/></svg>`;
  dialog.innerHTML=`<div class="satellite-hud"><header class="satellite-header"><div><h2 id="satellite-title">${escape(activity.title)}</h2><p>Route replay <span>· Satellite</span></p></div><button type="button" class="satellite-close" aria-label="Close route replay">${controlIcon('m6 6 12 12M6 18 18 6')}</button></header><dl class="satellite-metrics"><div><dt>Pace <span>/km</span></dt><dd data-replay-metric="pace">—</dd></div><div><dt>Elevation <span>m</span></dt><dd data-replay-metric="elevation">—</dd></div><div><dt>Distance <span>km</span></dt><dd data-replay-metric="distance">—</dd></div></dl></div><div class="satellite-stage"><div class="satellite-canvas"></div><div class="satellite-shade" aria-hidden="true"></div><div class="satellite-message" role="status"><strong>Finding your start.</strong><span>Loading satellite imagery…</span><button type="button" data-replay-retry hidden>Retry imagery</button></div><span class="satellite-credit"><span data-imagery-credit></span> · Terrain <a href="https://mapterhorn.com/attribution/" target="_blank" rel="noopener noreferrer">© Mapterhorn &amp; sources</a></span></div><footer class="satellite-footer"><div class="satellite-position"><span data-replay-phase>Satellite overview</span><span><output data-replay-elapsed aria-live="off">0:00</output> elapsed</span></div><label class="sr-only" for="satellite-time">Replay position</label><input id="satellite-time" type="range" min="0" max="${model.duration}" step=".05" value="0" disabled><div class="satellite-controls"><button type="button" data-replay-restart disabled>${controlIcon('M3 10a9 9 0 1 1 1 8M3 4v6h6')}<span>Restart</span></button><button type="button" data-replay-play disabled>${controlIcon('m9 5 11 7-11 7V5Z')}<span>Loading…</span></button></div></footer>`;
  const pageScroll={x:window.scrollX,y:window.scrollY},bodyStyle={};
  for(const key of ['position','top','left','width','overflow'])bodyStyle[key]=document.body.style[key];
  Object.assign(document.body.style,{position:'fixed',top:`${-pageScroll.y}px`,left:`${-pageScroll.x}px`,width:'100%',overflow:'hidden'});
  document.documentElement.classList.add('replay-open');document.body.append(dialog);
  function viewport(){const v=window.visualViewport;for(const [key,value]of Object.entries({height:v?.height??innerHeight,width:v?.width??innerWidth,top:v?.offsetTop??0,left:v?.offsetLeft??0}))dialog.style.setProperty(`--replay-${key}`,`${value}px`);}
  viewport();dialog.showModal();dialog.scrollTop=0;dialog.querySelector('.satellite-close').focus({preventScroll:true});
  window.visualViewport?.addEventListener('resize',viewport,{signal:abort.signal});
  window.visualViewport?.addEventListener('scroll',viewport,{signal:abort.signal});
  window.addEventListener('resize',viewport,{signal:abort.signal});
  const $=s=>dialog.querySelector(s),play=$('[data-replay-play]'),slider=$('#satellite-time'),message=$('.satellite-message');
  const exportButton=document.createElement('button');
  exportButton.type='button';
  exportButton.disabled=true;
  exportButton.innerHTML=`${controlIcon('M12 3v12m-5-5 5 5 5-5M5 16v4h14v-4')}<span>Download Story</span>`;
  const storyLink=document.createElement('a');
  storyLink.hidden=true;
  storyLink.textContent='Save Story MP4';
  $('.satellite-controls').append(exportButton,storyLink);
  const exportStatus=document.createElement('p');
  exportStatus.className='satellite-export-status';
  exportStatus.setAttribute('role','status');
  $('.satellite-footer').append(exportStatus);
  exportButton.addEventListener('click',async()=>{
    if(exportJob||!ready||dead)return;
    pause();
    exportJob=new AbortController();
    exportButton.disabled=true;
    storyLink.hidden=true;
    if(storyUrl){URL.revokeObjectURL(storyUrl);storyUrl=null;}
    exportStatus.textContent='Preparing the 9:16 Story…';
    try{
      const {recordReplayStory}=await import('./replay-export.js');
      exportJob.signal.throwIfAborted();
      const blob=await recordReplayStory({activity,model,flight,container:dialog,signal:exportJob.signal,onProgress:percent=>{
        exportStatus.textContent=percent===100?'Finishing your MP4…':`Rendering your Story… ${percent}%`;
      }});
      if(dead)return;
      const title=activity.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
      storyUrl=URL.createObjectURL(blob);
      storyLink.href=storyUrl;
      storyLink.download=`${title||'route'}-story.mp4`;
      storyLink.hidden=false;
      exportButton.hidden=true;
      exportStatus.textContent='Story ready · 1080 × 1920 MP4';
      storyLink.focus({preventScroll:true});
      storyLink.click();
    }catch(error){
      if(!dead)exportStatus.textContent=error.message||'Could not create your Story. Try downloading again.';
    }finally{
      exportJob=null;
      exportButton.disabled=!ready;
    }
  },{signal:abort.signal});
  const lightning=document.createElement('canvas');
  lightning.className='satellite-lightning';
  lightning.setAttribute('aria-hidden','true');
  $('.satellite-canvas').after(lightning);
  const paintLightning=replayLightning(lightning,model.route);
  const phaseLabel=$('[data-replay-phase]');
  const showCredits=()=>{$('[data-imagery-credit]').innerHTML=useMapTiler?mapTilerCredit:eoxCredit;};
  showCredits();
  const setPlaying=value=>{playing=value;play.querySelector('span').textContent=value?'Pause':clock>=model.duration?'Play again':'Play';play.querySelector('path').setAttribute('d',value?'M9 5v14M15 5v14':'m9 5 11 7-11 7V5Z');};
  function pause(){setPlaying(false);cancelAnimationFrame(raf);last=0;}
  function frame(){framing=frameReplayMap(map,model,flight,$('.satellite-credit').offsetHeight);}
  function draw(seek=false){
    if(!ready||dead)return;
    const shot=replayShot(model,clock,reduced),{phase,sample,exit}=shot;
    effect=shot.effect;
    if(!reduced||seek)map.jumpTo(flight.cameraAt(clock,framing,{reduced,sharpImagery:useMapTiler}));
    else map.triggerRepaint();

    if(seek||Math.abs(clock-lastData)>=.09||phase.name!==lastPhase||clock===model.duration){
      lastData=clock;lastPhase=phase.name;
      const metrics=replayMetrics(sample.row);
      for(const [key,value]of Object.entries(metrics)){const out=$(`[data-replay-metric="${key}"]`);if(out)out.textContent=value;}
      $('[data-replay-elapsed]').textContent=metrics.elapsed;
      slider.value=clock;slider.setAttribute('aria-valuetext',`${metrics.elapsed} recorded time; ${phase.name}`);
    }
    dialog.dataset.phase=phase.name;
    const label=phase.name==='inspection'?'Motion off · inspect with the timeline'
      :phase.name==='overview'?'Your route, from above'
      :phase.name==='descent'?'Gliding to the start'
      :exit===1?'Your complete route'
      :exit>0?'Pulling back'
      :sample.gap?'GPS gap · waiting for next fix':'Following your run';
    if(phaseLabel.textContent!==label)phaseLabel.textContent=label;
  }
  function tick(now){
    if(!playing||dead)return;
    const elapsed=last?(now-last)/1000:0;
    last=now;
    // Let a busy device slow the replay briefly instead of skipping the camera ahead.
    clock=Math.min(model.duration,clock+Math.min(elapsed,.08));
    draw();
    if(clock>=model.duration){pause();return;}
    raf=requestAnimationFrame(tick);
  }
  function start(){if(!ready||reduced||dead||document.hidden)return;if(clock>=model.duration){clock=0;draw(true);}setPlaying(true);last=0;raf=requestAnimationFrame(tick);}
  function fail(){if(dead)return;pause();ready=false;imageryFailed=true;dialog.dataset.phase='error';message.hidden=false;message.querySelector('strong').textContent='Satellite imagery unavailable.';message.querySelector('span').textContent='Check your connection, retry, or close to return to your street map.';$('[data-replay-retry]').hidden=false;play.disabled=true;slider.disabled=true;exportButton.disabled=true;$('[data-replay-restart]').disabled=true;}
  function destroy(){if(dead)return;dead=true;pause();clearTimeout(timeout);exportJob?.abort();if(storyUrl)URL.revokeObjectURL(storyUrl);abort.abort();resize.disconnect();map?.remove();dialog.remove();document.documentElement.classList.remove('replay-open');Object.assign(document.body.style,bodyStyle);window.scrollTo({left:pageScroll.x,top:pageScroll.y,behavior:'instant'});onClose?.();if(opener?.isConnected)opener.focus({preventScroll:true});}
  $('.satellite-close').addEventListener('click',()=>dialog.close(),{signal:abort.signal});dialog.addEventListener('close',destroy,{signal:abort.signal});
  play.addEventListener('click',()=>playing?pause():start(),{signal:abort.signal});
  $('[data-replay-restart]').addEventListener('click',()=>{pause();clock=0;draw(true);start();},{signal:abort.signal});
  slider.addEventListener('input',()=>{pause();clock=Number(slider.value);draw(true);setPlaying(false);},{signal:abort.signal});
  function loadImagery(preferMapTiler){
    ++generation;
    clearTimeout(timeout);
    $('.satellite-canvas').removeAttribute('aria-description');
    ready=false;
    map?.remove();map=null;
    loaded=false;terrainFailed=false;imageryFailed=false;imageryLoaded=false;
    useMapTiler=preferMapTiler;
    showCredits();
    dialog.dataset.phase='loading';message.hidden=false;
    message.querySelector('strong').textContent='Finding your start.';
    message.querySelector('span').textContent='Loading satellite imagery…';
    $('[data-replay-retry]').hidden=true;play.disabled=true;slider.disabled=true;exportButton.disabled=true;
    $('[data-replay-restart]').disabled=true;play.querySelector('span').textContent='Loading…';
    timeout=setTimeout(imageryUnavailable,25000);
    void create();
  }
  function imageryUnavailable(){
    if(dead||imageryFailed)return;
    if(!useMapTiler){fail();return;}
    if(ready)resumeOnLoad=playing;
    pause();
    loadImagery(false);
  }
  $('[data-replay-retry]').addEventListener('click',()=>{
    if(dead)return;
    clock=0;resumeOnLoad=true;
    $('.satellite-close').focus({preventScroll:true});
    loadImagery(Boolean(mapTilerBrowserKey));
  },{signal:abort.signal});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){
    pause();
    exportJob?.abort(new Error('Keep this tab visible while recording, then try again.'));
  }},{signal:abort.signal});
  window.addEventListener('pagehide',destroy,{signal:abort.signal});
  const motion=matchMedia('(prefers-reduced-motion: reduce)');motion.addEventListener('change',e=>{if(e.matches){reduced=true;pause();draw(true);play.disabled=true;$('[data-replay-restart]').disabled=true;}},{signal:abort.signal});
  const resize=new ResizeObserver(()=>{if(!map||dead)return;map.resize();frame();if(ready)draw(true);});for(const el of [$('.satellite-stage'),$('.satellite-credit')])resize.observe(el);
  let timeout=setTimeout(imageryUnavailable,25000);
  function create(){const attempt=++generation;return loadMapLibrary().then(m=>{
    if(dead||attempt!==generation)return;
    map=createReplayMap(m.Map,$('.satellite-canvas'),model,useMapTiler?mapTilerBrowserKey:null,{
      pixelRatio:Math.min(window.devicePixelRatio||1,1.75)
    });
    map.getCanvas().setAttribute('aria-label','Satellite route replay. Use the playback controls to play, pause or inspect your run.');map.getCanvas().tabIndex=-1;
    frame();map.jumpTo(flight.cameraAt(clock,framing,{reduced,sharpImagery:useMapTiler}));
    map.on('render',()=>{if(ready&&attempt===generation)paintLightning(map,effect,$('.satellite-credit').offsetHeight+14);});
    map.on('load',()=>{if(dead||attempt!==generation)return;
      loaded=true;addReplayRoute(map,model);
      if(!terrainFailed)map.setTerrain({source:'terrain',exaggeration:1});
    });
    map.on('sourcedata',e=>{if(attempt===generation&&e.sourceId==='satellite'&&e.tile?.state==='loaded')imageryLoaded=true;});
    map.on('idle',()=>{if(dead||attempt!==generation||ready||imageryFailed||!imageryLoaded||!loaded||!map.isSourceLoaded('satellite'))return;clearTimeout(timeout);ready=true;message.hidden=true;play.disabled=reduced;slider.disabled=false;exportButton.disabled=Boolean(exportJob);$('[data-replay-restart]').disabled=reduced;setPlaying(false);draw(true);if(!reduced&&resumeOnLoad)start();});
    map.on('error',e=>{if(dead||attempt!==generation)return;if(e.sourceId==='terrain'){if(!terrainFailed){terrainFailed=true;map.setTerrain(null);$('.satellite-canvas').setAttribute('aria-description','Terrain unavailable; satellite imagery is shown on a flat surface.');}return;}if(e.sourceId==='satellite'||!ready)queueMicrotask(()=>{if(attempt===generation)imageryUnavailable();});});
    map.on('webglcontextlost',fail);
  }).catch(()=>{if(attempt===generation)fail();});}
  void create();
  return {destroy};
}
