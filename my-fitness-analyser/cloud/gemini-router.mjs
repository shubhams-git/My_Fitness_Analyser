import {createHash} from 'node:crypto';
import {CloudError} from './supabase.mjs';
export const MODEL_POLICY='flash-routes-v2';
export const PRIMARY_GEMINI_MODEL=Object.freeze({
 model:'gemini-3.6-flash',timeout:120000,endpoint:'generateContent'
});
// Sequential requests only; reservation rotates credentials before every call.
export const ANALYSIS_ROUTE=Object.freeze([
 PRIMARY_GEMINI_MODEL,
 Object.freeze({...PRIMARY_GEMINI_MODEL,timeout:70000}),
 Object.freeze({model:'gemini-3-flash-preview',timeout:55000,endpoint:'generateContent'}),
 Object.freeze({model:'gemini-3.1-flash-lite',timeout:40000,endpoint:'generateContent'})
]);

export function structuredGeminiRequest({instruction,input,schema}){
 return {
  systemInstruction:{parts:[{text:instruction+'\n\nReturn a JSON object matching this schema:\n'+JSON.stringify(schema)}]},
  contents:[{parts:[{text:JSON.stringify(input)}]}],
  generationConfig:{responseMimeType:'application/json'}
 };
}

const intensive=new Set(['run-coaching','weight-coaching','goal-analysis','zone-analysis']);
const basic=new Set(['summary-format','activity-label','import-field-normalization']);
export function modelRoute(task){
 if(task==='run-coaching')return [
  {model:'gemini-3.8-flash',thinking:'high',timeout:50000},
  {model:'gemini-3.6-flash',thinking:'high',timeout:55000},
  {model:'gemini-3.1-flash-lite',thinking:'medium',timeout:40000}
 ];
 if(intensive.has(task))return [{model:'gemini-3.6-flash',thinking:'high',timeout:75000},{model:'gemini-3.8-flash',thinking:null,timeout:65000},{model:'gemini-3.1-flash-lite',thinking:null,timeout:40000}];
 if(basic.has(task))return [{model:'gemini-3.8-flash',thinking:'low',timeout:25000},{model:'gemini-3.6-flash',thinking:'low',timeout:25000},{model:'gemini-3.5-flash-lite',thinking:'low',timeout:20000},{model:'gemini-3.1-flash-lite',thinking:null,timeout:20000}];
 throw new CloudError(400,'Unsupported intelligence task.');
}
export function generationConfig(model,thinking='high',maxOutput=16384){return {max_output_tokens:maxOutput,...(thinking?{thinking_level:thinking}:{})};}
export function geminiKeys(env){const names=['GEMINI_API_KEY',...(env.GEMINI_KEY_POOL_FREE_CONFIRMED==='1'?Array.from({length:4},(_,i)=>'GEMINI_API_KEY_'+(i+2)):[])];return [...new Set(names.map(n=>env[n]?.trim()).filter(Boolean))];}
export function personalGeminiKeys(env){
 if(env.GEMINI_PERSONAL_DATA_APPROVED!=='1')return [];
 const syntheticKeys=new Set(['GEMINI_API_KEY','GEMINI_API_KEY_2','GEMINI_API_KEY_3','GEMINI_API_KEY_4','GEMINI_API_KEY_5']
  .map(name=>env[name]?.trim()).filter(Boolean));
 return [...new Set(['GEMINI_PERSONAL_API_KEY','GEMINI_PERSONAL_API_KEY_2','GEMINI_PERSONAL_API_KEY_3','GEMINI_PERSONAL_API_KEY_4','GEMINI_PERSONAL_API_KEY_5']
  .map(name=>env[name]?.trim()).filter(key=>key&&!syntheticKeys.has(key)))];
}
export const geminiKeyIds=keys=>keys.map(key=>createHash('sha256').update('gemini-key-slot:'+key).digest('hex'));
export function sharedGeminiKey(api,task,reviewId,keys){
 const keyIds=geminiKeyIds(keys);
 return async()=>{
  let slot;
  try{
   slot=await api.json('/rest/v1/rpc/reserve_gemini_key_slot',{method:'POST',body:{review_kind:task,review_id:reviewId,key_ids:keyIds}});
  }catch{
   throw new CloudError(503,'Gemini key rotation is unavailable. Try again later.');
  }
  if(!Number.isInteger(slot)||!keys[slot-1])throw new CloudError(503,'Gemini key rotation is unavailable. Try again later.');
  return keys[slot-1];
 };
}

function retryDelay(response,error){
 const header=response.headers.get('retry-after'),retryInfo=error?.details?.find?.(detail=>typeof detail?.retryDelay==='string')?.retryDelay;
 const values=[header&&(/^\d+$/.test(header)?Number(header):(Date.parse(header)-Date.now())/1000),retryInfo&&/^\d+(?:\.\d+)?s$/.test(retryInfo)&&Number(retryInfo.slice(0,-1))];
 const dayLimit=error?.details?.some?.(detail=>detail?.violations?.some?.(violation=>/perday|daily/i.test((violation.quotaId||'')+' '+(violation.quotaMetric||''))));
 if(dayLimit)values.push(86400);
 return Math.ceil(Math.min(86400,Math.max(65,...values.filter(Number.isFinite))));
}

async function boundedJson(response){
 let size=0;const chunks=[];
 for await(const chunk of response.body||[]){size+=chunk.length;if(size>256000)throw new Error('response too large');chunks.push(chunk);}
 return JSON.parse(Buffer.concat(chunks).toString());
}

export const MAX_GEMINI_INPUT_TOKENS=500000;
export const GEMINI_PREFLIGHT_MS=12000;
const geminiBase='https://generativelanguage.googleapis.com/v1beta/models/';
const textParts=value=>Array.isArray(value?.parts)&&value.parts.length>0&&value.parts.every(part=>
 part&&Object.keys(part).length===1&&typeof part.text==='string');
function countableBody(body){
 return body&&Object.keys(body).length===3&&textParts(body.systemInstruction)&&Array.isArray(body.contents)&&
  body.contents.length>0&&body.contents.every(textParts)&&Object.keys(body.generationConfig||{}).length===1&&
  body.generationConfig.responseMimeType==='application/json'&&
  [body.systemInstruction,...body.contents].every(content=>Object.keys(content).length===1);
}

export async function geminiAttempt({entry,apiKey,body,validate,candidates,beforeInput=async()=>true,fetcher=fetch,clock=Date.now,deadline=Infinity}){
 const start=clock(),attempt={model:entry.model,thinking:entry.thinking||'default',outcome:'token-count-unavailable',httpStatus:null,elapsedMs:0};
 const done=(report=null,retrySeconds=0)=>{attempt.elapsedMs=Math.max(0,clock()-start);return {attempt,report,retrySeconds};};
 if(!/^gemini-[a-z0-9.-]+$/.test(entry.model)||entry.endpoint!=='generateContent'||clock()>=deadline)return done();
 const url=geminiBase+entry.model;
 const headers={'Content-Type':'application/json','x-goog-api-key':apiKey};
 const preflight=AbortSignal.timeout(Math.max(1,Math.min(GEMINI_PREFLIGHT_MS,deadline-clock())));
 let limit;
 try{
  const response=await fetcher(url,{redirect:'error',signal:preflight,headers});
  if(!response.ok){await response.body?.cancel().catch(()=>{});return done();}
  const model=await boundedJson(response);
  if(model.name!=='models/'+entry.model||!Number.isSafeInteger(model.inputTokenLimit)||model.inputTokenLimit<=0||
   !['countTokens','generateContent'].every(method=>model.supportedGenerationMethods?.includes(method)))return done();
  limit=Math.min(MAX_GEMINI_INPUT_TOKENS,model.inputTokenLimit);
 }catch{return done();}
 let serialized,selected;
 for(const [index,candidate] of [...(candidates||[{body,validate}])].slice(0,4).entries()){
  if(preflight.aborted)return done();
  if(!await beforeInput()){attempt.outcome='consent-changed';return done();}
  attempt.outcome='token-count-unavailable';
  try{
   const snapshot=JSON.stringify(candidate.body),payload=JSON.parse(snapshot);
   if(!countableBody(payload))return done();
   const response=await fetcher(url+':countTokens',{method:'POST',redirect:'error',signal:preflight,headers,
    body:JSON.stringify({generateContentRequest:{model:'models/'+entry.model,...payload}})});
   if(!response.ok){await response.body?.cancel().catch(()=>{});return done();}
   const {totalTokens}=await boundedJson(response);
   if(!Number.isSafeInteger(totalTokens)||totalTokens<=0)return done();
   if(totalTokens>limit){attempt.outcome='token-limit';continue;}
   serialized=snapshot;selected=candidate;
   attempt.countedInputTokens=totalTokens;
   attempt.evidenceReduction=candidate.reduction??index;
   break;
  }catch{return done();}
 }
 if(!selected)return done();
 if(!await beforeInput()){attempt.outcome='consent-changed';return done();}
 const remaining=deadline-clock();
 if(remaining<=0){attempt.outcome='timeout';return done();}
 const signal=AbortSignal.timeout(Math.min(entry.timeout,remaining));
 attempt.outcome='network';
 let report=null,retrySeconds=0;
 try{
  const response=await fetcher(url+':generateContent',{method:'POST',redirect:'error',signal,headers,body:serialized});
  attempt.httpStatus=response.status;
  if(!response.ok){
   attempt.outcome=response.status===429?'quota':[401,403].includes(response.status)?'key':response.status>=500?'unavailable':'request';
   if([400,429].includes(response.status)){
    const error=(await boundedJson(response).catch(()=>null))?.error;
    if(response.status===429)retrySeconds=retryDelay(response,error);
    if(response.status===400&&error?.details?.some?.(detail=>detail?.reason==='API_KEY_INVALID'))attempt.outcome='key';
   }else await response.body?.cancel().catch(()=>{});
  }else{
   attempt.outcome='invalid';
   const raw=await boundedJson(response);
   const json=normalizeGeneratedContent(raw);
   for(const [source,target] of Object.entries({total_input_tokens:'inputTokens',total_output_tokens:'outputTokens',total_thought_tokens:'thoughtTokens'})){
    if(Number.isSafeInteger(json?.usage?.[source])&&json.usage[source]>=0)attempt[target]=json.usage[source];
   }
   if(json?.status==='incomplete')attempt.outcome='incomplete';
   else if(attempt.inputTokens>limit)attempt.outcome='token-limit';
   else{report=selected.validate(json);attempt.outcome='complete';}
  }
 }catch(error){if(signal.aborted||error?.name==='TimeoutError')attempt.outcome='timeout';}
 return done(report,retrySeconds);
}

function normalizeGeneratedContent(result){
 const candidate=result.candidates?.[0],usage=result.usageMetadata;
 return {
  status:candidate?.finishReason==='STOP'?'completed':'incomplete',
  steps:[{type:'model_output',content:(candidate?.content?.parts||[])
   .filter(part=>!part.thought&&typeof part.text==='string').map(part=>({type:'text',text:part.text}))}],
  usage:{total_input_tokens:usage?.promptTokenCount,total_output_tokens:usage?.candidatesTokenCount,total_thought_tokens:usage?.thoughtsTokenCount}
 };
}
let lastLocalKey;
export async function routedGemini({task,keys,request,validate,reserveKey,beforeAttempt=async()=>{},fetcher=fetch,totalMs=210000,clock=Date.now}){
 keys=[...new Set(keys||[])];
 if(keys.length<2)throw new CloudError(503,'Gemini needs at least two distinct approved keys for rotation.');
 const nextKey=reserveKey||(()=>{
  lastLocalKey=keys[(keys.indexOf(lastLocalKey)+1)%keys.length];
  return lastLocalKey;
 });
 const attempts=[],deadline=clock()+totalMs;let lastStatus=503;
 const route=modelRoute(task);
 const attemptLimit=task==='weight-coaching'?4:7;
 for(const [modelIndex,entry] of route.entries()){
  for(let keyOffset=0;keyOffset<keys.length;keyOffset++){
  // Reserve one attempt for each remaining model.
  if(clock()>=deadline||attempts.length>=attemptLimit-(route.length-modelIndex-1))break;
  // Consent and evidence are checked outside the provider-failure catch. They
  // are authorization boundaries, not reasons to try a different model.
  await beforeAttempt(entry);
  if(clock()>=deadline)break;
  const body=request(entry),apiKey=await nextKey();
  if(!keys.includes(apiKey))throw new CloudError(503,'Gemini key rotation returned an invalid slot.');
  const {attempt,report}=await geminiAttempt({entry:{...entry,thinking:undefined,endpoint:'generateContent'},apiKey,body,deadline,clock,fetcher,
   beforeInput:async()=>{await beforeAttempt(entry);return true;},validate:json=>validate(json,entry)});
  attempts.push(attempt);
  if(attempt.outcome==='complete')return {report,model:entry.model,attempts,policy:MODEL_POLICY};
  lastStatus=attempt.httpStatus===429?429:attempt.outcome==='invalid'?502:503;
  if(!['quota','key'].includes(attempt.outcome))break;
  }
 }
 const error=new CloudError(lastStatus===429?429:lastStatus===502?502:503,'Gemini could not finish this insight after its available model fallbacks. Your saved records are intact.');
 error.attempts=attempts;
 throw error;
}
