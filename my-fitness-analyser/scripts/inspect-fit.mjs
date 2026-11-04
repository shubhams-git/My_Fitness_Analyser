// Offline SDK inspection only; does not import activities into a database.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, relative, isAbsolute, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { Decoder, Stream } from '@garmin/fitsdk';

const privateRoot = fileURLToPath(new URL('../private-data/', import.meta.url));
const directory = resolve(process.argv[2] || privateRoot);
const rel = relative(privateRoot, directory);
if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Inspect files inside project private-data only');

const reports = [];
for (const file of await readdir(directory)) {
  if (!/\.fit$/i.test(file)) continue;
  const bytes = await readFile(resolve(directory, file));
  const decoder = new Decoder(Stream.fromBuffer(bytes));
  const integrity = decoder.isFIT() && decoder.checkIntegrity();
  if (!integrity) { reports.push({ file, integrity: false }); process.exitCode = 1; continue; }
  const { messages, errors } = decoder.read({ includeUnknownData: true });
  const records = messages.recordMesgs || [];
  const fields = [...new Set(records.flatMap(Object.keys))].sort();
  const coverage = Object.fromEntries(fields.map(field => [field, records.filter(row => row[field] !== null && row[field] !== undefined).length]));
  const summaries = (messages.sessionMesgs || []).map(session => Object.fromEntries(Object.entries(session).filter(([key]) => !/position|latitude|longitude|serial/i.test(key))));
  const devices = (messages.deviceInfoMesgs || []).map(({ manufacturer, product, garminProduct, productName, deviceType, sourceType }) => ({ manufacturer, product, garminProduct, productName, deviceType, sourceType }));
  const report = {
    file: basename(file), sha256: createHash('sha256').update(bytes).digest('hex'),
    integrity, errorCount: errors.length,
    messageCounts: Object.fromEntries(Object.entries(messages).map(([k, rows]) => [k, rows.length])),
    recordFields: fields, recordCoverage: coverage, sessions: summaries, devices,
    laps: (messages.lapMesgs || []).map(({ startTime, totalDistance, totalTimerTime, totalElapsedTime, avgHeartRate, maxHeartRate, lapTrigger }) => ({ startTime, totalDistance, totalTimerTime, totalElapsedTime, avgHeartRate, maxHeartRate, lapTrigger })),
  };
  await writeFile(resolve(directory, file + '.decoded.json'), JSON.stringify({ messages, errors: errors.map(e => String(e)) }, null, 2));
  reports.push(report);
  if (errors.length) process.exitCode = 1;
  console.log(JSON.stringify({ file, integrity, errors: errors.length, records: records.length, laps: report.laps.length, devices }));
}
if (!reports.length) throw new Error('No FIT files found in the supplied private directory');
await writeFile(resolve(directory, 'fit-inventory.json'), JSON.stringify({ sdk: '@garmin/fitsdk@21.221.0', reports }, null, 2));
