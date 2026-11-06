import { readFile,writeFile } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { sha256,md5,buildPublication,publicationSQL,verificationSQL } from '../imports/screenshot-evidence.mjs';

async function verify(){
  const root=resolve(process.argv[2]||'private-data/nrc-2026');
  const manifestBytes=await readFile(join(root,'manifest.json'),'utf8'),manifest=JSON.parse(manifestBytes);
  const saved=JSON.parse(await readFile(join(root,'publication.json'),'utf8'));
  assert.equal(sha256(manifestBytes),saved.manifestHash,'Manifest fingerprint');
  for(const a of saved.tables.raw_assets){
    const bytes=await readFile(join(root,'upload',a.object_key.split('/').at(-1)));
    assert.equal(bytes.length,a.byte_length,'Archive length');assert.equal(sha256(bytes),a.sha256,'Archive SHA256');assert.equal(md5(bytes),a.md5,'Archive MD5');
  }
  const reconstructed=buildPublication(manifest,manifestBytes,saved.owner);
  // The publication attempt timestamp is separate from immutable evidence.
  reconstructed.tables.ingestion_runs[0].completed_at=saved.tables.ingestion_runs[0].completed_at;
  assert.deepEqual(reconstructed,saved,'Manifest reconstructs every publication row');
  const db=new PGlite();let counts;
  try{
    await db.exec(`create role authenticated;create role anon;create schema auth;create schema storage;
      create table public.fitness_owners(owner_id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;
      create table storage.objects(bucket_id text,name text,metadata jsonb);`);
    await db.query('insert into fitness_owners values($1)',[saved.owner]);
    await db.exec(await readFile(new URL('../supabase/migrations/20261106_activity_evidence.sql',import.meta.url),'utf8'));
    for(const a of saved.tables.raw_assets)await db.query('insert into storage.objects values($1,$2,$3)',[a.bucket_id,a.object_key,{size:a.byte_length,eTag:a.md5}]);
    const sql=publicationSQL(reconstructed);assert.equal(sql,await readFile(join(root,'publication.sql'),'utf8'),'Replay SQL matches reconstructed records');
    await db.exec(sql);await db.exec(sql);counts={};
    const exact=(await db.query(verificationSQL(saved))).rows;
    assert.ok(exact.every(row=>row.exact_match&&row.expected_rows===row.stored_rows),'Every stored typed field matches the archive');
    for(const [table,rows]of Object.entries(saved.tables)){
      const expected=new Set(rows.map(r=>JSON.stringify(r))),n=(await db.query(`select count(*)::int as n from public.${table}`)).rows[0].n;
      assert.equal(n,expected.size,'Restored/replayed row count '+table);counts[table]=n;
    }
    const loaded=(await db.query('select id,source_values,field_evidence from activity_sources')).rows;
    for(const row of loaded){const source=saved.tables.activity_sources.find(s=>s.id===row.id);assert.deepEqual(row.source_values,source.source_values);assert.deepEqual(row.field_evidence,source.field_evidence);}
  }finally{await db.close();}
  const report={checkedAt:new Date().toISOString(),manifestSha256:saved.manifestHash,localOriginalHashes:'all-match',isolatedPostgresRestore:'passed',repeatPublication:'no-duplicates',rowCounts:counts,scope:'Local archive and isolated database; live storage verified separately'};
  await writeFile(join(root,'restore-verification.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}
verify().catch(error=>{console.error('Archive verification failed: '+error.message);process.exitCode=1;});
