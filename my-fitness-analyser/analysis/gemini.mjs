import { readFile,writeFile,mkdir,rename } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { createHash,randomUUID } from 'node:crypto';
import { syntheticHistory,trainingDataset,evidencePack } from '../prototypes/training-data.mjs';
import { PROMPT_VERSION,REVIEW_VERSION,reviewSchema,validateReview,SYSTEM_PROMPT } from './contract.mjs';
import {geminiAttempt,structuredGeminiRequest} from '../cloud/gemini-router.mjs';

export async function geminiConfig(){let file={};try{file=parseEnv(await readFile(new URL('../.env',import.meta.url),'utf8'));}catch{}return {key:process.env.GEMINI_API_KEY||file.GEMINI_API_KEY||'',model:process.env.GEMINI_MODEL||file.GEMINI_MODEL||'gemini-3.8-flash',freeTierConfirmed:(process.env.GEMINI_FREE_TIER_CONFIRMED||file.GEMINI_FREE_TIER_CONFIRMED)==='1'};}
export function demoEvidence(){return evidencePack(trainingDataset(syntheticHistory(),{}, {window:'all',anchor:'2026-11-01',synthetic:true}));}
export function buildRequest(pack){
  if(pack.content.dataset!=='synthetic')throw new Error('Personal-data Gemini analysis is disabled.');
  return structuredGeminiRequest({instruction:SYSTEM_PROMPT,input:{evidenceHash:pack.hash,schemaVersion:REVIEW_VERSION,...pack.content},schema:reviewSchema(pack)});
}
export function extractReport(response,pack){
  if(response.status!=='completed'||response.steps?.length!==1||response.steps[0].type!=='model_output'||
   !response.steps[0].content?.length||response.steps[0].content.some(part=>part.type!=='text'))throw new Error('Gemini did not finish a complete review.');
  return validateReview(JSON.parse(response.steps[0].content.map(part=>part.text).join('')),pack);
}
export class GeminiReviews {
  constructor({directory=new URL('../private-data/analysis/',import.meta.url),configReader=geminiConfig,fetcher=fetch}={}){this.directory=directory;this.configReader=configReader;this.fetcher=fetcher;this.inflight=new Map();this.lastAttempt=0;}
  async context(){const config=await this.configReader(),pack=demoEvidence();if(!/^gemini-[a-z0-9.-]+$/.test(config.model))throw new Error('Set a valid Gemini model ID.');const cacheKey=createHash('sha256').update(JSON.stringify([pack.hash,config.model,PROMPT_VERSION,REVIEW_VERSION])).digest('hex');return {config,pack,cacheKey};}
  async cached(context){try{const item=JSON.parse(await readFile(new URL(context.cacheKey+'.json',this.directory),'utf8'));if(item.evidenceHash!==context.pack.hash||item.promptVersion!==PROMPT_VERSION||item.requestedModel!==context.config.model)return null;validateReview(item.report,context.pack);return {...item,cached:true};}catch{return null;}}
  async status(){const context=await this.context();return {configured:Boolean(context.config.key)&&context.config.freeTierConfirmed!==false,model:context.config.model,dataMode:'synthetic-only',schemaVersion:REVIEW_VERSION,review:await this.cached(context),evidence:context.pack.content,evidenceHash:context.pack.hash};}
  async generate(){
    const context=await this.context(),cached=await this.cached(context);if(cached)return cached;
    if(this.inflight.has(context.cacheKey))return this.inflight.get(context.cacheKey);
    if(!context.config.key)throw new Error('Add GEMINI_API_KEY to the local .env file to test the synthetic review.');
    if(Date.now()-this.lastAttempt<60000)throw new Error('Please wait a minute before requesting another review.');
    if(context.config.freeTierConfirmed===false)throw new Error('Confirm the Gemini project uses the Free plan before enabling generation.');
    this.lastAttempt=Date.now();
    const promise=this.request(context).finally(()=>this.inflight.delete(context.cacheKey));this.inflight.set(context.cacheKey,promise);return promise;
  }
  async request({config,pack,cacheKey}){
    const {attempt,report}=await geminiAttempt({entry:{model:config.model,timeout:120000,endpoint:'generateContent'},
     apiKey:config.key,fetcher:this.fetcher,body:buildRequest(pack),validate:result=>extractReport(result,pack)});
    if(!report)throw new Error(attempt.outcome==='quota'?'Gemini quota or rate limit reached. Retry later.':
     attempt.outcome.startsWith('token-')?'Gemini could not verify that the review fits the input limit.':
     'Gemini could not complete the review. The measured data is unchanged.');
    const item={report,requestedModel:config.model,returnedModel:config.model,evidenceHash:pack.hash,promptVersion:PROMPT_VERSION,schemaVersion:REVIEW_VERSION,generatedAt:new Date().toISOString(),dataMode:'synthetic-only',validated:true};
    await mkdir(this.directory,{recursive:true});const temp=new URL(cacheKey+'.'+randomUUID()+'.tmp',this.directory);await writeFile(temp,JSON.stringify(item));await rename(temp,new URL(cacheKey+'.json',this.directory));return {...item,cached:false};
  }
}
