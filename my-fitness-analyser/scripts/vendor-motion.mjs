import { mkdir, readFile, writeFile } from 'node:fs/promises';
const dest=new URL('../prototypes/assets/vendor/',import.meta.url);
await mkdir(dest,{recursive:true});
for(const name of ['gsap.min.js','ScrollTrigger.min.js']){
  const source=await readFile(new URL('../node_modules/gsap/dist/'+name,import.meta.url),'utf8');
  // Normalize trailing whitespace while retaining the upstream code and notices.
  await writeFile(new URL(name,dest),source.split(/\r?\n/).map(line=>line.trimEnd()).join('\n').trimEnd()+'\n');
}
const readme=await readFile(new URL('../node_modules/gsap/README.md',import.meta.url),'utf8');
await writeFile(new URL('GSAP-NOTICE.txt',dest),'GSAP 3.15.1. The original library headers retain their copyright and licence notices.\nLicence: https://gsap.com/community/standard-license/\n\n'+readme.split(/\r?\n/).map(line=>line.trimEnd()).join('\n').trimEnd()+'\n');
console.log('Copied pinned GSAP core, ScrollTrigger and licence for same-origin delivery.');
