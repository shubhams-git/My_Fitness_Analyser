import {CloudGoals} from './goals.mjs';
import { CloudZones } from './zones.mjs';
import { randomUUID,createHash } from 'node:crypto';
import { CloudLibrary,CloudError,cloudConfig } from './supabase.mjs';
import { authorize,requireOrigin,signIn,signOut } from './auth.mjs';
import { GarminSync } from '../prototypes/garmin.mjs';
import { trainingDataset } from '../prototypes/training-data.mjs';
import { CloudJournal,localDay } from './journal.mjs';
import { WeightIntelligence } from './weight-intelligence.mjs';
import { TrainingIntelligence,aiPreference,setAiPreference } from './intelligence.mjs';

export async function readBody(request,limit=3.5*1024*1024){
  if(request.body!==undefined){const bytes=Buffer.isBuffer(request.body)?request.body:Buffer.from(typeof request.body==='string'?request.body:JSON.stringify(request.body));if(bytes.length>limit)throw new CloudError(413,'Choose a file smaller than 3.5 MB.');return bytes;}
  let size=0;const parts=[];for await(const chunk of request){size+=chunk.length;if(size>limit)throw new CloudError(413,'Choose a file smaller than 3.5 MB.');parts.push(Buffer.from(chunk));}return Buffer.concat(parts);
}
export async function privateHandler(request,response,route,{configReader=cloudConfig,auth=authorize,libraryFactory=api=>new CloudLibrary(api),env=process.env}={}){
  const send=(status,value)=>{const body=JSON.stringify(value);if(Buffer.byteLength(body)>4000000)throw new CloudError(413,'This library exceeds the current online alpha size limit. Your data is preserved.');response.statusCode=status;response.setHeader('Content-Type','application/json');response.end(body);};
  response.setHeader('Cache-Control','private, no-store');response.setHeader('Referrer-Policy','no-referrer');response.setHeader('X-Content-Type-Options','nosniff');response.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'");
  try{
    if(env.FITNESS_CLOUD_ENABLED!=='1'&&!env.VERCEL)throw new CloudError(503,'Private hosting is not enabled. Use the local app.');
    const config=configReader(env);
    if(route==='login'&&request.method==='POST'){await signIn(request,response,config,JSON.parse((await readBody(request,16384)).toString()));send(200,{signedIn:true});return;}
    if(route==='logout'&&request.method==='POST'){await signOut(request,response,config);send(200,{signedOut:true});return;}
    const api=await auth(request,response,config),library=libraryFactory(api);
    const garminConfigured=Boolean(env.GARMIN_PERSONAL_API_KEY&&config.owner===api.config.owner);
    if(request.method==='POST')requireOrigin(request,config);
    if(route==='goals'&&['GET','POST'].includes(request.method)){const goals=new CloudGoals(api);send(200,request.method==='GET'?await goals.snapshot():await goals.save(JSON.parse((await readBody(request,8192)).toString())));return;}
    if(route==='zones'&&['GET','POST'].includes(request.method)){const zones=new CloudZones(api);send(200,request.method==='GET'?await zones.snapshot():await zones.save(JSON.parse((await readBody(request,8192)).toString())));return;}
    if(route==='weight-ai'&&['GET','POST'].includes(request.method)){const engine=new WeightIntelligence(api,{env});send(200,request.method==='GET'?await engine.status():await engine.generate());return;}
    if(route==='weight-ai-consent'&&request.method==='POST'){const body=JSON.parse((await readBody(request,4096)).toString());send(200,await new WeightIntelligence(api,{env}).setPreference(body.enabled));return;}
    if(route==='ai-consent'){
      if(request.method==='GET'){send(200,await aiPreference(api));return;}
      if(request.method==='POST'){const body=JSON.parse((await readBody(request,4096)).toString());send(200,await setAiPreference(api,body.enabled));return;}
    }
    if(route==='ai-review'&&['GET','POST'].includes(request.method)){
      const intelligence=new TrainingIntelligence(api,library,{env});send(200,request.method==='GET'?await intelligence.status():await intelligence.generate());return;
    }
    if(route==='password'&&request.method==='POST'){
      const body=JSON.parse((await readBody(request,4096)).toString());
      if(typeof body.password!=='string'||body.password.length<12||body.password.length>1024)throw new CloudError(400,'Use at least 12 characters for your new password.');
      const result=await api.request('/auth/v1/user',{method:'PUT',body:{password:body.password}});
      if(!result.ok)throw new CloudError(400,'The password could not be updated. Try a different password or sign in again.');
      send(200,{updated:true});return;
    }
    if(route==='screenshots'&&request.method==='POST'){
      const provider=request.headers['x-source-provider'],batch=request.headers['x-import-batch'];
      if(!['nike-run-club','strava'].includes(provider)||!/^[0-9a-f-]{36}$/i.test(batch||''))throw new CloudError(400,'Choose NRC or Strava for this import.');
      const bytes=await readBody(request),jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255,png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
      if(!jpeg&&!png)throw new CloudError(400,'Choose original JPG or PNG screenshots.');
      const hash=createHash('sha256').update(bytes).digest('hex'),key=`${api.config.owner}/submissions/${hash}.${jpeg?'jpg':'png'}`,path='/storage/v1/object/fitness-private/'+key;
      const upload=await api.request(path,{method:'POST',body:bytes,headers:{'Content-Type':jpeg?'image/jpeg':'image/png','x-upsert':'false'}});
      if(!upload.ok){const existing=await api.request(path);if(!existing.ok||createHash('sha256').update(Buffer.from(await existing.arrayBuffer())).digest('hex')!==hash)throw new CloudError(503,'This screenshot could not be saved. Please retry.');}
      let name;try{name=decodeURIComponent(request.headers['x-original-name']||'Screenshot');}catch{name='Screenshot';}
      const saved=await api.request('/rest/v1/screenshot_submissions?on_conflict=owner_id,provider,sha256',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates'},body:{owner_id:api.config.owner,batch_id:batch,provider,sha256:hash,original_name:name.slice(0,200),object_key:key,byte_length:bytes.length}});
      if(!saved.ok)throw new CloudError(503,'The image is preserved, but its review request needs a retry.');
      send(200,{saved:true,status:'pending_review'});return;
    }
    if(route==='profile'&&request.method==='GET'){
      const profiles=await api.json(`/rest/v1/fitness_profiles?owner_id=eq.${api.config.owner}&select=display_name,timezone`);
      const submissions=await api.json(`/rest/v1/screenshot_submissions?owner_id=eq.${api.config.owner}&select=id,provider,original_name,status,created_at&order=created_at.desc&limit=50`);
      send(200,{user:{...api.user,displayName:profiles[0]?.display_name||api.user.displayName||'Athlete'},garmin:{configured:garminConfigured},submissions,historyFrom:'2026-07-01'});return;
    }
    if(route==='journal'&&request.method==='GET'){send(200,{...await new CloudJournal(api).dataset({window:new URL(request.url,'http://localhost').searchParams.get('window')||'90',goalVersions:(await new CloudGoals(api).snapshot()).versions}),local:false,cloud:true,viewer:api.user});return;}
    if(route==='weigh-in'&&request.method==='POST'){send(200,await new CloudJournal(api).save(JSON.parse((await readBody(request,8192)).toString())));return;}
    if(route==='strength-entry'&&request.method==='POST'){send(200,await new CloudJournal(api).saveStrength(JSON.parse((await readBody(request,8192)).toString())));return;}
    if(route==='mass-preview'&&request.method==='POST'){send(200,await new CloudJournal(api).preview(await readBody(request)));return;}
    if(route==='mass-commit'&&request.method==='POST'){send(200,await new CloudJournal(api).commit(await readBody(request),{head:Number(request.headers['x-journal-revision']),hash:request.headers['x-import-hash'],confirmSameDay:request.headers['x-confirm-same-day']==='1'}));return;}
    if(route==='training'&&request.method==='GET'){const [data,profiles]=await Promise.all([library.read(),api.json(`/rest/v1/fitness_profiles?owner_id=eq.${api.config.owner}&select=timezone`)]);const timezone=profiles[0]?.timezone||'Australia/Sydney';send(200,{...trainingDataset(Object.values(data.activities),data.feedback,{goalVersions:(await new CloudGoals(api).snapshot()).versions,zoneVersions:(await new CloudZones(api).snapshot()).versions,window:new URL(request.url,'http://localhost').searchParams.get('window')==='all'?'all':'90',anchor:localDay(timezone)}),timezone,lastSync:data.garminSync?.lastSuccessAt||null,local:false,cloud:true,viewer:api.user,garminConfigured});return;}
    if(route==='data'&&request.method==='GET'){
      const data=await library.read(),activities=Object.values(data.activities).sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.time||'').localeCompare(a.time||'')||a.id.localeCompare(b.id));
      send(200,{zoneVersions:(await new CloudZones(api).snapshot()).versions,activities,activityAliases:data.activityAliases,defaultId:activities[0]?.id||null,feedback:data.feedback,viewer:api.user,mode:'private-training-record',localLibrary:true,cloudLibrary:true,importLimitMB:3.5,garmin:{...data.garminSync,configured:garminConfigured,running:false}});return;
    }
    if(route==='feedback'&&request.method==='POST'){const body=JSON.parse((await readBody(request)).toString()),data=await library.read();send(200,await library.save(body.id,body.draft,Object.keys(data.activities)));return;}
    if(route==='import'&&request.method==='POST'){send(200,await library.import(await readBody(request)));return;}
    if(route==='restore'&&request.method==='POST'){send(200,await library.restore(JSON.parse((await readBody(request)).toString())));return;}
    if(route==='sync'&&request.method==='POST'){
      if(!garminConfigured)throw new CloudError(409,'Garmin is not connected to your account. You can import your own original FIT file.');
      const claim=await api.json('/rest/v1/rpc/claim_fitness_sync',{method:'POST',body:{}});if(!claim)throw new CloudError(409,'A Garmin sync is already running.');
      try{const result=await new GarminSync(library,{keyReader:async()=>env.GARMIN_PERSONAL_API_KEY||'',cutoff:'2026-07-01'}).run();send(result.complete?200:502,result);}
      finally{await api.json('/rest/v1/rpc/release_fitness_sync',{method:'POST',body:{claim_id:claim}}).catch(()=>{});}return;
    }
    if(route==='export'&&request.method==='GET'){
      const data=await library.exportBackup(),key=`${api.config.owner}/exports/${randomUUID()}.json`;
      const upload=await api.request('/storage/v1/object/fitness-private/'+key,{method:'POST',body:JSON.stringify(data),headers:{'Content-Type':'application/json','x-upsert':'false'}});if(!upload.ok)throw new CloudError(503,'The private backup could not be prepared.');
      const signed=await api.json('/storage/v1/object/sign/fitness-private/'+key,{method:'POST',body:{expiresIn:60}});if(!signed.signedURL?.startsWith('/object/sign/'))throw new CloudError(503,'The backup link could not be prepared.');
      const url=config.url+'/storage/v1'+signed.signedURL+'&download=fitness-library.json';
      if(new URL(request.url,'http://localhost').searchParams.get('prepare')==='1'){send(200,{url});return;}
      response.statusCode=302;response.setHeader('Location',url);response.end();return;
    }
    throw new CloudError(405,'This action is not available.');
  }catch(error){send(error instanceof CloudError?error.status:500,{error:error instanceof CloudError?error.message:'The private request could not complete. Your saved data is preserved.'});}
}
