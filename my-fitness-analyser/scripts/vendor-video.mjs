import { copyFile,readFile,writeFile } from 'node:fs/promises';

const source=new URL('../node_modules/mediabunny/',import.meta.url);
const dest=new URL('../prototypes/assets/vendor/',import.meta.url);
const {version}=JSON.parse(await readFile(new URL('package.json',source),'utf8'));
await copyFile(new URL('dist/bundles/mediabunny.min.mjs',source),new URL('mediabunny.min.mjs',dest));
await writeFile(new URL('MEDIABUNNY-LICENSE.txt',dest),
  `Mediabunny ${version}\nSource: https://github.com/Vanilagy/mediabunny/tree/v${version}\n\n`+
  await readFile(new URL('LICENSE',source),'utf8'));
