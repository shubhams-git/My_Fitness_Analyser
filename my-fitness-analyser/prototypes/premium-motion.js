import { recordIndexAtElapsed } from './interaction-model.js';

export function mountPremiumMotion({records,reduced,onCursor,onPreferenceChange}) {
  const gsap=window.gsap,ScrollTrigger=window.ScrollTrigger;
  const abort=new AbortController();
  let context,media,replay=null,lastPaint=0,clock={time:0},paused=false;
  const hasGPS=records.some(r=>r.lat!==null&&r.lon!==null);
  const button=()=>document.querySelector('.fn-replay');
  const setReplayLabel=playing=>{const b=button();if(!b)return;b.setAttribute('aria-pressed',String(playing));b.querySelector('span').textContent=playing?'Pause replay':paused?'Resume replay':'Replay route';b.classList.toggle('is-playing',playing);};
  function stopReplay(){replay?.kill();replay=null;paused=false;clock.time=0;if(!reduced&&hasGPS)setReplayLabel(false);}
  function toggleReplay(){
    if(reduced||!hasGPS||!gsap||records.length<2)return;
    if(replay?.isActive()){replay.pause();paused=true;setReplayLabel(false);return;}
    if(replay&&paused){paused=false;replay.resume();setReplayLabel(true);return;}
    const end=records.at(-1).t;
    if(end<=0)return;
    if(!paused||clock.time>=end)clock.time=0;
    paused=false;setReplayLabel(true);
    replay=gsap.to(clock,{time:end,duration:12*(end-clock.time)/end,ease:'none',onUpdate(){const now=performance.now();if(now-lastPaint<70&&clock.time<end)return;lastPaint=now;onCursor(recordIndexAtElapsed(records,clock.time));},onComplete(){replay=null;paused=false;setReplayLabel(false);onCursor(records.length-1);}});
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopReplay();},{signal:abort.signal});
  if(gsap&&ScrollTrigger){
    gsap.registerPlugin(ScrollTrigger);
    media=gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)',()=>{
      if(reduced)return;
      const splitHeadings=[];
      const splitWords=selector=>{
        const heading=document.querySelector(selector);if(!heading)return [];
        const text=heading.textContent,words=text.trim().split(/\s+/);if(words.length>28)return [];
        splitHeadings.push({heading,html:heading.innerHTML,label:heading.getAttribute('aria-label')});
        heading.setAttribute('aria-label',text);heading.replaceChildren();
        for(const word of words){const mask=document.createElement('span'),inner=document.createElement('span');mask.className='fn-word';mask.setAttribute('aria-hidden','true');inner.textContent=word;mask.append(inner);heading.append(mask,document.createTextNode(' '));}
        return [...heading.querySelectorAll('.fn-word>span')];
      };
      context=gsap.context(()=>{
        const titleWords=splitWords('.fn-intro h1');
        if(titleWords.length)gsap.from(titleWords,{yPercent:115,rotation:3,duration:1.1,stagger:.07,ease:'power3.out',clearProps:'all'});
        gsap.from('.fn-distance',{y:28,duration:1.2,ease:'power3.out',clearProps:'all'});
        gsap.from('.fn-orbit',{scale:.86,rotation:-12,opacity:0,duration:1.6,ease:'power3.out',clearProps:'all'});
        const route=document.querySelector('.fn-art .route-line');
        if(route){const length=route.getTotalLength();gsap.fromTo(route,{strokeDasharray:length,strokeDashoffset:length},{strokeDashoffset:0,duration:1.5,ease:'power2.inOut',clearProps:'strokeDasharray,strokeDashoffset'});}
        gsap.to('.fn-art',{yPercent:10,rotation:3,scale:.94,ease:'none',scrollTrigger:{trigger:'.fn-hero',start:'top top',end:'bottom top',scrub:.65}});
        gsap.to('.fn-aura',{yPercent:24,ease:'none',scrollTrigger:{trigger:'.fn-hero',start:'top top',end:'bottom top',scrub:1}});
        const findingWords=splitWords('.fn-finding .observation h2');
        if(findingWords.length)gsap.from(findingWords,{yPercent:115,rotation:2,duration:.95,stagger:.055,ease:'power3.out',scrollTrigger:{trigger:'.fn-finding',start:'top 74%',once:true},clearProps:'all'});
        gsap.utils.toArray('.fn-hairline').forEach(el=>gsap.from(el,{scaleX:0,transformOrigin:'left',ease:'power2.out',duration:.8,scrollTrigger:{trigger:el,start:'top 88%',once:true}}));
        gsap.from('.fn-note-mark',{rotation:-20,y:60,ease:'none',scrollTrigger:{trigger:'.fn-notes-section',start:'top bottom',end:'center center',scrub:.6}});
        gsap.to('.fn-reading-progress',{scaleX:1,transformOrigin:'left',ease:'none',scrollTrigger:{start:0,end:'max',scrub:true}});
        ScrollTrigger.create({start:10,end:'max',toggleClass:{targets:'.fn-header',className:'is-scrolled'}});
      });
      return ()=>{context?.revert();for(const {heading,html,label}of splitHeadings){heading.innerHTML=html;if(label===null)heading.removeAttribute('aria-label');else heading.setAttribute('aria-label',label);}};
    });
    if(!reduced&&matchMedia('(hover:hover) and (pointer:fine)').matches){
      const art=document.querySelector('.fn-art'),glint=document.querySelector('.fn-glint');
      if(art&&glint){const x=gsap.quickTo(glint,'x',{duration:.8,ease:'power3.out'}),y=gsap.quickTo(glint,'y',{duration:.8,ease:'power3.out'});art.addEventListener('pointermove',e=>{const rect=art.getBoundingClientRect();x((e.clientX-rect.left-rect.width/2)*.18);y((e.clientY-rect.top-rect.height/2)*.18);},{signal:abort.signal});}
    }
  }
  const observer=new IntersectionObserver(entries=>{
    for(const entry of entries){
      if(entry.target.id==='checkin')document.body.classList.toggle('is-checking-in',entry.isIntersecting);
      if(entry.isIntersecting)document.querySelectorAll('.fn-header nav a').forEach(link=>{if(link.hash==='#'+entry.target.id)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');});
    }
  },{rootMargin:'-15% 0px -55% 0px'});
  document.querySelectorAll('#session-details,#checkin').forEach(el=>observer.observe(el));
  const onSystemMotion=()=>{stopReplay();onPreferenceChange?.();};
  matchMedia('(prefers-reduced-motion:reduce)').addEventListener('change',onSystemMotion,{signal:abort.signal});
  return {stopReplay,toggleReplay,destroy(){stopReplay();abort.abort();observer.disconnect();media?.revert();}};
}
