// Compare real, private FIT captures with Garmin's JSON summaries. No fixture data is committed.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative, isAbsolute, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const privateRoot = fileURLToPath(new URL('../private-data/', import.meta.url));
assert.ok(process.argv[2], 'Supply a private capture directory');
const directory = resolve(process.argv[2]);
const rel = relative(privateRoot, directory);
assert.ok(!rel.startsWith('..') && !isAbsolute(rel), 'Capture must be inside private-data');
const json = async name => JSON.parse(await readFile(resolve(directory, name), 'utf8'));
const manifest = await json('manifest.json');
assert.equal(manifest.complete, true);
for (const file of manifest.files) {
  assert.equal(basename(file.name), file.name, 'Invalid manifest filename');
  const bytes = await readFile(resolve(directory, file.name));
  assert.equal(bytes.length, file.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, 'Capture hash mismatch');
}
const { reports } = await json('fits/fit-inventory.json');
const activities = await json('activities.json');
assert.equal(reports.length, activities.length, 'Expected one decoded FIT per captured activity in this sample');
const comparisons = [];
const matched = new Set();
for (const report of reports) {
  const id = report.file.match(/^activity-(\d+)-/)?.[1];
  assert.ok(id && !matched.has(id));
  assert.ok(activities.some(a => String(a.activityId) === id));
  matched.add(id);
  assert.equal(report.integrity, true);
  assert.equal(report.errorCount, 0);
  assert.equal(report.sessions.length, 1, 'Multisport needs a separate comparison strategy');
  const detail = await json(`activity-${id}.json`);
  const summary = detail.summaryDTO;
  const session = report.sessions[0];
  assert.equal(session.avgHeartRate ?? null, summary.averageHR ?? null);
  assert.equal(session.maxHeartRate ?? null, summary.maxHR ?? null);
  assert.ok(Math.abs(session.totalTimerTime - summary.duration) < 0.002);
  assert.ok(Math.abs(session.totalElapsedTime - summary.elapsedDuration) < 0.002);
  if (summary.distance != null) assert.ok(Math.abs(session.totalDistance - summary.distance) < 0.02);
  // Garmin explicitly documents this field as UTC despite its missing Z suffix.
  assert.equal(Date.parse(session.startTime), Date.parse(summary.startTimeGMT + 'Z'));
  assert.equal(basename(report.file), report.file);
  const fit = await readFile(resolve(directory, 'fits', report.file));
  assert.equal(createHash('sha256').update(fit).digest('hex'), report.sha256);
  comparisons.push({ activityId: id, summaryMatch: true });
}
await writeFile(resolve(directory, 'verification.json'), JSON.stringify({ verifiedAt: new Date().toISOString(), checks: ['archive/detail hashes', 'FIT hash/integrity', 'decoder errors', 'UTC start', 'distance', 'timer', 'elapsed', 'average/max HR'], comparisons }, null, 2));
console.log(`PASS: ${comparisons.length} private FIT/API comparisons and ${manifest.files.length} capture hashes. No browser, database or automatic-sync claim implied.`);
