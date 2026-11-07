export function recordedRange(values,{focus=false}={}){
 const sorted=values.filter(Number.isFinite).toSorted((a,b)=>a-b);if(!sorted.length)return null;
 let min=sorted[0],max=sorted.at(-1),focused=false;
 if(focus&&sorted.length>=20){const low=sorted[Math.floor((sorted.length-1)*.05)],high=sorted[Math.ceil((sorted.length-1)*.95)];if(high>low&&max-min>(high-low)*2){min=low;max=high;focused=true;}}
 if(min===max){min-=1;max+=1;}
 const padding=(max-min)*.12;min-=padding;max+=padding;
 return {min,max,focused,omitted:values.filter(v=>Number.isFinite(v)&&(v<min||v>max)).length};
}

export function recordedDistribution(records,kind){
 const heart=kind==='heart',bounds=heart?[100,120,140,160,180]:[300,360,420,480,600];
 const labels=heart?['Below 100','100–119','120–139','140–159','160–179','180+']:['Below 5:00','5:00–5:59','6:00–6:59','7:00–7:59','8:00–9:59','10:00+'];
 const bins=labels.map(label=>({label,seconds:0}));let knownS=0,unknownS=0;
 for(let i=0;i<records.length-1;i++){
  const a=records[i],b=records[i+1],dt=b.t-a.t;
  if(!Number.isFinite(dt)||dt<=0)continue;
  const value=heart?a.hr:Number.isFinite(a.speed)&&a.speed>=1000/3600?1000/a.speed:null;
  if(dt>15||!Number.isFinite(value)||value<=0){unknownS+=dt;continue;}
  const index=bounds.findIndex(limit=>value<limit);bins[index<0?bins.length-1:index].seconds+=dt;knownS+=dt;
 }
 return {kind,bins,knownS,unknownS};
}
export function distributionMarkup(activity){
 if(activity.records.length<2)return '';
 const time=s=>{const n=Math.round(s);return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');};
 const graphs=['heart',...(activity.distance>=10?['pace']:[])].map(kind=>recordedDistribution(activity.records,kind)).filter(d=>d.knownS>0);
 if(!graphs.length)return '';
 return `<details class="ed-analysis"><summary>Explore time at pace and heart rate</summary><div class="ed-layout">${graphs.map(d=>`<figure class="ed-figure ed-${d.kind}"><figcaption>${d.kind==='heart'?'Heart-rate distribution':'Pace distribution'}<span>${d.kind==='heart'?'bpm':'min/km'} · ${time(d.knownS)} covered</span></figcaption><table><caption class="sr-only">Time in recorded ${d.kind==='heart'?'heart-rate':'pace'} bands</caption><thead class="sr-only"><tr><th scope="col">Band</th><th scope="col">Recorded time</th><th scope="col">Share of covered time</th></tr></thead><tbody>${d.bins.map(b=>`<tr><th scope="row">${b.label}</th><td><i style="width:${b.seconds/d.knownS*100}%" aria-hidden="true"></i><span>${time(b.seconds)}</span></td><td>${Math.round(b.seconds/d.knownS*100)}%</td></tr>`).join('')}</tbody></table><p>${time(d.unknownS)} unclassified ${d.kind==='pace'?'· includes stationary or unavailable pace':''}</p></figure>`).join('')}</div><p class="ed-method">Time-weighted recorded samples, held until the next sample for intervals up to 15 seconds. Longer gaps stay unclassified. Bands describe this recording; they are not personalised training zones or a fitness score.</p></details>`;
}
