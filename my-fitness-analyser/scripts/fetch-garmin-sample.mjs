// Read-only feasibility capture, not the application's production sync/importer.
// References: Garmin Personal API Swagger and garmin/connect-personal-api-python.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const base = 'https://personal.connectapi.garmin.com';
const maxBytes = 32 * 1024 * 1024;

async function request(path, authorization, { method = 'GET', binary = false } = {}) {
  const response = await fetch(base + path, {
    method, redirect: 'error', signal: AbortSignal.timeout(30000),
    headers: { Authorization: authorization, Accept: binary ? 'application/zip, application/x-zip-compressed, application/octet-stream' : method === 'POST' ? '*/*' : 'application/json' },
  });
  // Never print response bodies: authentication errors may contain sensitive data.
  if (!response.ok) throw new Error(`Garmin ${method} request failed (HTTP ${response.status})`);
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > maxBytes) throw new Error('Garmin response exceeds the capture size limit');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

try {
  const env = parseEnv(await readFile(new URL('.env', root), 'utf8'));
  const key = env.GARMIN_PERSONAL_API_KEY || env.API_KEY;
  if (!key?.trim()) throw new Error('Missing Garmin API key in project .env');
  const token = (await request('/personalapitoken-service/personal-api/personal-api-key/token', `ApiKey ${key.trim()}`, { method: 'POST' })).toString('utf8').trim();
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) throw new Error('Unexpected Garmin token format');
  // Token stays in memory; neither it nor the API key is written into captures.
  const authorization = `Bearer ${token}`;
  const fetchedAt = new Date().toISOString();
  const directory = new URL(`private-data/garmin/${fetchedAt.replace(/[:.]/g, '-')}/`, root);
  await mkdir(directory, { recursive: true });
  const activities = [];
  let complete = false;
  for (let start = 0; start < 200; start += 20) {
    const page = JSON.parse((await request(`/activitylist-service/activities/search/activities?start=${start}&limit=20`, authorization)).toString('utf8'));
    if (!Array.isArray(page)) throw new Error('Unexpected Garmin activity list shape');
    await writeFile(new URL(`page-${start}.json`, directory), JSON.stringify(page, null, 2));
    activities.push(...page);
    if (page.length < 20) { complete = true; break; }
  }
  if (!complete) throw new Error('Capture reached 200 activities; list is incomplete, no automatic continuation');
  await writeFile(new URL('activities.json', directory), JSON.stringify(activities, null, 2));
  const manifest = { fetchedAt, source: base, complete, files: [], activityCount: activities.length };
  for (const activity of activities) {
    const id = String(activity.activityId);
    if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) <= 0) throw new Error('Invalid Garmin activity ID');
    for (const [name, path, binary] of [
      [`activity-${id}.json`, `/activity-service/activity/${id}`, false],
      [`activity-${id}.zip`, `/download-service/files/activity/${id}`, true],
    ]) {
      const bytes = await request(path, authorization, { binary });
      if (binary && bytes.readUInt16LE(0) !== 0x4b50) throw new Error('Expected Garmin ZIP activity archive');
      if (!binary) JSON.parse(bytes.toString('utf8'));
      await writeFile(new URL(name, directory), bytes);
      manifest.files.push({ name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
    }
    console.log(`Captured activity ${id}`);
  }
  await writeFile(new URL('manifest.json', directory), JSON.stringify(manifest, null, 2));
  console.log(`Captured ${activities.length} activities in ${directory.pathname}`);
} catch (error) {
  // Only our own fixed messages are exposed; underlying network errors are suppressed.
  console.error(error.message?.startsWith('Garmin ') || /^(Missing Garmin|Unexpected Garmin|Capture reached|Invalid Garmin|Expected Garmin)/.test(error.message) ? error.message : 'Garmin capture failed; no credentials or response bodies were logged.');
  process.exitCode = 1;
}
