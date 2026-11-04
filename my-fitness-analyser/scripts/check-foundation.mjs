import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderTokens } from './tokens.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const required = ['README.md', 'AGENTS.md', 'PRODUCT.md', 'DESIGN.md', 'ARCHITECTURE.md', 'DECISIONS.md', 'WORKFLOW.md', 'STATE.md', 'ROADMAP.md', 'docs/DATA_CONTRACT.md', 'docs/QUALITY.md', 'docs/RESEARCH.md', 'templates/FEATURE.md', 'templates/RESUME.md'];
const tokens = JSON.parse(await readFile(resolve(root, 'design/tokens.json'), 'utf8'));
assert.equal(tokens.schemaVersion, 1);
assert.ok(['proposed', 'approved'].includes(tokens.status));
assert.ok(tokens.minTargetPx >= 44, 'Touch target contract regressed');
assert.ok(tokens.fontSize.body >= 16, 'Body/input baseline regressed');
assert.ok(tokens.selectedTheme === null || tokens.themes[tokens.selectedTheme], 'Unknown selected theme');
if (tokens.status === 'approved') assert.ok(tokens.selectedTheme, 'Approved tokens need a selected theme');

function luminance(hex) {
  assert.match(hex, /^#[0-9a-f]{6}$/i);
  const [r, g, b] = hex.slice(1).match(/../g).map(v => {
    const n = parseInt(v, 16) / 255;
    return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [high, low] = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (high + 0.05) / (low + 0.05);
}
let pairs = 0;
for (const [name, theme] of Object.entries(tokens.themes)) {
  for (const key of ['canvas', 'surface', 'raised', 'text', 'muted', 'accent', 'onAccent', 'positive', 'warning', 'danger', 'border', 'pace', 'heartRate', 'elevation']) assert.ok(theme[key], `${name}: missing ${key}`);
  for (const c of Object.values(theme)) luminance(c);
  for (const fg of ['text', 'muted', 'accent', 'positive', 'warning', 'danger']) {
    for (const bg of ['canvas', 'surface', 'raised']) {
      const ratio = contrast(theme[fg], theme[bg]);
      assert.ok(ratio >= 4.5, `${name}: ${fg}/${bg} is ${ratio.toFixed(2)}:1`);
      pairs++;
    }
  }
  assert.ok(contrast(theme.onAccent, theme.accent) >= 4.5, `${name}: action text contrast`);
  pairs++;
}
assert.equal(await readFile(resolve(root, 'design/tokens.css'), 'utf8'), renderTokens(tokens), 'Token CSS drift: run npm run tokens');

let linkCount = 0;
for (const file of required) {
  const full = resolve(root, file);
  const source = await readFile(full, 'utf8');
  assert.ok(source.trim(), `${file} is empty`);
  for (const match of source.matchAll(/\]\(([^)]+)\)/g)) {
    const href = match[1];
    if (/^(https?:|#|mailto:)/.test(href)) continue;
    const path = href.split('#')[0];
    if (path) { await stat(resolve(dirname(full), path)); linkCount++; }
  }
}
assert.ok((await readFile(resolve(root, 'AGENTS.md'))).length < 8192, 'Keep root instructions compact');
console.log(`PASS: ${required.length} required documents; ${linkCount} local links; ${Object.keys(tokens.themes).length} proposed palettes; ${pairs} text contrast pairs; generated CSS matches.`);
console.log('Scope: foundation only. No application, live API, database or Safari verification is implied.');
