import { loadMapLibrary } from './route-maps.js';
import { replayMetrics } from './replay-model.js';
import { replayLightning } from './replay-lightning.js';
import { addReplayRoute,createReplayMap,frameReplayMap,replayShot } from './satellite-replay.js';

const width=540,height=960,fps=30,bitrate=5_000_000;
const imageCredit=[
  'EOxCloudless · cloudless.eox.at · EOX IT Services GmbH',
  'Contains modified Copernicus Sentinel data 2024',
  'CC BY-NC-SA 4.0 · creativecommons.org/licenses/by-nc-sa/4.0'
];

function storyPainter(canvas,activity){
  const ctx=canvas.getContext('2d',{alpha:false});
  if(!ctx)throw new Error('This browser could not prepare the Story canvas.');
  ctx.scale(2,2);
  const shade=ctx.createLinearGradient(0,0,0,height);
  for(const [position,color] of [[0,'#080e16'],[.19,'#080e16d9'],[.31,'#080e1600'],
    [.64,'#080e1600'],[.8,'#080e16e8'],[1,'#080e16']])shade.addColorStop(position,color);
  const display='Barlow Condensed, system-ui, sans-serif';
  function text(value,x,y,font,color,maxWidth=width-72){
    ctx.fillStyle=color;
    ctx.font=font;
    ctx.fillText(value,x,y,maxWidth);
  }
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
    imageCredit.forEach((line,index)=>text(line,36,788+index*14,'500 11px Manrope, sans-serif','#e8e5e0'));
  };
}

function waitForMap(map,model,signal){
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
      loaded=true;
    }
    function sourceData(event){
      if(event.sourceId==='satellite'&&event.tile?.state==='loaded')imagery=true;
    }
    function idle(){
      if(loaded&&imagery&&map.isSourceLoaded('satellite'))finish();
    }
    signal.addEventListener('abort',abort,{once:true});
    map.on('load',load);
    map.on('sourcedata',sourceData);
    map.on('idle',idle);
  });
}

function waitForTiles(map,signal){
  if(map.isSourceLoaded('satellite'))return;
  return new Promise(resolve=>{
    const timeout=setTimeout(finish,2500);
    function finish(){
      clearTimeout(timeout);
      signal.removeEventListener('abort',finish);
      map.off('idle',finish);
      resolve();
    }
    signal.addEventListener('abort',finish,{once:true});
    map.on('idle',finish);
  });
}

export async function recordReplayStory({activity,model,flight,container,signal:parentSignal,onProgress}){
  const graphics=new AbortController();
  const signal=AbortSignal.any([parentSignal,graphics.signal]);
  const canvas=document.createElement('canvas');
  canvas.width=width*2;
  canvas.height=height*2;
  const [{Map},{Output,Mp4OutputFormat,BufferTarget,CanvasSource,canEncodeVideo}]=await Promise.all([
    loadMapLibrary(),import('/assets/vendor/mediabunny.min.mjs')
  ]);
  if(!await canEncodeVideo('avc',{width:canvas.width,height:canvas.height,bitrate})){
    throw new Error('MP4 export needs H.264 encoding support. Try this in current Safari or Chrome.');
  }
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
    // EOxCloudless expressly permits attributed non-commercial video exports.
    map=createReplayMap(Map,host,model,null,{pixelRatio:1,canvasContextAttributes:{preserveDrawingBuffer:true}});
    map.on('webglcontextlost',()=>graphics.abort(new Error('The map lost its graphics connection. Try downloading again.')));
    const framing=frameReplayMap(map,model,flight,226,210);
    map.jumpTo(flight.cameraAt(0,framing,{sharpImagery:false}));
    await waitForMap(map,model,signal);
    signal.throwIfAborted();
    const paintLightning=replayLightning(lightning,model.route),paintStory=storyPainter(canvas,activity);
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
      map.jumpTo(flight.cameraAt(seconds,framing,{sharpImagery:false}));
      map.redraw();
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
    return new Blob([target.buffer],{type:'video/mp4'});
  }finally{
    map?.remove();
    stage.remove();
    if(output?.state==='started')await output.cancel();
  }
}
