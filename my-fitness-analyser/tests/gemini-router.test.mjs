import test from 'node:test';import assert from 'node:assert/strict';
import {routedGemini,modelRoute,geminiKeys,generationConfig} from '../cloud/gemini-router.mjs';
test('free-confirmed pool deduplicates keys and rotates on every attempted request',async()=>{
 const env={GEMINI_API_KEY:'a',GEMINI_API_KEY_2:'b',GEMINI_API_KEY_3:'a',GEMINI_API_KEY_4:'c'};
 assert.deepEqual(geminiKeys(env),['a']);env.GEMINI_KEY_POOL_FREE_CONFIRMED='1';const keys=geminiKeys(env),used=[],requests=[];
 const result=await routedGemini({task:'run-coaching',keys,request:e=>({model:e.model,generation_config:generationConfig(e.model,e.thinking)}),validate:j=>j,fetcher:async(_,o)=>{used.push(o.headers['x-goog-api-key']);requests.push(JSON.parse(o.body));return used.length<3?new Response('private',{status:503}):Response.json({ok:true});}});
 assert.equal(new Set(used).size,3);assert.deepEqual(requests.map(r=>r.generation_config.thinking_level),['high','high','medium']);assert.equal(result.model,'gemini-3.1-flash-lite');assert.ok(!JSON.stringify(result.attempts).includes('x-goog-api-key'));
 assert.deepEqual(modelRoute('summary-format').map(e=>e.model),['gemini-3.8-flash','gemini-3.6-flash','gemini-3.5-flash-lite','gemini-3.1-flash-lite']);
});
test('invalid structured output falls back; revoked sharing stops before another transmission',async()=>{
 let calls=0;await assert.rejects(routedGemini({task:'weight-coaching',keys:['a','b'],request:e=>e,validate:()=>{throw Error('invalid');},beforeAttempt:()=>{if(calls)throw Error('revoked');},fetcher:async()=>{calls++;return Response.json({});}}),/revoked/);assert.equal(calls,1);
});
test('quota and credential errors try the whole pool before dropping the primary model',async()=>{
 const used=[];
 const result=await routedGemini({task:'run-coaching',keys:['a','b','c','d','e'],request:entry=>entry,validate:json=>json,
  fetcher:async(_,options)=>{
   used.push(options.headers['x-goog-api-key']);
   return used.length<5?new Response(null,{status:used.length===1?403:429}):Response.json({ok:true});
  }});
 assert.equal(new Set(used).size,5);
 assert.ok(result.attempts.every(attempt=>attempt.model==='gemini-3.6-flash'));
});
