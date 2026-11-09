import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarDay } from '../prototypes/calendar-day.js';
import { insightText,assertFactDirections,assertPersonalLimits,reportHasSupportedLimits } from '../prototypes/insight-format.js';
import { matchedRoutes } from '../analysis/route-matches.mjs';
import { progressModel,niceAxis } from '../prototypes/progress-model.js';
import { providerSchema } from '../analysis/gemini-schema.mjs';

test('insight quantities carry one unit and recorded heart rate cannot establish a personal limit',()=>{
 const facts=[{id:'run.hr',value:170,unit:'bpm'},{id:'run.cadence',value:154,unit:'spm'}];
 const format=f=>`${f.value} ${f.unit}`;
 assert.equal(insightText('Heart rate {run.hr} bpm; cadence {run.cadence} spm.',facts,format),'Heart rate 170 bpm; cadence 154 spm.');
 assert.doesNotThrow(()=>assertPersonalLimits('Your reported breathing stayed conversational.'));
 assert.throws(()=>assertPersonalLimits('This was well within your aerobic limits.'));
 assert.equal(reportHasSupportedLimits({verdict:{text:'A strong finish.',explanation:'Well within your aerobic limits.'}}),false);
 assert.equal(reportHasSupportedLimits({verdict:{text:'Your closing kilometre was faster.',explanation:'Heart rate rose through the finish.'}}),true);
});

test('calendar days follow member timezone at midnight and Australian daylight-saving boundaries',()=>{
 const instant=new Date('2026-11-08T13:30:00Z');assert.equal(calendarDay('Australia/Sydney',instant),'2026-11-09');assert.equal(calendarDay('America/New_York',instant),'2026-11-08');
 assert.equal(calendarDay('Australia/Sydney',new Date('2026-10-03T15:00:00Z')),'2026-10-04');
 assert.equal(calendarDay('invalid/timezone',instant),'2026-11-09');
});
test('runner-facing magnitudes avoid double-negative prose without changing the evidence',()=>{
 const facts=[{id:'period.trendChange',value:-1.2,unit:'kg'},{id:'comparison.s01.paceChange',value:-20,unit:'s/km'}],format=f=>f.value+' '+f.unit;
 assert.equal(insightText('Your trend fell by {period.trendChange}.',facts,format),'Your trend fell by 1.2 kg.');
 assert.equal(insightText('Change: {period.trendChange}.',facts,format),'Change: -1.2 kg.');
 assert.equal(insightText('Faster by {comparison.s01.paceChange}.',facts,format),'Faster by 20 s/km.');
 assert.throws(()=>assertFactDirections('Your trend rose by {period.trendChange}.',facts));
 assert.throws(()=>assertFactDirections('Slower by {comparison.s01.paceChange}.',facts));
 assert.equal(facts[0].value,-1.2);
});
function loop(id,{reverse=false,shift=0,date='2026-10-01'}={}){
 const records=Array.from({length:201},(_,i)=>{const angle=(reverse?-1:1)*i/200*Math.PI*2;return {t:i*6,lat:-37.9+Math.sin(angle)*.003,lon:145.1+Math.cos(angle)*.004+shift};});
 return {id,date,sport:'Run',distance:2175,timer:1200,records};
}
test('route matching verifies shape/direction, not just distance or matching endpoints',()=>{
 const a=loop('a'),b=loop('b',{shift:.00005,date:'2026-10-10'}),reverse=loop('reverse',{reverse:true}),other=loop('other',{shift:.002});
 assert.deepEqual(matchedRoutes([a,b,reverse,other]).map(g=>g.sessionIds),[['a','b']]);
 assert.deepEqual(matchedRoutes([a,loop('parallel-street',{shift:.0003})]),[]);
 const missing=loop('missing');missing.records[100].lat=null;missing.records.splice(101,10);
 assert.deepEqual(matchedRoutes([a,missing]),[]);
 const shorter=loop('shorter');shorter.distance=1500;assert.deepEqual(matchedRoutes([a,shorter]),[]);
 assert.deepEqual(matchedRoutes([{...a,records:[]},b]),[]);
});
test('chart axes use readable intervals and cover the largest measurement',()=>{
 for(const value of [.1,4.16,16.28,148,682]){const axis=niceAxis(value);assert.ok(axis.max>=value);assert.equal(axis.ticks[0],0);assert.equal(axis.ticks.at(-1),axis.max);assert.ok(axis.ticks.length<=5);}
 assert.deepEqual(niceAxis(16.28),{max:20,ticks:[0,10,20]});
});
test('weekly session-RPE load uses only rated minutes and keeps unrated runs visible',()=>{
 const sessions=[{id:'a',date:'2026-11-03',run:true,distanceM:5000,durationS:1800,effortRating:4},{id:'b',date:'2026-11-04',run:true,distanceM:5000,durationS:1800,effortRating:null}];
 const m=progressModel(sessions,'2026-11-08');assert.equal(m.effortWeeks.at(-1).load,120);assert.equal(m.effortWeeks.at(-1).rated,1);assert.equal(m.effortWeeks.at(-1).total,2);assert.equal(m.effortWeeks[0].rated,0);
});
test('provider schema bounds decoder complexity while application schemas keep exact evidence enums',()=>{
 const source={type:'object',properties:{factId:{type:'string',enum:Array.from({length:100},(_,i)=>'fact.'+i)},kind:{type:'string',enum:['pace','effort']},text:{type:'string',minLength:1,maxLength:100}},required:['factId','kind','text'],additionalProperties:false};
 const compact=providerSchema(source);assert.equal(compact.properties.factId.enum,undefined);assert.deepEqual(compact.properties.kind.enum,['pace','effort']);assert.equal(source.properties.factId.enum.length,100);assert.equal(compact.additionalProperties,false);
});
