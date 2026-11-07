// Shape-preserving cubic Hermite interpolation. Each segment stays within its
// measured endpoints; absent values and gaps over seven days start a new path.
export function curvePath(points,field,x,y){
  const groups=[];let group=[];
  for(const p of points){
    if(!Number.isFinite(p[field])){if(group.length)groups.push(group);group=[];continue;}
    if(group.length&&Date.parse(p.date)-Date.parse(group.at(-1).date)>7*86400000){groups.push(group);group=[];}
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
  const points=data.points;
  if(!points.length)return {markup:'<div class="jr-empty"><h2>Your first reading starts the line.</h2><p>Log a weigh-in or import your MASS history.</p></div>',geometry:null};
  const w=width,left=60,right=w-24,top=30,bottom=270;
  const values=points.flatMap(p=>[p.kg,p.mean7]).filter(Number.isFinite),low=Math.min(...values),high=Math.max(...values),pad=Math.max(.6,(high-low)*.18);
  const min=Math.floor((low-pad)*2)/2,max=Math.ceil((high+pad)*2)/2;
  const first=Date.parse(points[0].date),last=Date.parse(points.at(-1).date),span=last-first;
  const x=p=>span?left+(Date.parse(p.date)-first)/span*(right-left):(left+right)/2,y=v=>bottom-(v-min)/(max-min)*(bottom-top);
  const selected=points[selection],axis=d=>new Date(d).toLocaleDateString('en-AU',{day:'numeric',month:'short',timeZone:'UTC'});
  const ticks=span?Array.from({length:width<600?3:4},(_,i)=>first+span*i/(width<600?2:3)):[first];
  return {geometry:{x,y,width:w},markup:`<div class="jr-chart-top"><div><span class="jr-value-label">Recorded daily value</span><div class="jr-selected-value"><strong id="selected-kg">${kg(selected.kg)}</strong><span>kg</span></div><p id="selected-date">${day(selected.date)} · ${selected.readings} reading${selected.readings===1?'':'s'}</p></div><div class="jr-chart-legend"><span><i></i>Daily value</span><span><i></i>7-day mean</span></div></div>
  <div class="jr-chart-frame" id="weight-chart" role="group" tabindex="0" aria-label="Weight history. Use left and right arrow keys to inspect readings." aria-describedby="chart-help chart-announcement"><svg viewBox="0 0 ${w} 320" aria-hidden="true" style="--jr-axis:${width<600?18:20}px"><defs><linearGradient id="weight-line" x1="0" x2="1"><stop stop-color="var(--color-highlight)"/><stop offset="1" stop-color="var(--color-accent)"/></linearGradient></defs>${[min,(min+max)/2,max].map(v=>`<path class="jr-grid" d="M${left} ${y(v)}H${right}"/><text x="2" y="${y(v)+5}">${kg(v)}</text>`).join('')}<path class="jr-weight-line" d="${curvePath(points,'kg',x,y)}"/><path class="jr-mean-line" d="${curvePath(points,'mean7',x,y)}"/>${points.map(p=>`<circle class="jr-reading-dot" cx="${x(p)}" cy="${y(p.kg)}" r="3.2"/>`).join('')}<g id="chart-cursor"><path class="jr-cursor-line" d="M${x(selected)} ${top}V${bottom}"/><circle cx="${x(selected)}" cy="${y(selected.kg)}" r="6"/></g>${ticks.map((d,i)=>`<text x="${span?left+i/(ticks.length-1)*(right-left):(left+right)/2}" y="310" text-anchor="${!span?'middle':i===0?'start':i===ticks.length-1?'end':'middle'}">${axis(d)}</text>`).join('')}</svg></div>
  <div class="jr-inspect-bar"><p id="chart-help">Tap the chart to inspect a day.</p><div class="jr-stepper"><button type="button" id="previous-reading" aria-label="Previous reading" ${selection===0?'disabled':''}>‹</button><span id="reading-position">${selection+1} / ${points.length}</span><button type="button" id="next-reading" aria-label="Next reading" ${selection===points.length-1?'disabled':''}>›</button></div></div><p class="jr-chart-note" id="mean-readout">${selected.mean7===null?'7-day mean needs 3 recorded days.':'7-day mean · '+kg(selected.mean7)+' kg'}</p><span id="chart-announcement" class="sr-only" role="status"></span>`};
}
