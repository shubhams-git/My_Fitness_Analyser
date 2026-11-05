import { randomUUID } from 'node:crypto';
import { CloudLibrary,CloudError,cloudConfig } from './supabase.mjs';
import { authorize,requireOrigin,signIn,signOut } from './auth.mjs';
import { GarminSync } from '../prototypes/garmin.mjs';
import { trainingDataset } from '../prototypes/training-data.mjs';

export async function readBody(request,limit=3.5*1024*1024){
  if(request.body!==undefined){const bytes=Buffer.isBuffer(request.body)?request.body:Buffer.from(typeof request.body==='string'?request.body:JSON.stringify(request.body));if(bytes.length>limit)throw new CloudError(413,'Choose a file smaller than 3.5 MB.');return bytes;}
  let size=0;const parts=[];for await(const chunk of request){size+=chunk.length;if(size>limit)throw new CloudError(413,'Choose a file smaller than 3.5 MB.');parts.push(Buffer.from(chunk));}return Buffer.concat(parts);
}
export async function privateHandler(request,response,route,{configReader=cloudConfig,auth=authorize,libraryFactory=api=>new CloudLibrary(api),env=process.env}={}){
  const send=(status,value)=>{const body=JSON.stringify(value);if(Buffer.byteLength(body)>4000000)throw new CloudError(413,'This library exceeds the current online alpha size limit. Your data is preserved.');response.statusCode=status;response.setHeader('Content-Type','application/json');response.end(body);};
  response.setHeader('Cache-Control','private, no-store');response.setHeader('Referrer-Policy','no-referrer');response.setHeader('X-Content-Type-Options','nosniff');response.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'");
  try{
    if(env.FITNESS_CLOUD_ENABLED!=='1')throw new CloudError(503,'Private hosting is not enabled. Use the local app.');
    const config=configReader(env);
    if(route==='login'&&request.method==='POST'){await signIn(request,response,config,JSON.parse((await readBody(request,16384)).toString()));send(200,{signedIn:true});return;}
    if(route==='logout'&&request.method==='POST'){await signOut(request,response,config);send(200,{signedOut:true});return;}
    const api=await auth(request,response,config),library=libraryFactory(api);
    if(request.method==='POST')requireOrigin(request,config);
    if(route==='training'&&request.method==='GET'){const data=await library.read();send(200,{...trainingDataset(Object.values(data.activities),data.feedback,{window:new URL(request.url,'http://localhost').searchParams.get('window')==='all'?'all':'90'}),lastSync:data.garminSync?.lastSuccessAt||null,local:false});return;}
    if(route==='data'&&request.method==='GET'){
      const data=await library.read(),activities=Object.values(data.activities).sort((a,b)=>b.startInstant.localeCompare(a.startInstant));
      send(200,{activities,defaultId:activities[0]?.id||null,feedback:data.feedback,localLibrary:true,cloudLibrary:true,importLimitMB:3.5,garmin:{...data.garminSync,configured:Boolean(env.GARMIN_PERSONAL_API_KEY),running:false}});return;
    }
    if(route==='feedback'&&request.method==='POST'){const body=JSON.parse((await readBody(request)).toString()),data=await library.read();send(200,await library.save(body.id,body.draft,Object.keys(data.activities)));return;}
    if(route==='import'&&request.method==='POST'){send(200,await library.import(await readBody(request)));return;}
    if(route==='restore'&&request.method==='POST'){send(200,await library.restore(JSON.parse((await readBody(request)).toString())));return;}
    if(route==='sync'&&request.method==='POST'){
      if(!env.GARMIN_PERSONAL_API_KEY)throw new CloudError(409,'Garmin is not connected to this private app yet.');
      const claim=await api.json('/rest/v1/rpc/claim_fitness_sync',{method:'POST',body:{}});if(!claim)throw new CloudError(409,'A Garmin sync is already running.');
      try{const result=await new GarminSync(library,{keyReader:async()=>env.GARMIN_PERSONAL_API_KEY||''}).run();send(result.complete?200:502,result);}
      finally{await api.json('/rest/v1/rpc/release_fitness_sync',{method:'POST',body:{claim_id:claim}}).catch(()=>{});}return;
    }
    if(route==='export'&&request.method==='GET'){
      const data=await library.exportBackup(),key=`${config.owner}/exports/${randomUUID()}.json`;
      const upload=await api.request('/storage/v1/object/fitness-private/'+key,{method:'POST',body:JSON.stringify(data),headers:{'Content-Type':'application/json','x-upsert':'false'}});if(!upload.ok)throw new CloudError(503,'The private backup could not be prepared.');
      const signed=await api.json('/storage/v1/object/sign/fitness-private/'+key,{method:'POST',body:{expiresIn:60}});if(!signed.signedURL?.startsWith('/object/sign/'))throw new CloudError(503,'The backup link could not be prepared.');
      response.statusCode=302;response.setHeader('Location',config.url+'/storage/v1'+signed.signedURL+'&download=fitness-library.json');response.end();return;
    }
    throw new CloudError(405,'This action is not available.');
  }catch(error){send(error instanceof CloudError?error.status:500,{error:error instanceof CloudError?error.message:'The private request could not complete. Your saved data is preserved.'});}
}
