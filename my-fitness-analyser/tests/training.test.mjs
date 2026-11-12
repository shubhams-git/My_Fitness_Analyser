import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,relative } from 'node:path';
import { pathToFileURL,fileURLToPath } from 'node:url';
import { trainingDataset,syntheticHistory,evidencePack,mergeTrainingActivities } from '../prototypes/training-data.mjs';
import { REVIEW_VERSION,TOOL_NAME,validateReview } from '../analysis/contract.mjs';
import { GeminiReviews,demoEvidence,buildRequest,extractReport } from '../analysis/gemini.mjs';
import publicData from '../api/data.mjs';
import publicTraining from '../api/training.mjs';
import { privateHandler } from '../cloud/handler.mjs';
import { fieldNotesView } from '../prototypes/field-notes.js';
import { progressModel } from '../prototypes/progress-model.js';

function session(extra={}){return {id:'sample',title:'Private title',date:'2026-10-20',sport:'Run',source:'Garmin Connect',synthetic:false,provider:{id:'provider-sample',detail:{activityTypeDTO:{typeKey:'running'}}},distance:5000,timer:1800,moving:1780,elapsed:1820,hr:145,records:[{t:0,hr:140,lat:-37,lon:145},{t:1800,hr:150,lat:-37.01,lon:145.01}],...extra};}
const dataset=(a,options={})=>trainingDataset(a,{}, {anchor:'2026-11-01',window:'all',...options});
test('running windows report measured volume, frequency and longest runs without goals',()=>{
 const run=(id,date,extra={})=>session({id,date,provider:{id},...extra});
 const screenshot=run('history','2026-10-25',{provider:null,source:'Strava',sourceFile:'Owner-supplied screenshots',distance:6500,timer:null,moving:null,elapsed:null,records:[],hr:null});
 const rows=[run('today','2026-11-01'),run('today-again','2026-11-01',{distance:null,timer:null,moving:null,elapsed:null}),screenshot,
  run('prior-28','2026-10-04',{distance:6000}),run('outside','2026-09-06',{distance:7000}),run('tomorrow','2026-11-02',{distance:8000}),
  run('bike','2026-10-30',{distance:20000,provider:{id:'bike',detail:{activityTypeDTO:{typeKey:'cycling'}}}}),
  run('treadmill','2026-10-30',{distance:9000,provider:{id:'treadmill',detail:{activityTypeDTO:{typeKey:'treadmill_running'}}}}),
  run('row','2026-10-30',{provider:{id:'row',detail:{activityTypeDTO:{typeKey:'indoor_rowing'}}}})];
 const data=dataset(rows),[week,month]=data.summary.periods;
 assert.equal(data.goals.weekly.status,'unset');
 assert.deepEqual([week.recent.runs,week.recent.days,week.recent.distance,week.recent.duration],[2,1,{value:5000,count:1},{value:1800,count:1}]);
 assert.deepEqual([week.previous.distance,week.previous.duration],[{value:6500,count:1},{value:null,count:0}]);
 assert.equal(month.recent.longest.id,'history');assert.equal(month.previous.longest.id,'prior-28');assert.equal(data.summary.longest.id,'outside');
 assert.deepEqual(data.summary.modalities.map(r=>[r.kind,r.sessions]),[['run',3],['cycling',1],['rowing',1],['treadmill',1]]);
 assert.deepEqual(progressModel(data.sessions,data.anchor,'walk').sessions,[]);
 const paused=dataset(rows,{goalVersions:[{kind:'weekly-distance',effectiveFrom:'2026-10-26',revision:1,target:null}]});
 assert.equal(paused.goals.weekly.status,'paused');assert.deepEqual(paused.summary,data.summary);
 assert.deepEqual(dataset([]).summary.periods[0].recent.distance,{value:null,count:0});
});
test('comparisons stay within a source and time basis, and screenshot summaries never produce sensor streams',()=>{
 const run=(id,date,timer,extra={})=>session({id,date,timer,provider:{id},...extra});
 const screenshot=run('summary','2026-10-31',1200,{source:'Strava',sourceFile:'Owner-supplied screenshots',provider:null});
 const sourceHash='fit-revision',sameFit=run('local','2026-10-29',1900,{sourceHash,source:'Original FIT',provider:null});
 const data=dataset([run('latest','2026-11-01',1700),screenshot,run('mid','2026-10-29',1900,{sourceHash}),sameFit,
  run('early','2026-10-24',2000),run('trail','2026-10-23',4000,{fitSubSport:'trail_running'}),
  run('manual','2026-10-22',1000,{provider:null,source:'Original FIT'})]);
 assert.deepEqual(data.summary.pace,{id:'latest',date:'2026-11-01',earlierIds:['mid','early'],pace:340,baseline:390,change:-50});
 const imported=data.sessions.find(s=>s.id==='summary');
 assert.equal(imported.sourceKind,'screenshot');assert.equal(imported.gpsSamples,0);assert.equal(imported.zones,null);assert.deepEqual(imported.sparkline,[]);
 assert.equal(data.sessions.some(s=>s.id==='local'),false);
 assert.equal(dataset([screenshot,sameFit]).summary.pace,null);
});
test('signed-in training includes workout modalities and strength context with no goal rows',async()=>{
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const road=session({date:today}),bike=session({id:'bike',date:today,provider:{id:'ride',detail:{activityTypeDTO:{typeKey:'indoor_cycling'}}}});
 const api={config:{owner:'member'},json:async path=>path.includes('strength_entries_latest')?[{date_key:today,focus:'Legs',minutes:'30',note:'not public'}]:[]};
 const response={setHeader(){},end(value){this.value=JSON.parse(value);}};
 await privateHandler({method:'GET',url:'/api/training?view=progress'},response,'training',{env:{FITNESS_CLOUD_ENABLED:'1'},configReader:()=>({}),auth:async()=>api,
  libraryFactory:()=>({read:async()=>({activities:{sample:road,bike},feedback:{}})})});
 assert.equal(response.statusCode,200);
 assert.equal(response.value.goals.weekly.status,'unset');
 assert.deepEqual(response.value.sessions.map(s=>s.kind).sort(),['run','stationary-bike']);
 assert.deepEqual(response.value.journalStrength,{sessions:1,days:1});
 assert.doesNotMatch(JSON.stringify(response.value),/not public/);
});
test('monthly progress includes imported Nike runs without treating them as GPS efforts',()=>{
 const historical=(id,date)=>session({id,date,source:'Nike Run Club',sourceFile:'Owner-supplied screenshots',provider:null,distance:2190,timer:null,moving:null,running:825,displayedPace:376,records:[],hr:null});
 const road=session({date:'2026-11-01'});
 const treadmill=session({id:'treadmill',provider:{id:'treadmill',detail:{activityTypeDTO:{typeKey:'treadmill_running'}}}});
 const data=dataset([road,treadmill,historical('sep','2026-09-20'),historical('oct','2026-10-04')],{outdoorGarminOnly:true,includeImportedRuns:true});
 const progress=progressModel(data.sessions,data.anchor);
 assert.deepEqual(progress.monthly.map(m=>[m.key,m.count,m.totalM,m.totalS]),[
  ['2026-09',1,2190,825],['2026-10',1,2190,825],['2026-11',1,5000,1800]
 ]);
 assert.equal(data.sessions.find(s=>s.id==='oct').paceSPerKm,376);
 assert.ok(progress.efforts.every(e=>e.results.every(r=>r.id!=='sep'&&r.id!=='oct')));
});
test('stationary sessions never render route or run analysis, even with GPS samples',()=>{
 const render=activity=>fieldNotesView({activity,icon:()=>'',logo:'',dateText:()=>'',escape:x=>x,routePanel:()=>'ROUTE MARKER',stats:()=>'SUMMARY MARKER',observationPanel:()=>'',analysisPanel:()=>'CHART MARKER',blocksPanel:()=>'',sourceNote:()=>'',inlineCheckin:()=>'',distance:()=>'',miniRoute:''});
 const road=session(),treadmill=session({id:'treadmill',provider:{id:'treadmill',detail:{activityTypeDTO:{typeKey:'treadmill_running'}}}});
 const bike=session({id:'bike',provider:{id:'bike',detail:{activityTypeDTO:{typeKey:'indoor_cycling'}}}});
 for(const activity of [treadmill,bike]){
  const html=render(activity);
  assert.match(html,/SUMMARY MARKER/);
  assert.doesNotMatch(html,/ROUTE MARKER|CHART MARKER|Replay route|Replay unavailable/);
 }
 assert.match(render(road),/ROUTE MARKER/);
 const history=session({id:'history',source:'Nike Run Club',provider:null});
 assert.deepEqual(dataset([road,treadmill,bike,history],{outdoorGarminOnly:true}).sessions.map(s=>s.id),[road.id]);
});
async function temporaryCache(){return pathToFileURL((await mkdtemp(join(tmpdir(),'fitness-analysis-')) )+'/');}
async function removeCache(directory){assert.match(relative(tmpdir(),fileURLToPath(directory)),/^fitness-analysis-[^\\/]+[\\/]?$/);await rm(directory,{recursive:true,force:true});}
function report(pack=demoEvidence()){return {schemaVersion:REVIEW_VERSION,evidenceHash:pack.hash,dataset:'synthetic',summary:'The imported record includes runs with different sensor coverage.',findings:[{kind:'coverage_gap',title:'Heart rate is missing in part of the record.',explanation:'Inspect the available heart-rate sessions without filling the gaps.',confidence:'direct_evidence',factIds:['history.hrSessions','history.sessions']}],visualizations:[{type:'session_distance',sessionIds:['s01','s02']}],nextChecks:[]};}

test('training window, chronology and canonical source aliases preserve measurements',()=>{
 const a=session(),alias={...a,id:'manual',provider:null,sourceHash:'same'},attached={...a,sourceHash:'same'};
 const merged=mergeTrainingActivities([alias], [attached]);assert.equal(merged.length,1);assert.equal(merged[0].id,a.id);
 const d=dataset([a,{...a,id:'old',provider:{id:'old'},date:'2025-12-17'},{...a,id:'future',provider:{id:'future'},date:'2027-01-01'},{...a,id:'duplicate'}],{window:'90'});
 assert.equal(d.sessions.length,1);assert.equal(d.metrics.distanceM,5000);assert.equal(d.sessions[0].paceSPerKm,360);assert.equal(d.sessions[0].durationBasis,'timer');assert.equal(d.sessions[0].hrBpm,145);
 assert.equal(dataset([a,{...a,id:'old',provider:{id:'old'},date:'2025-12-17'}]).sessions.length,2);
 assert.equal(d.weeks.reduce((n,w)=>n+w.distanceM,0),5000);assert.equal(a.records[0].hr,140);
});
test('missing sensors, unusable distance, screenshots and pauses stay distinct',()=>{
 const missing=session({distance:.78,hr:null,records:[],provider:{id:'indoor',detail:{activityTypeDTO:{typeKey:'treadmill_running'}}}});
 const indoor=dataset([missing]).sessions[0];assert.equal(indoor.environment,'indoor');assert.equal(indoor.paceSPerKm,null);assert.equal(indoor.hrBpm,null);assert.equal(indoor.comparable,false);assert.equal(indoor.distanceM,.78);
 const screenshot=dataset([session({provider:null,sourceFile:'Owner-supplied screenshots',timer:null,moving:1280,displayedPace:447,distance:2860,records:[],hr:null})]).sessions[0];assert.equal(screenshot.paceSPerKm,447);assert.equal(screenshot.paceBasis,'displayed');assert.equal(screenshot.durationBasis,'moving');assert.equal(screenshot.gpsSamples,0);assert.equal(screenshot.comparable,false);
 const paused=dataset([session({moving:700})]).sessions[0];assert.ok(paused.flags.includes('different_time_bases'));assert.equal(paused.paceSPerKm,360);assert.equal(paused.comparable,false);
 const walk=dataset([session({sport:'Walk'})]);assert.equal(walk.metrics.runs,0);assert.equal(walk.metrics.walks,1);assert.equal(walk.metrics.paceSessions,0);
});
test('evidence excludes titles, notes, absolute dates and raw GPS; comparisons require compatible recent runs',()=>{
 const a=session({title:'PRIVATE NAME',notes:'PRIVATE NOTE'}),b=session({id:'baseline',provider:{id:'baseline'},date:'2026-10-05',timer:1900,moving:1880}),pack=evidencePack(dataset([a,b]));
 const text=JSON.stringify(pack.content);for(const secret of ['PRIVATE NAME','PRIVATE NOTE','2026-10-20','lat','lon','provider-sample'])assert.ok(!text.includes(secret),secret);
 assert.ok(pack.content.facts.some(f=>f.id==='comparison.paceChangePercent'));assert.equal(pack.mapping.s01,'sample');assert.equal(evidencePack(dataset([a,b])).hash,pack.hash);
 for(const variant of [{...b,date:'2026-06-01'},{...b,distance:10000},{...b,moving:400},{...b,provider:{id:'indoor',detail:{activityTypeDTO:{typeKey:'treadmill_running'}}}}])assert.ok(!evidencePack(dataset([a,variant])).content.facts.some(f=>f.id.startsWith('comparison.')));
 assert.notEqual(evidencePack(dataset([{...a,hr:146},b])).hash,pack.hash);
});
test('synthetic fixture is coherent, explicitly synthetic and has deliberate coverage gaps',()=>{
 const d=dataset(syntheticHistory(),{synthetic:true}),pack=evidencePack(d);assert.equal(d.sessions.length,10);assert.equal(d.metrics.hrSessions,8);assert.equal(d.sessions.filter(s=>s.environment==='indoor').length,1);assert.equal(pack.content.dataset,'synthetic');
 const a=syntheticHistory()[2];assert.ok(Math.abs(a.records.reduce((sum,r)=>sum+r.hr,0)/a.records.length-a.hr)<1e-9);assert.ok(Math.abs(a.records.at(-1).t-a.timer)<1e-9);
 assert.equal(dataset(syntheticHistory()).sessions.length,0);
});
test('hosted activity and training routes never fall back to a synthetic preview',async()=>{
 for(const handler of [publicData,publicTraining]){const response={setHeader(){},end(value){this.value=JSON.parse(value);}};await handler({method:'GET',headers:{},url:'/api/training?window=all'},response);assert.ok([401,503].includes(response.statusCode));assert.equal(response.value.activities,undefined);assert.equal(response.value.sessions,undefined);assert.equal(response.value.dataset,undefined);}
});
test('review schema rejects extra fields, mismatched context, unknown refs, unsupported claims and unavailable charts',()=>{
 const pack=demoEvidence(),valid=report(pack);assert.equal(validateReview(valid,pack),valid);
 const mutations=[r=>r.extra=true,r=>r.evidenceHash='wrong',r=>r.findings[0].factIds=['unknown'],r=>r.summary='Your fitness improved.',r=>r.summary='Run 20 minutes.',r=>r.summary='<script>alert()</script>',r=>r.summary='a'.repeat(241),r=>r.visualizations[0].sessionIds=['unknown'],r=>r.visualizations=[{type:'heart_rate_history',sessionIds:['s06']}],r=>{r.findings[0].kind='pace_pattern';r.findings[0].factIds=['history.sessions'];},r=>{r.findings[0].kind='insufficient_history';r.findings[0].factIds=['history.comparableSessions'];},r=>{r.findings[0].kind='coverage_gap';r.findings[0].factIds=['history.comparableSessions'];},r=>{r.findings[0].kind='recording_quality';r.findings[0].factIds=['s01.distanceM'];},r=>{r.findings[0].kind='volume_pattern';r.findings[0].factIds=['history.sessions'];}];
 for(const mutate of mutations){const r=structuredClone(valid);mutate(r);assert.throws(()=>validateReview(r,pack));}
 const personal=evidencePack(dataset([session()]));assert.throws(()=>validateReview({...valid,evidenceHash:personal.hash},personal));assert.throws(()=>buildRequest(personal,'gemini-3.6-flash'),/Personal-data/);
});
test('Interactions request forces one known tool, stateless storage and source-selected charts',()=>{
 const pack=demoEvidence(),request=buildRequest(pack,'gemini-3.6-flash');assert.equal(request.store,false);assert.deepEqual(request.generation_config.tool_choice.allowed_tools,{mode:'any',tools:[TOOL_NAME]});assert.equal(request.tools.length,1);assert.equal(request.tools[0].parameters.additionalProperties,false);assert.equal(JSON.parse(request.input).evidenceHash,pack.hash);
 const valid={status:'requires_action',steps:[{type:'function_call',name:TOOL_NAME,arguments:report(pack)}]};assert.equal(extractReport(valid,pack).dataset,'synthetic');
 for(const result of [{...valid,status:'incomplete'},{...valid,steps:[]},{...valid,steps:[...valid.steps,...valid.steps]},{...valid,steps:[{...valid.steps[0],name:'execute_sql'}]},{...valid,steps:[{...valid.steps[0],arguments:'{}'}]}])assert.throws(()=>extractReport(result,pack));
});
test('unconfirmed free-tier configuration blocks generation without a provider request',async()=>{
 const directory=await temporaryCache();let calls=0;try{const service=new GeminiReviews({directory,configReader:async()=>({key:'SYNTHETIC_TEST_KEY',model:'gemini-3.8-flash',freeTierConfirmed:false}),fetcher:async()=>{calls++;}});assert.equal((await service.status()).configured,false);await assert.rejects(service.generate(),/Free plan/);assert.equal(calls,0);}finally{await removeCache(directory);}
});
test('Gemini requests deduplicate, cache only validated responses and invalidate with the model',async()=>{
 const directory=await temporaryCache();let calls=0,model='gemini-3.6-flash';
 try{const pack=demoEvidence(),service=new GeminiReviews({directory,configReader:async()=>({key:'SYNTHETIC_TEST_KEY',model}),fetcher:async(url,options)=>{calls++;assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/interactions');assert.equal(options.headers['x-goog-api-key'],'SYNTHETIC_TEST_KEY');assert.equal(JSON.parse(options.body).store,false);return new Response(JSON.stringify({status:'requires_action',model,steps:[{type:'function_call',name:TOOL_NAME,arguments:report(pack)}]}));}});
 const [a,b]=await Promise.all([service.generate(),service.generate()]);assert.equal(calls,1);assert.equal(a.evidenceHash,b.evidenceHash);assert.equal(a.validated,true);assert.equal((await service.generate()).cached,true);assert.equal(calls,1);
 assert.equal((await service.status()).configured,true);model='gemini-3.8-flash';assert.equal((await service.status()).review,null);
 const context=await service.context();await writeFile(new URL(context.cacheKey+'.json',directory),JSON.stringify({...a,requestedModel:model,report:{...a.report,extra:true}}));assert.equal(await service.cached(context),null);
 }finally{await removeCache(directory);}
});
test('missing key and quota failures do not expose credentials or provider error bodies',async()=>{
 const directory=await temporaryCache();try{let calls=0;const noKey=new GeminiReviews({directory,configReader:async()=>({key:'',model:'gemini-3.6-flash'}),fetcher:async()=>{calls++;}});assert.equal((await noKey.status()).configured,false);await assert.rejects(noKey.generate(),/GEMINI_API_KEY/);assert.equal(calls,0);
 const fail=new GeminiReviews({directory,configReader:async()=>({key:'PRIVATE_KEY',model:'gemini-3.6-flash'}),fetcher:async()=>new Response('PRIVATE_PROVIDER_BODY',{status:429})});await assert.rejects(fail.generate(),error=>/quota/.test(error.message)&&!error.message.includes('PRIVATE'));await assert.rejects(fail.generate(),/wait a minute/);}finally{await removeCache(directory);}
});
