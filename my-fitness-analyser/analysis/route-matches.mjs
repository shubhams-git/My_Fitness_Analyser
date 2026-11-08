export const ROUTE_MATCH_VERSION='personal-route-match-v1';
const radians=v=>v*Math.PI/180;
const metres=(a,b)=>{const dLat=radians(b.lat-a.lat),dLon=radians(b.lon-a.lon);const h=Math.sin(dLat/2)**2+Math.cos(radians(a.lat))*Math.cos(radians(b.lat))*Math.sin(dLon/2)**2;return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));};
function signature(a){
 if(!['Run','Track run','Track Run'].includes(a.sport)||!(a.distance>=1000)||!(a.timer>=300)||a.records.length<20)return null;
 const valid=a.records.filter(r=>Number.isFinite(r.lat)&&Number.isFinite(r.lon)&&Math.abs(r.lat)<=85&&Math.abs(r.lon)<=180);
 if(valid.length<a.records.length*.95)return null;
 const cumulative=[0];for(let i=1;i<valid.length;i++){if(!(valid[i].t>valid[i-1].t)||valid[i].t-valid[i-1].t>30)return null;const d=metres(valid[i-1],valid[i]);if(d/(valid[i].t-valid[i-1].t)>12)return null;cumulative.push(cumulative.at(-1)+d);}
 const length=cumulative.at(-1);if(Math.abs(length/a.distance-1)>.25)return null;
 let i=1;const samples=Array.from({length:25},(_,j)=>{const target=length*j/24;while(i<valid.length-1&&cumulative[i]<target)i++;const span=cumulative[i]-cumulative[i-1],f=span?(target-cumulative[i-1])/span:0;return {lat:valid[i-1].lat+(valid[i].lat-valid[i-1].lat)*f,lon:valid[i-1].lon+(valid[i].lon-valid[i-1].lon)*f};});
 return {id:a.id,distance:a.distance,basis:'timer',samples};
}
function match(a,b){if(Math.abs(a.distance/b.distance-1)>.1||metres(a.samples[0],b.samples[0])>40||metres(a.samples.at(-1),b.samples.at(-1))>40)return false;const gaps=a.samples.map((p,i)=>metres(p,b.samples[i])).toSorted((a,b)=>a-b);return gaps[12]<=20&&gaps.at(-1)<=75;}
export function matchedRoutes(activities){
 const groups=[];for(const a of [...activities].sort((a,b)=>(a.date||'').localeCompare(b.date||'')||a.id.localeCompare(b.id))){const s=signature(a);if(!s)continue;const existing=groups.find(g=>match(g.signature,s));if(existing)existing.ids.push(a.id);else groups.push({signature:s,ids:[a.id]});}
 return groups.filter(g=>g.ids.length>=2).map(g=>({version:ROUTE_MATCH_VERSION,representativeId:g.ids[0],sessionIds:g.ids,basis:'timer'}));
}
