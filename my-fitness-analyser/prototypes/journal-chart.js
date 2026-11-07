import { weightTrend } from './weight-trend.js';
// Shape-preserving cubic Hermite interpolation. Each segment stays within its
// measured endpoints; absent values and gaps over seven days start a new path.
export function curvePath(points,field,x,y,{gapDays=7}={}){
  const groups=[];let group=[];
  for(const p of points){
    if(!Number.isFinite(p[field])){if(group.length)groups.push(group);group=[];continue;}
    if(group.length&&Date.parse(p.date)-Date.parse(group.at(-1).date)>gapDays*86400000){groups.push(group);group=[];}
    group.push(p);
  }
  if(group.length)groups.push(group);
  const n=v=>Number(v.toFixed(3));
  return groups.map(g=>{
    const v=g.map(p=>[x(p),y(p[field])]),d=v.slice(1).map((p,i)=>(p[1]-v[i][1])/(p[0]-v[i][0]));
    const tangent=v.map((_,i)=>i===0?(d[0]||0):i===v.length-1?(d.at(-1)||0):d[i-1]*d[i]<=0?0:Math.sign(d[i])*Math.min(Math.abs(d[i-1]),Math.abs(d[i])));
    return `M${n(v[0][0])},${n(v[0][1])}`+v.slice(1).map((p,j)=>{const a=v[j],h=(p[0]-a[0])/3;return `C${n(a[0]+h)},${n(a[1]+h*tangent[j])} ${n(p[0]-h)},${n(p[1]-h*tangent[j+1])} ${n(p[0])},${n(p[1])}`;}).join('');
  }).join(' ');
}

export function chartMarkup({data,selection,kg,day,width=900}){
 const trend=data.trend||weightTrend(data.points,{anchor:data.anchor}),points=trend.points;
 if(!points.length)return {markup:'<div class="jr-empty"><h2>Your first reading starts the trend.</h2><p>Log a weigh-in or import your MASS history.</p></div>',geometry:null};
 const w=width,left=58,right=w-22,top=24,bottom=280;
 const readings=(data.entries||trend.observed.map(p=>({dateKey:p.date,kg:p.kg}))).map(r=>({...r,date:r.dateKey}));
 const values=[...points.map(p=>p.trendKg),...readings.map(p=>p.kg)],low=Math.min(...values)-.35,high=Math.max(...values)+.35;
 const step=high-low>5?2:high-low>2?1:.5,min=Math.floor(low/step)*step,max=Math.ceil(high/step)*step;
 const first=Date.parse(points[0].date),last=Date.parse(points.at(-1).date),span=last-first;
 const x=p=>span?left+(Date.parse(p.date)-first)/span*(right-left):(left+right)/2,y=v=>bottom-(v-min)/(max-min)*(bottom-top);
 const selected=points[Math.max(0,Math.min(selection,points.length-1))],axis=d=>new Date(d).toLocaleDateString('en-AU',{day:'numeric',month:'short',timeZone:'UTC'});
 const ticks=span?Array.from({length:3},(_,i)=>first+span*i/2):[first],line=curvePath(points,'trendKg',x,y,{gapDays:Infinity});
 const recorded=points.filter(p=>!p.held),held=points.some(p=>p.held)?[...(recorded.length?[recorded.at(-1)]:[]),...points.filter(p=>p.held)]:[];
 const labels=Array.from({length:Math.round((max-min)/step)+1},(_,i)=>min+i*step);
 const daily=new Map(points.map(p=>[p.date,p]));
 return {geometry:{x,y,width:w,points},markup:`<div class="jr-chart-top"><div><span class="jr-value-label">Trend weight</span><div class="jr-selected-value"><strong id="selected-kg">${kg(Math.round(selected.trendKg*10)/10)}</strong><span>kg</span></div><p id="selected-date">${day(selected.date)} · ${selected.held?'Held since '+day(selected.heldSince):selected.estimated?'Estimated between weigh-ins':'Smoothed trend'}</p><p class="jr-scale-reading" id="scale-readout">${selected.held&&data.latestReading?'Last scale '+kg(data.latestReading.kg)+' kg · '+day(data.latestReading.dateKey):selected.kg===null?'No weigh-in recorded on this date.':'Scale reading '+kg(selected.kg)+' kg'}</p></div></div>
 <div class="jr-chart-frame" id="weight-chart" role="group" tabindex="0" aria-label="Weight trend. Use left and right arrow keys to inspect days." aria-describedby="chart-help chart-announcement"><svg viewBox="0 0 ${w} 330" aria-hidden="true" style="--jr-axis:${width<600?18:21}px"><defs><linearGradient id="weight-area" x1="0" y1="0" x2="0" y2="1"><stop stop-color="var(--color-text)" stop-opacity=".12"/><stop offset="1" stop-color="var(--color-text)" stop-opacity="0"/></linearGradient></defs>${labels.map(v=>`<path class="jr-grid" d="M${left} ${y(v)}H${right}"/><text x="2" y="${y(v)+5}">${kg(v)}</text>`).join('')}<path class="jr-trend-area" d="${line}L${x(points.at(-1))},${bottom}H${x(points[0])}Z"/>${readings.filter(r=>daily.has(r.date)).map(p=>`<path class="jr-reading-stem" d="M${x(p)} ${y(p.kg)}V${y(daily.get(p.date).trendKg)}"/><circle class="jr-reading-dot" cx="${x(p)}" cy="${y(p.kg)}" r="3.5"/>`).join('')}<path class="jr-weight-line" d="${curvePath(recorded,'trendKg',x,y,{gapDays:Infinity})}"/><path class="jr-held-line" d="${curvePath(held,'trendKg',x,y,{gapDays:Infinity})}"/><g id="chart-cursor"><path class="jr-cursor-line" d="M${x(selected)} ${top}V${bottom}"/><circle cx="${x(selected)}" cy="${y(selected.trendKg)}" r="6"/></g>${ticks.map((d,i)=>`<text x="${span?left+i/(ticks.length-1)*(right-left):(left+right)/2}" y="320" text-anchor="${!span?'middle':i===0?'start':i===ticks.length-1?'end':'middle'}">${axis(d)}</text>`).join('')}</svg></div>
 <div class="jr-inspect-bar"><div class="jr-chart-legend"><span><i></i>Trend</span><span><i></i>Each reading</span></div><div class="jr-stepper"><button type="button" id="previous-reading" aria-label="Previous day" ${selection===0?'disabled':''}>‹</button><button type="button" id="next-reading" aria-label="Next day" ${selection>=points.length-1?'disabled':''}>›</button></div></div><p id="chart-help" class="jr-chart-note">Tap to inspect. Dots are weigh-ins. The trend connects gaps; dashed means held since the last reading.</p><span id="chart-announcement" class="sr-only" role="status"></span>`};
}
