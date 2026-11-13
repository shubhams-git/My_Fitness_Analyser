import test from 'node:test';
import assert from 'node:assert/strict';

test('a journal write reaches the server and invalidates only its own view', async t=>{
  const storage=()=>({getItem(key){return this[key]??null;},setItem(key,value){this[key]=value;},removeItem(key){delete this[key];}});
  t.mock.method(globalThis,'fetch',async (path,options)=>{
    if(options.method==='POST'){
      assert.equal(path,'/api/private?route=weigh-in');
      assert.equal(JSON.parse(options.body).kg,79.5);
      return Response.json({revision:2});
    }
    return Response.json({viewer:{id:'synthetic-owner'},revision:1});
  });
  Object.assign(globalThis,{location:{origin:'http://127.0.0.1'},localStorage:storage(),sessionStorage:storage(),addEventListener(){}});
  const {privateJson,refreshView,viewSnapshot}=await import('../prototypes/session.js');
  const journal='/api/journal?window=90',training='/api/training?window=90';
  await Promise.all([refreshView(journal,'journal'),refreshView(training,'training')]);
  assert.ok(viewSnapshot(journal,'journal'));
  assert.equal(Object.keys(sessionStorage).filter(key=>key.startsWith('mfa-view-v2:journal')).length,1);
  const result=await privateJson('/api/private?route=weigh-in',{method:'POST',body:JSON.stringify({kg:79.5})});
  assert.equal(result.revision,2);
  assert.equal(viewSnapshot(journal,'journal'),undefined);
  assert.ok(viewSnapshot(training,'training'));
  assert.equal(fetch.mock.callCount(),3);
});
