import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export function renderTokens(tokens) {
  const base = [
    `  --font-body: ${tokens.fontFamily};`,
    ...(tokens.fontFamilyDisplay ? [`  --font-display: ${tokens.fontFamilyDisplay};`] : []),
    ...(tokens.fontFamilyEditorial ? [`  --font-editorial: ${tokens.fontFamilyEditorial};`] : []),
    `  --target-min: ${tokens.minTargetPx}px;`,
    ...Object.entries(tokens.fontSize).map(([k, v]) => `  --type-${k}: ${v}px;`),
    ...Object.entries(tokens.space).map(([k, v]) => `  --space-${k}: ${v}px;`),
    ...Object.entries(tokens.radius).map(([k, v]) => `  --radius-${k}: ${v}px;`),
    ...Object.entries(tokens.motion).map(([k, v]) => `  --motion-${k}: ${typeof v === 'number' ? `${v}ms` : v};`),
  ];
  const themes = Object.entries(tokens.themes).map(([name, theme]) =>
    `[data-theme="${name}"] {\n  color-scheme: dark;\n${Object.entries(theme).map(([k, v]) => `  --color-${k}: ${v};`).join('\n')}\n}`);
  return `/* Generated from design/tokens.json. Both themes are PROPOSED, not selected branding. */\n:root {\n${base.join('\n')}\n}\n\n${themes.join('\n\n')}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const tokens = JSON.parse(await readFile(new URL('../design/tokens.json', import.meta.url), 'utf8'));
  await writeFile(new URL('../design/tokens.css', import.meta.url), renderTokens(tokens));
  console.log('Generated design/tokens.css');
}
