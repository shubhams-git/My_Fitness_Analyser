// Original, deterministic analytics. No Strava scores or inferred sensor samples.
export const PROGRESS_VERSION = 'recorded-progress-v4';
export const BENCHMARKS = [400, 804.672, 1000, 1609.344, 2000, 3218.688, 5000, 10000, 21097.5, 42195];
const finite = Number.isFinite;
const dayMs = 86400000;
export const monthKey = date => date.slice(0, 7);
export function niceAxis(value){const target=Math.max(1,value)/3,power=10**Math.floor(Math.log10(target)),scaled=target/power,step=([1,2,5,10].find(v=>v>=scaled)||10)*power,max=Math.max(step,Math.ceil(value/step)*step);return {max,ticks:Array.from({length:Math.round(max/step)+1},(_,i)=>i*step)};}

// Fastest elapsed-time window in a piecewise-linear distance/time stream. The
// optimum starts or ends at a source sample. Test both, never just lap boundaries.
// A reset, missing distance or >15 s recording gap splits the usable stream.
export function bestEfforts(activity) {
  if (!['Run', 'Track run', 'Track Run'].includes(activity.sport) || activity.distance < 400) return [];
  const source=activity.records||[],firstFix=source.findIndex(r=>finite(r.lat)&&finite(r.lon));
  // A watch can record distance/time just before its first GPS fix. Keep that
  // brief measured prefix (<=15 s and <=50 m), without inventing a location.
  // Missing positions later in the run still split eligible windows.
  const initialFix=firstFix>0&&finite(source[0].t)&&finite(source[0].distance)&&finite(source[firstFix].distance)&&source[firstFix].t-source[0].t<=15&&source[firstFix].distance-source[0].distance<=50;
  const chunks = []; let chunk = [];
  for (let index=0;index<source.length;index++) {const r=source[index];
    if (!finite(r.t) || !finite(r.distance) || (!(finite(r.lat)&&finite(r.lon))&&!(initialFix&&index<firstFix))) { if (chunk.length > 1) chunks.push(chunk); chunk = []; continue; }
    const last = chunk.at(-1);
    if (last && (r.t <= last.t || r.t - last.t > 15 || r.distance < last.distance || (r.distance-last.distance)/(r.t-last.t) > 12)) {
      if (chunk.length > 1) chunks.push(chunk); chunk = [];
    }
    chunk.push(r);
  }
  if (chunk.length > 1) chunks.push(chunk);
  return BENCHMARKS.flatMap(distanceM => {
    let best = null;
    for (const rows of chunks) {
      if (rows.at(-1).distance - rows[0].distance < distanceM) continue;
      const timeAt = (distance, edge) => {
        let lo=0, hi=rows.length;
        // Earliest arrival for an end, latest departure for a start. This keeps
        // stationary elapsed seconds inside the effort unless they precede it.
        while(lo<hi){const mid=(lo+hi)>>1;if(rows[mid].distance<distance || edge==='start'&&rows[mid].distance===distance)lo=mid+1;else hi=mid;}
        if(edge==='start'&&lo>0&&rows[lo-1].distance===distance)return rows[lo-1].t;
        if(lo===0)return rows[0].t;
        if(lo===rows.length)return rows.at(-1).t;
        const a=rows[lo-1],b=rows[lo];
        return a.t+(distance-a.distance)/(b.distance-a.distance)*(b.t-a.t);
      };
      for (const r of rows) for (const startM of [r.distance, r.distance-distanceM]) {
        if (startM < rows[0].distance || startM+distanceM > rows.at(-1).distance) continue;
        const startS=timeAt(startM,'start'), endS=timeAt(startM+distanceM,'end'), elapsedS=endS-startS;
        if (elapsedS>0 && (!best || elapsedS<best.elapsedS)) best={distanceM,elapsedS,startS,endS,paceSPerKm:elapsedS/distanceM*1000};
      }
    }
    return best ? [{...best, approximate:true, basis:'elapsed-samples'}] : [];
  });
}

export function progressModel(sessions, anchor, sport='run') {
  const selected=sessions.filter(s=>sport==='all'||(sport==='run'?s.run:!s.run));
  const months=new Map();
  for(const s of selected){const key=monthKey(s.date);if(!months.has(key))months.set(key,[]);months.get(key).push(s);}
  const current=monthKey(anchor);if(!months.has(current))months.set(current,[]);
  const monthly=[...months].sort(([a],[b])=>a.localeCompare(b)).map(([key,rows])=>{
    const [year,month]=key.split('-').map(Number),days=new Date(Date.UTC(year,month,0)).getUTCDate(),through=key===current?Number(anchor.slice(8)):days;
    let distanceM=0,durationS=0;
    const daily=Array.from({length:days},(_,i)=>{const date=key+'-'+String(i+1).padStart(2,'0'),items=rows.filter(s=>s.date===date);distanceM+=items.reduce((n,s)=>n+(s.distanceM??0),0);durationS+=items.reduce((n,s)=>n+(s.durationS??0),0);return {date,day:i+1,distanceM,durationS,sessionIds:items.map(s=>s.id),sessions:items};});
    return {key,days,through,daily,totalM:distanceM,totalS:durationS,count:rows.length,activeDays:daily.filter(d=>d.sessionIds.length).length};
  });
  const efforts=BENCHMARKS.map(distanceM=>({distanceM,results:selected.filter(s=>s.run).flatMap(s=>(s.bestEfforts||[]).filter(e=>e.distanceM===distanceM).map(e=>({...e,id:s.id,date:s.date,title:s.title}))).sort((a,b)=>a.elapsedS-b.elapsedS||a.date.localeCompare(b.date))}));
  const activeDays=new Set(selected.map(s=>s.date)).size;
  const dates=selected.map(s=>s.date).sort();
  const span=dates.length?Math.floor((Date.parse(anchor+'T12:00Z')-Date.parse(dates[0]+'T12:00Z'))/dayMs)+1:0;
  const start=new Date(anchor+'T12:00Z');start.setUTCDate(start.getUTCDate()-(start.getUTCDay()+6)%7);
  const effortWeeks=Array.from({length:4},(_,i)=>{const from=new Date(start.getTime()-(3-i)*7*dayMs).toISOString().slice(0,10),until=new Date(start.getTime()-(2-i)*7*dayMs).toISOString().slice(0,10),runs=selected.filter(s=>s.run&&s.date>=from&&s.date<until),rated=runs.filter(s=>finite(s.effortRating)&&s.effortRating>=1&&s.effortRating<=10&&finite(s.durationS)&&s.durationS>0);return {start:from,total:runs.length,rated:rated.length,load:rated.reduce((sum,s)=>sum+s.durationS/60*s.effortRating,0)};});
  return {version:PROGRESS_VERSION,monthly,efforts,effortWeeks,activeDays,span,sessions:selected};
}
