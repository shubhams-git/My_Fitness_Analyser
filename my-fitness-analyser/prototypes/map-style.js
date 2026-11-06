// OpenFreeMap's Liberty style supplies genuine OpenStreetMap geography. Keep
// source attribution, symbols, local names, zoom-dependent detail and geometry.
// The two treatments change cartography, never the athlete's GPS coordinates.
export function mapStyle(base,appearance) {
  const style=structuredClone(base);style.name='Field Notes / '+appearance;
  for(const layer of style.layers){
    const id=layer.id,p=layer.paint??={};
    // Some OSM categories have no sprite in the provider's current atlas. Keep
    // their real names/positions with a generic point instead of a missing icon.
    if(id.startsWith('poi')&&layer.layout?.['icon-image'])layer.layout['icon-image']=['coalesce',['image',layer.layout['icon-image']],['image','circle_11']];
    // Street names should already be useful when the whole short run is fitted.
    if(id==='highway-name-minor')layer.minzoom=Math.min(layer.minzoom??15,14);
    if(id==='building-3d'){layer.layout={...layer.layout,visibility:'none'};continue;}
    if(appearance!=='night'){
      if(id==='background')p['background-color']='#f2f1ec';
      if(id==='park')Object.assign(p,{'fill-color':'#cce2b7','fill-outline-color':'#9abf89','fill-opacity':.85});
      if(id==='building')p['fill-color']='#d8d8d0';
      if(id==='water')p['fill-color']='#aad1dc';
      continue;
    }
    if(layer.type==='background')p['background-color']='#111c29';
    if(layer.type==='raster')p['raster-opacity']=0;
    if(layer.type==='fill'){
      p['fill-color']=/water/.test(id)?'#173c50':/park|wood|grass|pitch|cemetery/.test(id)?'#24443b':/building/.test(id)?'#2c3a46':/sand/.test(id)?'#3d3c34':'#182530';
      if(p['fill-outline-color'])p['fill-outline-color']='#355448';
      if(p['fill-pattern'])delete p['fill-pattern'];
    }
    if(layer.type==='line'){
      p['line-color']=/water/.test(id)?'#2c6575':/boundary/.test(id)?'#536274':/park/.test(id)?'#436b54':/rail/.test(id)?'#697482':/casing/.test(id)?'#17212b':/motorway|trunk_primary/.test(id)?'#7e847f':/secondary_tertiary/.test(id)?'#637079':/path|pedestrian/.test(id)?'#537966':'#445560';
    }
    if(layer.type==='symbol'&&layer.layout?.['text-field']){
      p['text-color']=/water/.test(id)?'#95c6d6':/poi/.test(id)?'#b8cdb3':'#d4dce3';
      p['text-halo-color']='#111c29';p['text-halo-width']=1.4;
    }
  }
  return style;
}
