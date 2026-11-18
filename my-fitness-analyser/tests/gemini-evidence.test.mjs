import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchGarminRecovery,mergeGarminRecovery} from '../prototypes/garmin-recovery.mjs';
import {coachingEvidence,coachingViews} from '../analysis/coaching-evidence.mjs';
import {coachingGenerationRequest,TrainingIntelligence} from '../cloud/intelligence.mjs';
import {geminiAttempt,geminiKeys,structuredGeminiRequest} from '../cloud/gemini-router.mjs';
import {TRAINING_ROUTE} from '../cloud/training-job-policy.mjs';
import {syntheticHistory} from '../prototypes/training-data.mjs';
import {geminiOutput} from './gemini-fixture.mjs';

const anchor='2026-11-07';
test('Garmin range projection preserves separate coverage, quality and gaps without identifiers or raw streams',async()=>{
 const feeds=await fetchGarminRecovery({json:async path=>{
  assert.match(path,/2026-10-11/);
  if(path.includes('sleep'))return [
   {calendarDate:anchor,sleepTimeSeconds:25200,remSleepSeconds:0,deviceRemCapable:false,napTimeSeconds:0,
    sleepWindowConfirmed:false,sleepFromDevice:true,sleepScores:{overall:{value:76}},userProfilePK:3405683,sleepScoreFeedback:'DO_NOT_SHARE'},
   {calendarDate:'2026-11-06',sleepTimeSeconds:0,deepSleepSeconds:0,sleepScores:{overall:{value:0}}},
   {calendarDate:'2026-11-05',sleepTimeSeconds:27000,deepSleepSeconds:0},
   {calendarDate:'2026-11-01',sleepTimeSeconds:23000}
  ];
  if(path.includes('hrv'))return {hrvSummaries:[{calendarDate:anchor,lastNightAvg:42,weeklyAvg:null,records:['DO_NOT_SHARE']}]};
  return {data:[
   {calendarDate:anchor,includesWellnessData:true,heartRate:{restingValue:53},stress:{avgLevel:-1},bodyBattery:{maxValue:88,minValue:8},
    calories:{burnedTotal:2200},pulseOx:{minValue:95},uuid:'DO_NOT_SHARE'},
   {calendarDate:'2026-11-06',includesWellnessData:false,heartRate:{restingValue:62}}
  ]};
 }},anchor);
 const merged=mergeGarminRecovery(feeds,{...feeds,hrv:{state:'unavailable',through:anchor}});
 const activities=Object.fromEntries(syntheticHistory().map(a=>[a.id,{...a,synthetic:false,source:'Garmin Connect',title:'DO_NOT_SHARE'}]));
 const pack=coachingEvidence({activities,feedback:{},garminRecovery:merged},{anchor,strengthEntries:[],includeRecovery:true});
 const {domains}=pack.content.recovery, facts=Object.fromEntries(pack.content.facts.map(fact=>[fact.id,fact.value]));
 assert.equal(facts['recovery.sleep.d0.score'],76);
 assert.equal(facts['recovery.sleep.d0.napS'],0);
 assert.equal(facts['recovery.sleep.d0.remS'],undefined);
 assert.equal(facts['recovery.sleep.d1.deepS'],undefined);
 assert.equal(facts['recovery.sleep.d2.deepS'],0);
 assert.equal(facts['recovery.sleep.recent7.sleepSDays'],3);
 assert.equal(domains.sleep.rows[0].windowConfirmed,false);
 assert.equal(domains.sleep.coverage.sleepS,3);
 assert.equal(domains.hrv.state,'unavailable');
 assert.equal(facts['recovery.hrv.d0.overnightMs'],42);
 assert.equal(facts['recovery.wellness.d0.restingHrBpm'],53);
 assert.equal(facts['recovery.wellness.d0.stress'],undefined);
 const body=JSON.stringify(coachingGenerationRequest(pack));
 assert.doesNotMatch(body,/DO_NOT_SHARE|3405683|restingValue|pulseOx|calories|2026-11-07|"lat"|"longitude"/);
 assert.match(body,/potentially imperfect wearable estimates/);
 assert.match(body,/do not assume missing days are zero/i);
 const views=[...coachingViews(pack)];
 assert.deepEqual(views,[...coachingViews(pack)]);
 assert.deepEqual(views.map(view=>view.content.recovery.domains.sleep.rows.length),[3,3,3,2]);
 assert.equal(views.at(-1).content.facts.some(fact=>fact.id==='recovery.sleep.d6.sleepS'),false);
 assert.equal(views.at(-1).content.facts.some(fact=>fact.id==='recovery.sleep.recent7.sleepS'),true);
 for(const view of views){
  const refs=new Set(view.content.sessions.map(session=>session.ref));
  assert.ok(view.content.facts.every(fact=>fact.sessionIds.every(ref=>refs.has(ref))));
  assert.ok(view.content.comparisons.every(comparison=>comparison.sessionIds.every(ref=>refs.has(ref))));
 }
});

test('older consent blocks before reading evidence and production uses one five-key pool',async()=>{
 const env={GEMINI_API_KEY:'a',GEMINI_API_KEY_2:'b',GEMINI_API_KEY_3:'c',GEMINI_API_KEY_4:'d',GEMINI_API_KEY_5:'e'};
 const api={config:{owner:'member'},json:async()=>[{enabled:true,disclosure_version:'gemini-training-v2',revision:4}]};
 const engine=new TrainingIntelligence(api,{read:async()=>assert.fail('read evidence')},{durable:true,wholeTraining:true,env});
 assert.equal((await engine.status()).consent.enabled,null);
 await assert.rejects(engine.enqueue(),error=>error.status===403);
 assert.equal(engine.configured(),true);
 assert.deepEqual(geminiKeys({...env,GEMINI_API_KEY_1:'ignored'}),['a','b','c','d','e']);
 env.GEMINI_API_KEY_5=' a ';
 assert.equal(engine.configured(),false);
 assert.deepEqual(TRAINING_ROUTE.map(({model,timeout})=>[model,timeout]),[
  ['gemini-3.6-flash',120000],['gemini-3.6-flash',70000],['gemini-3-flash-preview',55000],['gemini-3.1-flash-lite',40000]
 ]);
});

test('each model counts the complete generation input and retries only bounded, reduced views',async()=>{
 const entry=TRAINING_ROUTE.at(-1),seen=[];
 const candidates=['full','medium','small','minimal'].map(input=>({
  body:structuredGeminiRequest({instruction:'required instructions',input,schema:{type:'object'}}),validate:()=>input
 }));
 const fetcher=async(url,{body})=>{
  assert.match(url,new RegExp(entry.model));
  if(!body)return Response.json({name:'models/'+entry.model,inputTokenLimit:490000,supportedGenerationMethods:['countTokens','generateContent']});
  if(url.endsWith(':countTokens')){
   const {model,...candidate}=JSON.parse(body).generateContentRequest;
   assert.equal(model,'models/'+entry.model);assert.deepEqual(candidate,candidates[seen.length].body);
   seen.push(candidate);
   return Response.json({totalTokens:[510000,490001,490000][seen.length-1]});
  }
  assert.deepEqual(JSON.parse(body),seen.at(-1));
  return geminiOutput({ok:true});
 };
 const {attempt,report}=await geminiAttempt({entry,apiKey:'test',candidates,fetcher});
 assert.equal(report,'small');assert.equal(attempt.evidenceReduction,2);assert.equal(attempt.countedInputTokens,490000);
});

test('oversize, malformed, unavailable and revoked preflight never reach generation',async()=>{
 const entry=TRAINING_ROUTE[0],body=structuredGeminiRequest({instruction:'rules',input:{sample:true},schema:{}});
 for(const [count,outcome] of [
  [()=>Response.json({totalTokens:500001}),'token-limit'],
  [()=>Response.json({totalTokens:'12'}),'token-count-unavailable'],
  [()=>new Response('PRIVATE_PROVIDER_BODY',{status:503}),'token-count-unavailable'],
  [()=>{throw new DOMException('PRIVATE_PROVIDER_BODY','TimeoutError');},'token-count-unavailable']
 ]){
  let counts=0;
  const result=await geminiAttempt({entry,apiKey:'PRIVATE_KEY',candidates:Array(8).fill({body}),fetcher:async url=>{
   if(url.endsWith(':generateContent'))assert.fail('sent unverified input');
   if(url.endsWith(':countTokens')){counts++;return count();}
   return Response.json({name:'models/'+entry.model,inputTokenLimit:1048576,supportedGenerationMethods:['countTokens','generateContent']});
  }});
  assert.equal(result.attempt.outcome,outcome);
  assert.equal(counts,outcome==='token-limit'?4:1);
  assert.doesNotMatch(JSON.stringify(result),/PRIVATE/);
 }
 let checks=0;
 const result=await geminiAttempt({entry,apiKey:'test',body,beforeInput:async()=>++checks===1,fetcher:async url=>{
  if(url.endsWith(':countTokens'))return Response.json({totalTokens:500000});
  if(url.endsWith(':generateContent'))assert.fail('sent after revocation');
  return Response.json({name:'models/'+entry.model,inputTokenLimit:1048576,supportedGenerationMethods:['countTokens','generateContent']});
 }});
 assert.equal(result.attempt.outcome,'consent-changed');assert.equal(checks,2);
});
