// Offline only: review input -> portable, hash-verified originals + SQL.
// Administrative execution/upload is separate; never accepts public requests.
import { readFile,mkdir,writeFile,copyFile } from 'node:fs/promises';
import { resolve,relative,basename,join,sep } from 'node:path';
import { buildManifest,buildPublication,publicationSQL,verificationSQL,sha256,md5,validateReview } from '../imports/screenshot-evidence.mjs';

try{process.loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}
const [inputArg,outputArg]=process.argv.slice(2);
if(!inputArg||!outputArg)throw new Error('Usage: node scripts/prepare-screenshot-import.mjs private-data/review.json private-data/import-name');
const privateRoot=resolve('private-data'),inputPath=resolve(inputArg),output=resolve(outputArg);
for(const path of [inputPath,output])if(!relative(privateRoot,path)||relative(privateRoot,path).startsWith('..'+sep)||relative(privateRoot,path)==='..')throw new Error('Use a child of ignored private-data for input/output');
const input=validateReview(JSON.parse(await readFile(inputPath,'utf8')));
await mkdir(join(output,'upload'),{recursive:true});
const assets=[];
for(const [index,file]of input.files.entries()){
  const bytes=await readFile(file.path),hash=sha256(bytes),extension='jpg';
  if(bytes[0]!==0xff||bytes[1]!==0xd8||bytes[2]!==0xff)throw new Error('Expected original JPEG screenshot');
  const destination=join(output,'upload',hash+'.'+extension);
  try{const existing=await readFile(destination);if(sha256(existing)!==hash)throw new Error('Existing archive object has changed');}catch(error){if(error.code!=='ENOENT')throw error;await copyFile(file.path,destination);}
  if(sha256(await readFile(destination))!==hash)throw new Error('Copied original checksum mismatch');
  assets.push({index,group:file.group,originalName:file.group+'/'+basename(file.path),sha256:hash,md5:md5(bytes),bytes:bytes.length,mediaType:'image/jpeg',extension});
}
const manifest=buildManifest(input,assets),manifestBytes=JSON.stringify(manifest,null,2)+'\n';
const publication=buildPublication(manifest,manifestBytes,process.env.FITNESS_OWNER_ID||'');
await writeFile(join(output,'manifest.json'),manifestBytes);
await writeFile(join(output,'upload',publication.manifestHash+'.json'),manifestBytes);
await writeFile(join(output,'publication.json'),JSON.stringify(publication,null,2)+'\n');
await writeFile(join(output,'publication.sql'),publicationSQL(publication));
await writeFile(join(output,'verification.sql'),verificationSQL(publication));
const report={schemaVersion:1,stage:'prepared-not-yet-uploaded',adapter:manifest.adapterVersion,manifestHash:publication.manifestHash,
  runs:manifest.runs.length,detailedRuns:manifest.runs.filter(r=>r.summary!=null).length,overviewOnlyRuns:manifest.runs.filter(r=>r.summary==null).map(r=>r.key),
  splits:publication.tables.activity_segments.length,originalImages:assets.length,archiveObjects:publication.tables.raw_assets.length,
  archiveBytes:publication.tables.raw_assets.reduce((sum,a)=>sum+a.byte_length,0),reconciliation:manifest.reconciliation,
  anomalies:manifest.runs.filter(r=>r.issues.length).map(r=>({key:r.key,issues:r.issues})),
  coverage:{heartRate:false,gpsStream:false,continuousPace:false},
  next:'Upload upload/* to fitness-private/<FITNESS_OWNER_ID>/evidence, then execute the reviewed publication.sql. Its transaction verifies every object size and ETag before publishing.'};
await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({stage:report.stage,runs:report.runs,splits:report.splits,images:report.originalImages,archiveBytes:report.archiveBytes,output},null,2));
