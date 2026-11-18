import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { finishAuth,register,startOAuth } from '../cloud/auth.mjs';
import { GarminCredentials,openGarminKey,sealGarminKey } from '../cloud/garmin-credentials.mjs';
import { privateHandler } from '../cloud/handler.mjs';

const first='11111111-1111-4111-8111-111111111111',second='22222222-2222-4222-8222-222222222222',outsider='33333333-3333-4333-8333-333333333333';
const config={url:'https://example.supabase.co',origin:'https://fitness.test',key:'publishable',owner:first,memberAccounts:true};
const masterKey='bd'.repeat(32),garminKey='synthetic-personal-key';
const goodOrigin={headers:{origin:config.origin}};
const response=()=>({headers:{},setHeader(key,value){this.headers[key]=value;},end(value){this.body=value;}});
const cookiePair=out=>out.headers['Set-Cookie'].split(';')[0];
const migration=new URL('../supabase/migrations/20261119130000_private_member_onboarding.sql',import.meta.url);

test('OAuth uses same-origin POST and a browser-bound PKCE callback for all three providers',async()=>{
  assert.throws(()=>startOAuth({headers:{origin:'https://other.test'}},response(),config,'google'),{status:403});
  assert.throws(()=>startOAuth(goodOrigin,response(),config,'other'),{status:400});
  for(const provider of ['google','facebook','github']){
    const start=response(),authorizeUrl=new URL(startOAuth(goodOrigin,start,config,provider));
    const cookie=cookiePair(start),verifier=cookie.split('=')[1];
    assert.equal(authorizeUrl.origin,config.url);
    assert.equal(authorizeUrl.searchParams.get('provider'),provider);
    assert.equal(authorizeUrl.searchParams.get('redirect_to'),config.origin+'/api/auth/callback');
    assert.equal(authorizeUrl.searchParams.get('code_challenge'),createHash('sha256').update(verifier).digest('base64url'));
    assert.match(start.headers['Set-Cookie'],/Path=\/api\/auth\/callback; HttpOnly; Secure; SameSite=Lax/);
    const out=response(),callback={url:'/api/auth/callback?code=provider-code',headers:{cookie}};
    const calls=[];
    const fetcher=async(url,options)=>{
      calls.push(url);
      if(url.endsWith('grant_type=pkce')){
        assert.deepEqual(JSON.parse(options.body),{auth_code:'provider-code',code_verifier:verifier});
        return Response.json({access_token:'access',refresh_token:'refresh'});
      }
      if(url.endsWith('/user'))return Response.json({id:second,email:'second@example.test'});
      if(url.endsWith('claim_fitness_member_invite'))return Response.json(true);
      return Response.json([]);
    };
    assert.equal(await finishAuth({...callback,headers:{}},response(),config,{fetcher}),'/sign-in?auth=retry');
    assert.equal(calls.length,0);
    assert.equal(await finishAuth(callback,out,config,{fetcher}),'/sign-in?auth=complete');
    assert.ok(out.headers['Set-Cookie'].some(value=>value.startsWith('fitness_access=access;')));
    assert.match(out.headers['Set-Cookie'].at(-1),/Max-Age=0$/);
    const rejected=response(),deny=async(url,options)=>url.endsWith('claim_fitness_member_invite')?Response.json(false):fetcher(url,options);
    assert.equal(await finishAuth(callback,rejected,config,{fetcher:deny}),'/sign-in?auth=invite');
    assert.match(rejected.headers['Set-Cookie'],/^fitness_pkce=;/);
  }
});

test('password signup sends a PKCE challenge and waits for email confirmation',async()=>{
  const out=response();
  await register(goodOrigin,out,config,{email:' second@example.test ',password:'synthetic password'},{
    fetcher:async(url,{body})=>{
      const parsed=new URL(url),value=JSON.parse(body);
      assert.equal(parsed.pathname,'/auth/v1/signup');
      assert.equal(parsed.searchParams.get('redirect_to'),config.origin+'/api/auth/callback');
      assert.equal(value.email,'second@example.test');
      assert.equal(value.code_challenge_method,'s256');
      assert.match(value.code_challenge,/^[\w-]{43}$/);
      return Response.json({id:second});
    }
  });
  assert.match(out.headers['Set-Cookie'],/^fitness_pkce=/);
});

test('Garmin keys are verified before save and ciphertext cannot be moved between users',async()=>{
  let saved;
  const api={config:{owner:second},request:async(path,options)=>{
    assert.match(path,/fitness_garmin_credentials\?on_conflict=owner_id$/);
    saved=options.body;
    return new Response(null,{status:201});
  }};
  const credentials=new GarminCredentials(api,masterKey);
  await assert.rejects(credentials.save(garminKey,{clientFactory:()=>({authenticate(){throw Object.assign(new Error(),{status:401});}})}),{status:400});
  assert.equal(saved,undefined);
  await credentials.save(garminKey,{clientFactory:key=>({authenticate(){assert.equal(key,garminKey);}})});
  assert.equal(saved.owner_id,second);
  assert.ok(!JSON.stringify(saved).includes(garminKey));
  assert.equal(openGarminKey(saved.envelope,second,masterKey),garminKey);
  assert.throws(()=>openGarminKey(saved.envelope,first,masterKey),{status:503});
  assert.throws(()=>openGarminKey(saved.envelope,second,'ad'.repeat(32)),{status:503});
  assert.notEqual(saved.envelope,sealGarminKey(garminKey,second,masterKey));
});

test('live-mode onboarding and sync only look up the authenticated member credential',async t=>{
  const reads=[],providerRequests=[],owner=second;
  let stored=[];
  const api={config:{...config,owner},user:{id:owner},json:async(path)=>{
    reads.push(path);
    if(path.includes('fitness_garmin_credentials'))return stored;
    if(path.endsWith('claim_fitness_sync'))return 'lease';
    return [];
  }};
  const dependencies={env:{VERCEL:'1',GARMIN_PERSONAL_API_KEY:'legacy',GARMIN_CREDENTIAL_ENCRYPTION_KEY:masterKey},
    configReader:()=>config,auth:async()=>api,libraryFactory:()=>({mutate:async update=>update({})})};
  const run=async(route,method='GET')=>{
    const out=response();
    await privateHandler({method,url:'/api/'+route,headers:{origin:config.origin}},out,route,dependencies);
    return out;
  };
  assert.equal((await run('training')).statusCode,428);
  assert.equal((await run('sync','POST')).statusCode,409);
  assert.ok(reads.every(path=>path.includes('owner_id=eq.'+second)));
  stored=[{envelope:sealGarminKey(garminKey,second,masterKey)}];
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    providerRequests.push(url);
    if(url.endsWith('/token')){
      assert.equal(options.headers.Authorization,'ApiKey '+garminKey);
      return new Response('synthetic.access.token');
    }
    assert.equal(options.headers.Authorization,'Bearer synthetic.access.token');
    return url.includes('/activitylist-service/')?Response.json([]):new Response(null,{status:404});
  });
  const synced=await run('sync','POST');
  assert.equal(synced.statusCode,200);
  assert.equal(JSON.parse(synced.body).complete,true);
  assert.ok(!synced.body.includes(garminKey));
  assert.ok(providerRequests.every(url=>url.startsWith('https://personal.connectapi.garmin.com/')));
  assert.equal(reads.at(-1),'/rest/v1/rpc/release_fitness_sync');
});

test('database claims only verified invited emails and isolates encrypted credentials by member',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create role authenticated; create role anon; create role supabase_auth_admin;
      create schema auth; grant usage on schema auth to authenticated;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$select current_setting('request.jwt.claim.sub',true)::uuid$$;
      create table public.fitness_owners(owner_id uuid primary key references auth.users(id));
      insert into auth.users values ('${first}','owner@example.test',now()),('${second}','Second@example.test',null),('${outsider}','other@example.test',now());
      insert into public.fitness_owners values ('${first}');`);
    await db.exec(await readFile(migration,'utf8'));
    await db.exec("insert into fitness_member_invites(email) values ('second@example.test')");
    await db.exec('set role supabase_auth_admin');
    const hook=async email=>(await db.query('select check_fitness_member_invite($1) as result',[{user:{email}}])).rows[0].result;
    assert.deepEqual(await hook('Second@example.test'),{});
    assert.equal((await hook('other@example.test')).error.http_code,403);
    await db.exec('reset role; set role anon');
    await assert.rejects(db.query('select claim_fitness_member_invite()'),{code:'42501'});
    await db.exec('reset role; set role authenticated');
    const member=async id=>{
      await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
      return (await db.query('select claim_fitness_member_invite() as claimed')).rows[0].claimed;
    };
    assert.equal(await member(second),false);
    assert.equal(await member(outsider),false);
    await db.exec(`reset role; update auth.users set email_confirmed_at=now() where id='${second}'; set role authenticated`);
    assert.equal(await member(second),true);
    assert.equal(await member(second),true);
    await assert.rejects(db.query('select * from fitness_member_invites'),{code:'42501'});
    const insert=(owner,key)=>db.query('insert into fitness_garmin_credentials(owner_id,envelope) values ($1,$2)',[owner,sealGarminKey(key,owner,masterKey)]);
    await insert(second,garminKey);
    await assert.rejects(insert(first,garminKey),{code:'42501'});
    assert.equal(await member(first),true);
    assert.equal((await db.query('select * from fitness_garmin_credentials')).rows.length,0);
    await insert(first,'synthetic-owner-key');
    assert.deepEqual((await db.query('select owner_id from fitness_garmin_credentials')).rows,[{owner_id:first}]);
  }finally{await db.close();}
});
