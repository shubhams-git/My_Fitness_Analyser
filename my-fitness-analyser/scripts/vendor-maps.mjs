import { mkdir,readFile,writeFile } from 'node:fs/promises';
const dest=new URL('../prototypes/assets/vendor/',import.meta.url);
await mkdir(dest,{recursive:true});
for(const name of ['maplibre-gl.mjs','maplibre-gl-worker.mjs','maplibre-gl.css']){
  const source=await readFile(new URL('../node_modules/maplibre-gl/dist/'+name,import.meta.url),'utf8');
  await writeFile(new URL(name,dest),source.replace(/\/\/# sourceMappingURL=.*$/gm,'').trimEnd()+'\n');
}
await writeFile(new URL('MAPLIBRE-LICENSE.txt',dest),'MapLibre GL JS 6.16.0\n\n'+await readFile(new URL('../node_modules/maplibre-gl/LICENSE.txt',import.meta.url),'utf8'));
console.log('Vendored pinned MapLibre ES module, same-origin worker, CSS and BSD licence.');
