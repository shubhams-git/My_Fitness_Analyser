import { geographicRoute,routeFeatures,cursorFeature,routeMarkers,nearestRoutePoint } from './route-geometry.js';
import { mapStyle } from './map-style.js';

let libraryPromise,stylePromise;
const library=()=>libraryPromise??=import('./assets/vendor/maplibre-gl.mjs').then(m=>{m.setWorkerUrl('/assets/vendor/maplibre-gl-worker.mjs?v=6.16.0');m.setWorkerCount(2);return m;}).catch(e=>{libraryPromise=null;throw e;});
const basemap=()=>stylePromise??=fetch('https://tiles.openfreemap.org/styles/liberty',{credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(15000)}).then(r=>{if(!r.ok)throw new Error('Map style unavailable');return r.json();}).catch(e=>{stylePromise=null;throw e;});

export function mountRouteMaps({records,block=null,cursor=null,onSelect,reduced=false}) {
  const route=geographicRoute(records),instances=new Map(),abort=new AbortController();let destroyed=false,appearance='streets';
  try{if(localStorage.getItem('mfa-map-appearance')==='night')appearance='night';}catch{}
  const visible=el=>el.isConnected&&(!el.closest('dialog')||el.closest('dialog').open);
  const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){observer.unobserve(entry.target);void create(entry.target);}},{rootMargin:'200px'});
  const showError=item=>{if(item.dead)return;item.el.dataset.mapState='error';item.el.querySelector('.geo-status').hidden=true;item.el.querySelector('.geo-recovery').hidden=false;};
  const buttonState=el=>el.querySelectorAll('[data-map-style]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mapStyle===appearance)));
  function fit(item,animate=true){if(!item.map)return;item.map.fitBounds(route.bounds,{padding:item.el.clientWidth<400?52:64,maxZoom:17.3,bearing:0,pitch:0,duration:animate&&!reduced?500:0});}
  function update(item){
    if(!item.ready||!item.map?.getSource('athlete-route'))return;
    if(item.block!==block){item.map.getSource('athlete-selection').setData(block?routeFeatures(route,block):{type:'FeatureCollection',features:[]});item.map.setPaintProperty('athlete-line','line-opacity',block ? .35 : 1);item.block=block;}
    item.map.getSource('athlete-cursor').setData(cursorFeature(route,cursor));
  }
  function addRoute(item,m){
    const map=item.map;
    map.addSource('athlete-route',{type:'geojson',data:routeFeatures(route),tolerance:0});
    map.addSource('athlete-selection',{type:'geojson',data:{type:'FeatureCollection',features:[]},tolerance:0});
    map.addSource('athlete-cursor',{type:'geojson',data:cursorFeature(route,cursor)});
    // Roads stay legible beneath the route; place labels remain above it.
    const before=map.getStyle().layers.find(l=>l.type==='symbol'&&l.layout?.['text-field'])?.id;
    const line=(id,source,color,width,opacity=1)=>map.addLayer({id,type:'line',source,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':color,'line-width':width,'line-opacity':opacity}},before);
    const ink=appearance==='night'?'#ff9865':'#d94a16';
    line('athlete-casing','athlete-route',appearance==='night'?'#0a121c':'#ffffff',8,.95);
    line('athlete-line','athlete-route',ink,4.5);
    line('athlete-selected-line','athlete-selection',ink,6);
    map.addLayer({id:'athlete-cursor-dot',type:'circle',source:'athlete-cursor',paint:{'circle-radius':7,'circle-color':'#111c29','circle-stroke-color':'#ffffff','circle-stroke-width':3}});
    if(!item.markers.length){
      for(const point of routeMarkers(route)){
        const el=document.createElement('button');el.type='button';el.className='geo-marker geo-'+point.kind;el.textContent=point.label;el.setAttribute('aria-label',point.name+'; inspect recorded moment');
        el.addEventListener('click',e=>{e.stopPropagation();onSelect(point.index);},{signal:abort.signal});
        item.markers.push(new m.Marker({element:el,anchor:point.kind==='kilometre'?'center':'bottom',offset:point.kind==='start'?[-11,0]:point.kind==='finish'?[11,0]:[0,0]}).setLngLat(point.coordinate).addTo(map));
      }
    }
    item.block=undefined;item.ready=true;update(item);
  }
  async function create(el){
    if(destroyed||!visible(el)||instances.has(el)||!route.bounds)return;
    const item={el,map:null,markers:[],dead:false,ready:false,geography:false,failed:false,timer:null,resize:null};instances.set(el,item);buttonState(el);
    el.dataset.mapState='loading';el.querySelector('.geo-status').hidden=false;el.querySelector('.geo-recovery').hidden=true;
    item.timer=setTimeout(()=>showError(item),22000);
    try{
      const [m,base]=await Promise.all([library(),basemap()]);if(destroyed||item.dead||!visible(el))return;
      const expanded=el.dataset.realMap==='expanded';
      item.map=new m.Map({container:el.querySelector('.geo-canvas'),style:mapStyle(base,appearance),center:route.points[0].coordinate,zoom:13,maxZoom:20,maxPitch:0,dragRotate:false,touchPitch:false,cooperativeGestures:!expanded,attributionControl:false,renderWorldCopies:false,canvasContextAttributes:{preserveDrawingBuffer:false},transformRequest:url=>({url,credentials:'omit',referrerPolicy:'no-referrer'})});
      const map=item.map;map.touchZoomRotate.disableRotation();
      map.addControl(new m.NavigationControl({showCompass:true,visualizePitch:false}),'top-right');
      map.addControl(new m.ScaleControl({maxWidth:100,unit:'metric'}),'bottom-left');
      map.addControl(new m.AttributionControl({compact:true}),'bottom-right');
      map.getCanvas().setAttribute('aria-label','Street map. Arrow keys pan; plus and minus zoom. Select the route or use the session time slider to inspect recorded data.');
      fit(item,false);
      map.on('style.load',()=>{if(!item.dead)addRoute(item,m);});
      const ready=()=>{if(!item.dead&&item.geography&&!item.failed&&map.isStyleLoaded()&&map.areTilesLoaded()){clearTimeout(item.timer);el.dataset.mapState='ready';el.querySelector('.geo-status').hidden=true;el.querySelector('.geo-recovery').hidden=true;}};
      map.on('sourcedata',e=>{if(e.sourceId==='openmaptiles'&&e.tile?.state==='loaded')item.geography=true;});
      map.on('idle',ready);
      map.on('error',()=>{item.failed=true;if(!item.ready)showError(item);else{el.dataset.mapState='degraded';el.querySelector('.geo-status').hidden=true;el.querySelector('.geo-recovery').hidden=false;}});
      map.on('webglcontextlost',()=>showError(item));
      map.on('click',e=>{const index=nearestRoutePoint(route,c=>map.project(c),e.point);if(index!==null)onSelect(index);});
      item.resize=new ResizeObserver(()=>{if(!item.dead)map.resize();});item.resize.observe(el);
      item.base=base;item.library=m;
    }catch{showError(item);}
  }
  function remove(item){item.dead=true;clearTimeout(item.timer);item.resize?.disconnect();item.markers.forEach(m=>m.remove());item.map?.remove();instances.delete(item.el);}
  function prune(){for(const item of instances.values())if(!visible(item.el))remove(item);}
  function scan(){prune();for(const el of document.querySelectorAll('[data-real-map]'))if(visible(el)&&!instances.has(el)){if(el.dataset.realMap==='expanded')void create(el);else observer.observe(el);}}
  function active(target){return instances.get(target?.closest('[data-real-map]'))||instances.get(target?.closest('.route-panel,.route-explorer')?.querySelector('[data-real-map]'))||[...instances.values()].find(i=>i.el.dataset.realMap==='expanded')||instances.values().next().value;}
  document.addEventListener('click',event=>{
    const style=event.target.closest('[data-map-style]'),retry=event.target.closest('[data-map-retry]');
    if(retry){const el=retry.closest('[data-real-map]'),item=instances.get(el);if(item)remove(item);void create(el);}
    if(style){const next=style.dataset.mapStyle;if(next===appearance)return;appearance=next;try{localStorage.setItem('mfa-map-appearance',next);}catch{}
      for(const item of instances.values()){buttonState(item.el);if(item.map){item.ready=false;item.failed=false;item.geography=false;item.map.setStyle(mapStyle(item.base,appearance),{diff:false});}}
    }
  },{signal:abort.signal});
  scan();
  return {scan,prune,update(nextBlock,nextCursor){block=nextBlock;cursor=nextCursor;for(const item of instances.values())update(item);},command(action,target){const item=active(target);if(!item?.map)return;if(action==='fit-route')fit(item);else if(action==='zoom-in')item.map.zoomIn({duration:reduced?0:200});else if(action==='zoom-out')item.map.zoomOut({duration:reduced?0:200});},destroy(){destroyed=true;abort.abort();observer.disconnect();for(const item of instances.values())remove(item);}};
}
