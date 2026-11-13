const activity=document.querySelector('#activity'),scenario=document.querySelector('#scenario'),width=document.querySelector('#width'),accessibility=document.querySelector('#accessibility');
const loadStatus=document.querySelector('#studio-load');
const retry=loadStatus.querySelector('button');
async function loadActivities(){
 retry.disabled=true;activity.disabled=true;
 try{
  const response=await fetch('/api/data');if(!response.ok)throw new Error();
  const payload=await response.json();if(!payload.activities?.length)throw new Error();
  activity.replaceChildren(...payload.activities.map(a=>{const option=document.createElement('option');option.value=a.id;option.textContent=`${a.synthetic?'Demo':a.source.replace(' Connect','')} · ${a.title}`;return option;}));
  activity.value=payload.defaultId;activity.disabled=false;loadStatus.hidden=true;update();
 }catch{
  activity.options[0].textContent='Unavailable';loadStatus.hidden=false;
  loadStatus.querySelector('[role=status]').textContent='Couldn’t load preview activities. Check your connection and try again.';
 }finally{retry.disabled=false;}
}
function update(){
 const params=new URLSearchParams({activity:activity.value,scenario:scenario.value});
 if(['large','both'].includes(accessibility.value))params.set('text','large');
 if(accessibility.value.startsWith('largest'))params.set('text','largest');
 if(['reduced','both','largest-reduced'].includes(accessibility.value))params.set('motion','reduce');
 const url='/app.html?'+params;document.querySelector('#preview').src=url;document.querySelector('#open-app').href=url;
 const device=document.querySelector('#device');device.style.width=width.value==='desktop'?'100%':(Number(width.value)+18)+'px';device.classList.toggle('desktop',width.value==='desktop');
}
for(const control of [activity,scenario,width,accessibility])control.addEventListener('change',()=>{if(!activity.disabled)update();});
retry.addEventListener('click',loadActivities);
void loadActivities();
