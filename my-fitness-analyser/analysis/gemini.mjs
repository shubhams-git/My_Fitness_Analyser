import { readFile,writeFile,mkdir,rename } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { createHash,randomUUID } from 'node:crypto';
import { syntheticHistory,trainingDataset,evidencePack } from '../prototypes/training-data.mjs';
import { TOOL_NAME,PROMPT_VERSION,REVIEW_VERSION,reviewSchema,validateReview,SYSTEM_PROMPT } from './contract.mjs';

export async function geminiConfig(){let file={};try{file=parseEnv(await readFile(new URL('../.env',import.meta.url),'utf8'));}catch{}return {key:process.env.GEMINI_API_KEY||file.GEMINI_API_KEY||'',model:process.env.GEMINI_MODEL||file.GEMINI_MODEL||'gemini-3.6-flash'};}
export function demoEvidence(){return evidencePack(trainingDataset(syntheticHistory(),{}, {window:'all',anchor:'2026-11-01',synthetic:true}));}
export function buildRequest(pack,model){
  if(pack.content.dataset!=='synthetic')throw new Error('Personal-data Gemini analysis is disabled.');
  return {model,store:false,system_instruction:SYSTEM_PROMPT,input:JSON.stringify({evidenceHash:pack.hash,schemaVersion:REVIEW_VERSION,...pack.content}),tools:[{type:'function',name:TOOL_NAME,description:'Publish an evidence-linked training review for application validation. This function does not write to a database or change measurements.',parameters:reviewSchema(pack)}],generation_config:{max_output_tokens:4096,thinking_level:'medium',tool_choice:{allowed_tools:{mode:'any',tools:[TOOL_NAME]}}}};
}
export function extractReport(response,pack){
  if(!['completed','requires_action'].includes(response.status))throw new Error('Gemini did not finish a complete review.');
  const calls=response.steps?.filter(s=>s.type==='function_call')||[];
  if(calls.length!==1||calls[0].name!==TOOL_NAME||!calls[0].arguments||typeof calls[0].arguments!=='object')throw new Error('Gemini did not return the required review tool call.');
  return validateReview(calls[0].arguments,pack);
}
export class GeminiReviews {
  constructor({directory=new URL('../private-data/analysis/',import.meta.url),configReader=geminiConfig,fetcher=fetch}={}){this.directory=directory;this.configReader=configReader;this.fetcher=fetcher;this.inflight=new Map();this.lastAttempt=0;}
  async context(){const config=await this.configReader(),pack=demoEvidence();if(!/^gemini-[a-z0-9.-]+$/.test(config.model))throw new Error('Set a valid Gemini model ID.');const cacheKey=createHash('sha256').update(JSON.stringify([pack.hash,config.model,PROMPT_VERSION,REVIEW_VERSION])).digest('hex');return {config,pack,cacheKey};}
  async cached(context){try{const item=JSON.parse(await readFile(new URL(context.cacheKey+'.json',this.directory),'utf8'));if(item.evidenceHash!==context.pack.hash||item.promptVersion!==PROMPT_VERSION||item.requestedModel!==context.config.model)return null;validateReview(item.report,context.pack);return {...item,cached:true};}catch{return null;}}
  async status(){const context=await this.context();return {configured:Boolean(context.config.key),model:context.config.model,dataMode:'synthetic-only',schemaVersion:REVIEW_VERSION,review:await this.cached(context),evidence:context.pack.content,evidenceHash:context.pack.hash};}
  async generate(){
    const context=await this.context(),cached=await this.cached(context);if(cached)return cached;
    if(this.inflight.has(context.cacheKey))return this.inflight.get(context.cacheKey);
    if(!context.config.key)throw new Error('Add GEMINI_API_KEY to the local .env file to test the synthetic review.');
    if(Date.now()-this.lastAttempt<60000)throw new Error('Please wait a minute before requesting another review.');
    this.lastAttempt=Date.now();
    const promise=this.request(context).finally(()=>this.inflight.delete(context.cacheKey));this.inflight.set(context.cacheKey,promise);return promise;
  }
  async request({config,pack,cacheKey}){
    let response;try{response=await this.fetcher('https://generativelanguage.googleapis.com/v1beta/interactions',{method:'POST',redirect:'error',signal:AbortSignal.timeout(90000),headers:{'Content-Type':'application/json','x-goog-api-key':config.key},body:JSON.stringify(buildRequest(pack,config.model))});}catch{throw new Error('Gemini could not be reached. The measured data is unchanged.');}
    if(!response.ok)throw new Error(response.status===401||response.status===403?'Gemini access was denied. Check the server API key.':response.status===429?'Gemini quota or rate limit reached. Retry later.':`Gemini request failed (HTTP ${response.status}). Check the configured model and API access.`);
    let bytes=0;const parts=[];for await(const chunk of response.body){bytes+=chunk.length;if(bytes>256000)throw new Error('Gemini response exceeded the review size limit.');parts.push(chunk);}
    let result;try{result=JSON.parse(Buffer.concat(parts).toString());}catch{throw new Error('Gemini returned an unreadable response.');}
    const report=extractReport(result,pack),item={report,requestedModel:config.model,returnedModel:typeof result.model==='string'?result.model:config.model,evidenceHash:pack.hash,promptVersion:PROMPT_VERSION,schemaVersion:REVIEW_VERSION,generatedAt:new Date().toISOString(),dataMode:'synthetic-only',validated:true};
    await mkdir(this.directory,{recursive:true});const temp=new URL(cacheKey+'.'+randomUUID()+'.tmp',this.directory);await writeFile(temp,JSON.stringify(item));await rename(temp,new URL(cacheKey+'.json',this.directory));return {...item,cached:false};
  }
}
