const activity=document.querySelector('#activity'),scenario=document.querySelector('#scenario'),width=document.querySelector('#width'),accessibility=document.querySelector('#accessibility');
const payload=await fetch('/api/data').then(r=>r.json());
activity.replaceChildren(...payload.activities.map(a=>{const option=document.createElement('option');option.value=a.id;option.textContent=`${a.synthetic?'Demo':a.source.replace(' Connect','')} · ${a.title}`;return option;}));activity.value=payload.defaultId;
function update(){
 const params=new URLSearchParams({activity:activity.value,scenario:scenario.value});
 if(['large','both'].includes(accessibility.value))params.set('text','large');
 if(accessibility.value.startsWith('largest'))params.set('text','largest');
 if(['reduced','both','largest-reduced'].includes(accessibility.value))params.set('motion','reduce');
 const url='/app.html?'+params;document.querySelector('#preview').src=url;document.querySelector('#open-app').href=url;
 const device=document.querySelector('#device');device.style.width=width.value==='desktop'?'100%':(Number(width.value)+18)+'px';device.classList.toggle('desktop',width.value==='desktop');
}
for(const control of [activity,scenario,width,accessibility])control.addEventListener('change',update);update();
