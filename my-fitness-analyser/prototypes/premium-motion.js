export function mountPremiumMotion(){
  const observer=new IntersectionObserver(entries=>{
    for(const entry of entries){
      if(entry.target.id==='session-details')document.body.classList.toggle('is-exploring-data',entry.isIntersecting);
      if(entry.target.id==='checkin')document.body.classList.toggle('is-checking-in',entry.isIntersecting);
    }
  },{rootMargin:'-15% 0px -55% 0px'});
  document.querySelectorAll('#session-details,#checkin').forEach(element=>observer.observe(element));
  return {destroy(){observer.disconnect();}};
}
