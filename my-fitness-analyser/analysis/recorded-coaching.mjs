import {COACH_SCHEMA,discomfortVerdict,signalDirection,validateCoaching} from './coaching-contract.mjs';

export const RECORDED_COACH='recorded-training';

export function recordedTrainingReport(pack){
 const facts=new Map(pack.content.facts.map(fact=>[fact.id,fact.value]));
 const recent=pack.content.sessions[0]?.ref;
 const distance=`${recent}.distanceM`;
 const pace=`${recent}.paceSPerKm`;
 const comparison=`comparison.${recent}`;
 const comparisonId=`${comparison}.paceChange`;
 const difference=`${comparison}.paceDifference`;
 const findings=[];
 const signal=factId=>({factId,direction:signalDirection(factId,facts.get(factId))});
 let verdict=discomfortVerdict(pack);
 if(!verdict&&facts.has(comparisonId)&&facts.has(difference)&&Math.abs(facts.get(comparisonId))>=1){
  const direction=signal(comparisonId).direction;
  verdict={
   text:`Your latest comparable run was ${direction} by {${difference}}.`,
   explanation:`The benchmark is your median across {${comparison}.count} earlier similar runs. Effort, terrain and weather can all affect pace.`,
   nextAction:'Repeat a familiar route at conversational effort and record how it felt so the next comparison has effort context.',
   factIds:[comparisonId,difference,`${comparison}.count`],signal:signal(comparisonId)
  };
 }
 if(!verdict){
  const factId=facts.has(distance)?distance:'history.runs';
  verdict={
   text:facts.has(distance)?`Your latest recorded run covered {${distance}}.`:'Your log contains {history.runs} recorded runs.',
   explanation:facts.has(pace)?`Your recorded pace was {${pace}}. Repeating a similar session makes it easier to compare effort.`:'A repeat session with comparable timing gives you a better reference for progress.',
   nextAction:'Choose a familiar distance and log your effort and breathing after the run.',
   factIds:facts.has(pace)?[factId,pace]:[factId],signal:signal(factId)
  };
 }
 if(!facts.has('safety.affected')){
  if(facts.has('week.recent.distance')&&facts.has('week.previous.distance')){
   findings.push({kind:'consistency',headline:'Your running distance across the last two weeks.',
    explanation:'You logged {week.recent.distance} in the recent week and {week.previous.distance} in the preceding week.',
    assessment:'measured',factIds:['week.recent.distance','week.previous.distance'],signal:signal('week.recent.distance'),
    nextAction:'Use the recorded weeks as a baseline when choosing your next familiar distance.'});
  }
  const opening=`${recent}.openingSplit`,closing=`${recent}.closingSplit`,change=`${recent}.splitChange`;
  if(facts.has(opening)&&facts.has(closing)&&facts.has(change)&&
    (facts.get(change)===0||Math.round(facts.get(opening))!==Math.round(facts.get(closing)))){
   const direction=signal(change).direction;
   findings.push({kind:'pacing',headline:direction==='steady'?'Your opening and closing splits matched.':`Your closing kilometre was ${direction} than your opening kilometre.`,
    explanation:`The opening full kilometre was {${opening}} and the closing full kilometre was {${closing}}.`,
    assessment:'measured',factIds:[opening,closing,change],signal:signal(change),
    nextAction:'On a similar route, check how your breathing changes between the opening and closing kilometres.'});
  }
  const effort=`${recent}.effort`;
  if(facts.has(effort)){
   findings.push({kind:'effort',headline:`You rated the latest run {${effort}} for effort.`,
    explanation:'Your check-in provides an effort reference alongside the watch measurements.',
    assessment:'measured',factIds:[effort],signal:signal(effort),nextAction:'Log effort again after a comparable session.'});
  }
 }
 return validateCoaching({schemaVersion:COACH_SCHEMA,evidenceHash:pack.hash,verdict,findings,charts:[]},pack);
}
