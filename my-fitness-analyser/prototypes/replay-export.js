import { loadMapLibrary } from './route-maps.js';
import { replayMetrics } from './replay-model.js';
import { replayLightning } from './replay-lightning.js';
import { addReplayRoute,createReplayMap,frameReplayMap,replayShot } from './satellite-replay.js';

const width=540,height=960,scale=2,fps=30,bitrate=9_000_000;
const eoxCredit=[
  'EOxCloudless · cloudless.eox.at · EOX IT Services GmbH',
  'Contains modified Copernicus Sentinel data 2024',
  'CC BY-NC-SA 4.0 · creativecommons.org/licenses/by-nc-sa/4.0'
];
const mapTilerCredit=['© MapTiler · maptiler.com/copyright','© OpenStreetMap contributors · openstreetmap.org/copyright'];

async function loadStoryLogo(logoUrl,signal){
  const response=await fetch(logoUrl,{credentials:'omit',signal:AbortSignal.any([signal,AbortSignal.timeout(10000)])});
  if(!response.ok)throw new Error('Map credits could not load. Try downloading again.');
  const url=URL.createObjectURL(await response.blob());
  try{
    const logo=new Image();
    logo.src=url;
    await logo.decode();
    return logo;
  }finally{
    URL.revokeObjectURL(url);
  }
}

function storyPainter(canvas,activity,logo,terrain){
  const ctx=canvas.getContext('2d',{alpha:false});
  if(!ctx)throw new Error('This browser could not prepare the Story canvas.');
  ctx.scale(scale,scale);
  const shade=ctx.createLinearGradient(0,0,0,height);
  for(const [position,color] of [[0,'#080e16'],[.19,'#080e16d9'],[.31,'#080e1600'],
    [.64,'#080e1600'],[.8,'#080e16e8'],[1,'#080e16']])shade.addColorStop(position,color);
  const display='Barlow Condensed, system-ui, sans-serif';
  function text(value,x,y,font,color,maxWidth=width-72){
    ctx.fillStyle=color;
    ctx.font=font;
    ctx.fillText(value,x,y,maxWidth);
  }
  const credits=[...(logo?mapTilerCredit:eoxCredit)];
  if(terrain)credits.push('Terrain © Mapterhorn & sources · mapterhorn.com/attribution');
  return (map,lightning,shot)=>{
    ctx.fillStyle='#080e16';
    ctx.fillRect(0,0,width,height);
    ctx.drawImage(map.getCanvas(),0,0,width,height);
    ctx.drawImage(lightning,0,0,width,height);
    ctx.fillStyle=shade;
    ctx.fillRect(0,0,width,height);
    text(activity.title,36,207,`700 51px ${display}`,'#fff8ef');
    ctx.fillStyle='#ff9c63';
    ctx.fillRect(36,225,40,2);
    const metrics=replayMetrics(shot.sample.row);
    const stats=[['DISTANCE · KM',metrics.distance],['PACE · /KM',metrics.pace],['ELAPSED',metrics.elapsed]];
    for(const [index,[label,value]] of stats.entries()){
      const x=36+index*164;
      text(label,x,718,'700 13px Manrope, sans-serif','#f4c7ad');
      text(value,x,757,`700 38px ${display}`,'#fff8ef',148);
    }
    if(logo){
      ctx.fillStyle='#f2f7fc';
      ctx.fillRect(width-108,778,72,23);
      ctx.drawImage(logo,width-105,780,66,19);
    }
    credits.forEach((line,index)=>text(line,36,788+index*13,'500 11px Manrope, sans-serif','#e8e5e0',logo?width-151:width-72));
  };
}

function waitForMap(map,model,terrain,signal){
  return new Promise((resolve,reject)=>{
    let loaded=false,imagery=false;
    const timeout=setTimeout(()=>finish(new Error('Story imagery took too long to load. Try downloading again.')),24000);
    const abort=()=>finish(signal.reason);
    function finish(error){
      clearTimeout(timeout);
      signal.removeEventListener('abort',abort);
      map.off('load',load);
      map.off('sourcedata',sourceData);
      map.off('idle',idle);
      if(error)reject(error);
      else resolve();
    }
    function load(){
      addReplayRoute(map,model);
      map.setPaintProperty('earth','raster-fade-duration',0);
      if(terrain)map.setTerrain(terrain);
      loaded=true;
    }
    function sourceData(event){
      if(event.sourceId==='satellite'&&event.tile?.state==='loaded')imagery=true;
    }
    function idle(){
      if(loaded&&imagery&&map.areTilesLoaded())finish();
    }
    signal.addEventListener('abort',abort,{once:true});
    map.on('load',load);
    map.on('sourcedata',sourceData);
    map.on('idle',idle);
  });
}

function waitForTiles(map,signal){
  if(map.areTilesLoaded())return;
  return new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>finish(new Error('Full-detail map tiles took too long to load. Try downloading again.')),15000);
    const abort=()=>finish(signal.reason);
    const idle=()=>finish();
    function finish(error){
      clearTimeout(timeout);
      signal.removeEventListener('abort',abort);
      map.off('idle',idle);
      if(error)reject(error);
      else resolve();
    }
    signal.addEventListener('abort',abort,{once:true});
    map.on('idle',idle);
  });
}

export async function recordReplayStory({activity,model,flight,scene,container,signal:parentSignal,onProgress}){
  if(!scene)throw new Error('Refresh this page to open the latest replay, then try downloading again.');
  const graphics=new AbortController();
  const signal=AbortSignal.any([parentSignal,graphics.signal]);
  const {mapTilerBrowserKey,logoUrl,terrain,chaseFitZoom}=scene;
  const sharpImagery=Boolean(mapTilerBrowserKey);
  const canvas=document.createElement('canvas');
  canvas.width=width*scale;
  canvas.height=height*scale;
  const [{Map},{Output,Mp4OutputFormat,BufferTarget,CanvasSource,canEncodeVideo}]=await Promise.all([
    loadMapLibrary(),import('/assets/vendor/mediabunny.min.mjs')
  ]);
  if(!await canEncodeVideo('avc',{width:canvas.width,height:canvas.height,bitrate})){
    throw new Error('MP4 export needs H.264 encoding support. Try this in current Safari or Chrome.');
  }
  const logo=sharpImagery?await loadStoryLogo(logoUrl,signal):null;
  signal.throwIfAborted();
  const stage=document.createElement('div'),host=document.createElement('div'),lightning=document.createElement('canvas');
  stage.className='satellite-export-stage';
  stage.setAttribute('aria-hidden','true');
  host.className='satellite-canvas';
  lightning.className='satellite-lightning';
  stage.append(host,lightning);
  container.append(stage);
  let map,output;
  try{
    map=createReplayMap(Map,host,model,mapTilerBrowserKey,{pixelRatio:scale,canvasContextAttributes:{preserveDrawingBuffer:true}});
    map.on('webglcontextlost',()=>graphics.abort(new Error('The map lost its graphics connection. Try downloading again.')));
    map.on('error',event=>{
      if(event.sourceId==='satellite'||event.sourceId==='terrain'){
        graphics.abort(new Error('A replay map tile could not load. Try downloading again.'));
      }
    });
    const framing={...frameReplayMap(map,model,flight,226,210),chaseFitZoom};
    map.jumpTo(flight.cameraAt(0,framing,{sharpImagery}));
    await waitForMap(map,model,terrain,signal);
    signal.throwIfAborted();
    const paintLightning=replayLightning(lightning,model.route,scale),paintStory=storyPainter(canvas,activity,logo,terrain);
    const target=new BufferTarget(),source=new CanvasSource(canvas,{codec:'avc',bitrate});
    output=new Output({format:new Mp4OutputFormat(),target});
    output.addVideoTrack(source,{frameRate:fps});
    await output.start();
    const frames=Math.ceil(model.duration*fps);
    let percent=-1;
    for(let index=0;index<frames;index++){
      signal.throwIfAborted();
      const seconds=index/fps;
      const next=Math.floor(index/frames*20)*5;
      if(next!==percent){percent=next;onProgress(percent);}
      map.jumpTo(flight.cameraAt(seconds,framing,{sharpImagery}));
      map.redraw();
      signal.throwIfAborted();
      await waitForTiles(map,signal);
      signal.throwIfAborted();
      const shot=replayShot(model,seconds,false);
      paintLightning(map,shot.effect,274);
      paintStory(map,lightning,shot);
      await source.add(seconds,1/fps);
      // Yield periodically so the progress and Close controls stay responsive.
      if(index%4===0)await new Promise(resolve=>setTimeout(resolve,0));
    }
    onProgress(100);
    source.close();
    await output.finalize();
    signal.throwIfAborted();
    return new Blob([target.buffer],{type:'video/mp4'});
  }finally{
    map?.remove();
    stage.remove();
    if(output?.state==='started')await output.cancel();
  }
}
