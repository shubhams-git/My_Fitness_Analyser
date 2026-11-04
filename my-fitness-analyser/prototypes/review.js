const activity=document.querySelector('#activity'),scenario=document.querySelector('#scenario'),width=document.querySelector('#width'),grid=document.querySelector('#grid'),accessibility=document.querySelector('#accessibility');
let view='both';
const payload=await fetch('/api/data').then(r=>r.json());
activity.replaceChildren(...payload.activities.map(a=>{const option=document.createElement('option');option.value=a.id;option.textContent=`${a.synthetic?'Demo':a.source.replace(' Connect','')} · ${a.title}`;return option;}));activity.value=payload.defaultId;
function update(){
  const wide=Number(width.value)>440||width.value==='desktop';
  const current=view==='both'&&wide?'trackside':view;
  grid.classList.toggle('single',current!=='both');grid.classList.toggle('desktop',width.value==='desktop');grid.style.setProperty('--preview-width',width.value+'px');
  for(const [suffix,direction]of [['a','trackside'],['b','field-notes']]){const section=document.querySelector(`[data-direction="${direction}"]`);section.hidden=current!=='both'&&current!==direction;const params=new URLSearchParams({direction,activity:activity.value,scenario:scenario.value});if(['large','both'].includes(accessibility.value))params.set('text','large');if(accessibility.value.startsWith('largest'))params.set('text','largest');if(['reduced','both','largest-reduced'].includes(accessibility.value))params.set('motion','reduce');const url='/app.html?'+params;document.querySelector('#frame-'+suffix).src=url;document.querySelector('#open-'+suffix).href=url;section.querySelector('.device').style.width=width.value==='desktop'?'100%':width.value+'px';}
  document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===current)));
}
for(const control of [activity,scenario,width,accessibility])control.addEventListener('change',update);
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{view=button.dataset.view;update();}));update();
