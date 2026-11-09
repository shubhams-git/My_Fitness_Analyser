const token=/\{([\w.]+)\}/g;
const directionWord=prefix=>prefix.match(/\b(up|down|rose|risen|rising|fell|fallen|falling|dropped|increased|decreased|faster|slower|quicker)\s*(?:by\s*)?$/i)?.[1].toLowerCase();
const down=new Set(['down','fell','fallen','falling','dropped','decreased']);
export function assertFactDirections(text,facts){
 const map=new Map(facts.map(f=>[f.id,f]));
 for(const m of text.matchAll(token)){const f=map.get(m[1]),word=directionWord(text.slice(Math.max(0,m.index-45),m.index));if(!word||!f)continue;
  if(/\.(paceChange|splitChange)$/.test(f.id)){if(f.value>0&&['faster','quicker'].includes(word)||f.value<0&&word==='slower')throw new Error('Reversed pace direction');}
  if(['period.trendChange','recent.weeklyRate','latest.change','latest.vsTrend','week.distanceChange','week.distanceChangePercent'].includes(f.id)){
   if(f.value>0&&down.has(word)||f.value<0&&['up','rose','risen','rising','increased'].includes(word))throw new Error('Reversed change direction');
  }
 }
}
export function assertPersonalLimits(text){
 // This evidence contract has no reviewed personal zones or thresholds yet.
 // A recorded heart rate/check-in cannot establish a member's aerobic limit.
 if(/\bwithin\s+(?:your\s+)?aerobic\s+limits?\b|\byour\s+(?:aerobic|anaerobic|lactate)\s+threshold\b|\b(?:your\s+)?(?:heart.rate|pace)\s+zone\s+(?:one|two|three|four|five)\b/i.test(text))throw new Error('Personal limits require reviewed thresholds.');
}
export function reportHasSupportedLimits(report){
 try{for(const item of [report?.verdict,...(report?.findings||[])])for(const value of [item?.text,item?.headline,item?.explanation,item?.nextAction])if(value)assertPersonalLimits(value);return true;}catch{return false;}
}
export function insightText(text,facts,format){const map=new Map(facts.map(f=>[f.id,f]));return text.replace(token,(_,id,offset)=>{const f=map.get(id);if(!f)return '—';const word=directionWord(text.slice(Math.max(0,offset-45),offset));return format(word&&f.value<0?{...f,value:Math.abs(f.value)}:f);}).replace(/\b(bpm|spm|kg|km|kcal)\s+\1\b/gi,'$1').replace(/\/km\s*\/km/gi,'/km');}
