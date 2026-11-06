export const validGPS = row => Number.isFinite(row?.lat)&&Number.isFinite(row?.lon)&&Math.abs(row.lat)<=85.051129&&Math.abs(row.lon)<=180;
const empty=()=>({type:'FeatureCollection',features:[]});

// Preserve recorded fixes and split missing fixes / >30-second gaps. Unwrap the
// dateline so a short Pacific route doesn't fit the entire world.
export function geographicRoute(records) {
  const points=[],segments=[];let segment=[],previous=null,longitude=null;
  const finish=()=>{if(segment.length>1)segments.push(segment);segment=[];};
  records.forEach((row,index)=>{
    if(!validGPS(row)){finish();previous=null;return;}
    let lon=row.lon;
    if(longitude!==null){while(lon-longitude>180)lon-=360;while(lon-longitude< -180)lon+=360;}
    const point={index,coordinate:[lon,row.lat],row};points.push(point);longitude=lon;
    if(previous&&(row.t-previous.row.t>30||row.t<previous.row.t))finish();
    segment.push(point);previous=point;
  });finish();
  const bounds=points.length?[[Infinity,Infinity],[-Infinity,-Infinity]]:null;
  for(const {coordinate:[x,y]}of points){bounds[0][0]=Math.min(bounds[0][0],x);bounds[0][1]=Math.min(bounds[0][1],y);bounds[1][0]=Math.max(bounds[1][0],x);bounds[1][1]=Math.max(bounds[1][1],y);}
  return {points,segments,bounds};
}
export function routeFeatures(route,block=null) {
  const features=[];
  for(const segment of route.segments){
    const points=block?segment.filter(p=>p.index>=block.first&&p.index<=block.last):segment;
    if(points.length>1)features.push({type:'Feature',properties:{},geometry:{type:'LineString',coordinates:points.map(p=>p.coordinate)}});
  }
  return {type:'FeatureCollection',features};
}
export function cursorFeature(route,index) {
  const point=route.points.find(p=>p.index===index);if(!point)return empty();
  return {type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:{type:'Point',coordinates:point.coordinate}}]};
}
export function routeMarkers(route) {
  if(!route.points.length)return [];
  const markers=[{...route.points[0],label:'S',kind:'start',name:'Start'},{...route.points.at(-1),label:'F',kind:'finish',name:'Finish'}];
  let next=1000;
  for(const point of route.points){const distance=point.row.distance;if(!Number.isFinite(distance)||distance<next)continue;
    markers.push({...point,label:String(Math.floor(distance/1000)),kind:'kilometre',name:`Recorded ${Math.floor(distance/1000)} km crossing`});next=(Math.floor(distance/1000)+1)*1000;
  }
  return markers;
}
// Inspect only a nearby recorded fix, never an interpolated metric.
export function nearestRoutePoint(route,project,position,tolerance=28) {
  let nearest=null,best=tolerance*tolerance;
  for(const p of route.points){const projected=project(p.coordinate),d=(projected.x-position.x)**2+(projected.y-position.y)**2;if(d<=best){best=d;nearest=p;}}
  return nearest?.index??null;
}
