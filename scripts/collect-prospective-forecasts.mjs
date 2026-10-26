import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { forecastDates, truthDates, romeTime, captureWindow, validateOwnedSnapshot, scorePredictions } from './prospective-forecast-policy.mjs';

const moduleRoot = path.dirname(fileURLToPath(import.meta.url));
const deployed = fs.existsSync(path.join(moduleRoot, 'ENROLLMENT.json'));
const repo = deployed ? JSON.parse(fs.readFileSync(path.join(moduleRoot, 'ENROLLMENT.json'), 'utf8')).workspaceRoot : fileURLToPath(new URL('../', import.meta.url));
export const studyRoot = deployed ? moduleRoot : path.join(repo, '.vercel/forecast-evaluation/independent-validation-20261026');
const collectionRoot = path.join(studyRoot, 'prospective');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const exists = file => fs.existsSync(file);

/** Publish a complete JSON file atomically; retries never replace primary evidence. */
export function writeImmutableJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const pending = `${file}.pending-${crypto.randomUUID()}`;
  fs.writeFileSync(pending, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  try {
    fs.linkSync(pending, file);
    return true;
  } catch (error) {
    if (error.code === 'EEXIST') return false;
    throw error;
  } finally { fs.unlinkSync(pending); }
}

function verifyStudy() {
  const enrollmentBytes = fs.readFileSync(path.join(studyRoot, 'ENROLLMENT.json'));
  assert.equal(sha(enrollmentBytes), read(path.join(studyRoot, 'ENROLLMENT_RECEIPT.json')).sha256, 'Enrollment changed');
  const enrollment = JSON.parse(enrollmentBytes);
  const protocolBytes = fs.readFileSync(path.join(studyRoot, 'FROZEN_PROTOCOL.json'));
  assert.equal(sha(protocolBytes), enrollment.protocolSha256, 'Frozen protocol hash changed');
  const protocol = JSON.parse(protocolBytes);
  assert.deepEqual(protocol.candidateWeights, [0.5, 0.5]);
  assert.equal(enrollment.dataChoice, 'same-account-prospective');
  assert.equal(enrollment.timezone, 'Europe/Rome');
  assert.deepEqual(enrollment.forecastDates, forecastDates());
  assert.deepEqual(enrollment.truthDates, truthDates());
  assert.equal(enrollment.truthPolicy, 'lock-on-7th-next-month; final-revision-sensitivity');
  assert(/^[0-9a-f-]{36}$/i.test(enrollment.accountId) && /^[^\s'";]+@[^\s'";]+\.[^\s'";]+$/.test(enrollment.accountEmail));
  for (const [name, hash] of Object.entries(protocol.sourceHashes)) assert.equal(sha(fs.readFileSync(path.join(studyRoot, 'frozen-source', name))), hash, 'Frozen model source changed');
  for (const [name, hash] of Object.entries(read(path.join(studyRoot, 'RUNTIME_RECEIPT.json')).hashes)) assert.equal(sha(fs.readFileSync(path.join(studyRoot, 'frozen-runtime', name))), hash, 'Frozen JavaScript runtime changed');
  if (deployed) for (const [name, hash] of Object.entries(read(path.join(studyRoot, 'COLLECTOR_RECEIPT.json')).hashes)) assert.equal(sha(fs.readFileSync(path.join(studyRoot, name))), hash, 'Collector changed');
  return { enrollment, protocol };
}

function databaseSnapshot(enrollment) {
  const literal = text => `'${text.replaceAll("'", "''")}'`;
  const query = `WITH target AS (SELECT id FROM auth.users WHERE id=${literal(enrollment.accountId)}::uuid AND lower(email)=${literal(enrollment.accountEmail.toLowerCase())})
SELECT jsonb_build_object('ownerId',target.id,'extractedAt',current_timestamp,
'transactions',COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.date,t.id) FROM public.transactions t WHERE t.user_id=target.id),'[]'::jsonb),
'budgets',COALESCE((SELECT jsonb_agg(to_jsonb(b) ORDER BY b.id) FROM public.budgets b WHERE b.user_id=target.id),'[]'::jsonb),
'recurringExpenses',COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM public.recurring_expenses r WHERE r.user_id=target.id),'[]'::jsonb),
'categories',COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.id) FROM public.categories c WHERE c.user_id=target.id),'[]'::jsonb)) AS dataset FROM target;`;
  const sqlFile = path.join(collectionRoot, `read-account-${crypto.randomUUID()}.sql`);
  fs.mkdirSync(collectionRoot, { recursive: true });
  fs.writeFileSync(sqlFile, query, { flag: 'wx' });
  try {
    let output;
    try { output = execFileSync('supabase', ['db', 'query', '--linked', '--project-ref', enrollment.projectRef, '--output', 'json', '--file', sqlFile], { cwd: repo, encoding: 'utf8', timeout: 120000, maxBuffer: 20_000_000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch { throw new Error('Read-only database snapshot failed; verify local Supabase access'); }
    const envelope = JSON.parse(output.replace(/^\uFEFF/, ''));
    assert.equal(envelope.rows?.length, 1, 'Enrolled account not uniquely available');
    const snapshot = envelope.rows[0].dataset;
    validateOwnedSnapshot(snapshot, enrollment);
    return snapshot;
  } finally { fs.unlinkSync(sqlFile); }
}

export async function calculatePredictions(snapshot, referenceDate, protocol) {
  const { forecastSpending } = await import(pathToFileURL(path.join(studyRoot, 'frozen-runtime/server/spending-forecast.js')).href);
  const combinations = await import(pathToFileURL(path.join(studyRoot, 'frozen-runtime/server/forecast-combination.js')).href);
  const forecasts = {};
  for (const model of protocol.registeredModels) {
    try { forecasts[model] = forecastSpending(snapshot.transactions, snapshot.budgets.filter(r => !r.deleted_at), snapshot.recurringExpenses, referenceDate, model); }
    catch (error) { forecasts[model] = { total: null, error: error.message }; }
  }
  const current = forecasts[protocol.baseline].total, weekly = forecasts['weekly-block-bootstrap-v6'].total;
  for (const [n, d] of protocol.registeredBlendFractions) {
    const model = n === 1 && d === 2 ? protocol.candidate : `blend-current-${n}-of-${d}`;
    const fn = d === 20 ? combinations.twentiethWeightForecastTotal : d === 5 ? combinations.fifthWeightForecastTotal : d === 4 ? combinations.quarterWeightForecastTotal : combinations.equalWeightForecastTotal;
    forecasts[model] = { total: current === null || weekly === null ? null : fn(current, weekly, n) };
  }
  return forecasts;
}

async function actualSpending(snapshot, month) {
  const { validTransactions, transactionEUR } = await import(pathToFileURL(path.join(studyRoot, 'frozen-runtime/src/lib/spendingForecast.js')).href);
  let cents = 0;
  for (const row of validTransactions(snapshot.transactions)) if (row.type === 'expense' && row.date.slice(0, 7) === month) {
    cents += Math.round(transactionEUR(row) * 100);
    assert(Number.isSafeInteger(cents), 'Actual spending overflow');
  }
  return cents / 100;
}

export async function collectForDate({ enrollment, protocol, now, snapshotProvider, directory }) {
  const target = (kind, key) => path.join(directory, kind, `${key}.json`);
  const local = romeTime(now);
  const withinWindow = local.minute >= 23 * 60 + 45;
  const captureDue = forecastDates().includes(local.date) && withinWindow;
  const truthDue = truthDates().filter(t => t.due === local.date && withinWindow);
  const result = { mode: 'run', date: local.date, captured: [], recovered: [], newTruths: [], missing: [], unavailable: [] };
  let live = null;
  const getLive = () => {
    if (live === null) { live = snapshotProvider(); validateOwnedSnapshot(live, enrollment); }
    return live;
  };
  // Recover only from an already captured, on-time snapshot; never use later data for a past origin.
  for (const date of forecastDates().filter(d => d <= local.date)) {
    if (exists(target('predictions', date))) continue;
    if (!exists(target('snapshots', date)) && date === local.date && captureDue) {
      const snapshot = getLive();
      assert(captureWindow(date, snapshot.extractedAt, protocol.frozenAt), 'Database snapshot missed the capture window');
      writeImmutableJson(target('snapshots', date), snapshot);
    }
    if (exists(target('snapshots', date))) {
      const snapshot = read(target('snapshots', date));
      validateOwnedSnapshot(snapshot, enrollment);
      assert(captureWindow(date, snapshot.extractedAt, protocol.frozenAt), 'Stored snapshot is not prospective');
      const forecasts = await calculatePredictions(snapshot, date, protocol);
      const generatedAt = new Date().toISOString();
      const prediction = { referenceDate: date, generatedAt, runtimeNode: process.version, snapshotAt: snapshot.extractedAt, snapshotSha256: sha(fs.readFileSync(target('snapshots', date))), protocolSha256: enrollment.protocolSha256, recoveredFromOnTimeSnapshot: local.date !== date, forecasts };
      writeImmutableJson(target('predictions', date), prediction);
      (prediction.recoveredFromOnTimeSnapshot ? result.recovered : result.captured).push(date);
      for (const [model, forecast] of Object.entries(forecasts)) if (forecast.total === null) result.unavailable.push({ date, model });
    } else if (date < local.date && writeImmutableJson(target('missing-origins', date), { date, detectedAt: now.toISOString(), reason: 'No on-time snapshot; no retrospective backfill' })) result.missing.push(date);
  }
  for (const t of truthDates().filter(t => t.due <= local.date)) {
    if (exists(target('truths', t.month))) continue;
    if (!exists(target('truth-snapshots', t.month)) && truthDue.some(due => due.month === t.month)) {
      const snapshot = getLive();
      assert.equal(romeTime(snapshot.extractedAt).date, local.date, 'Truth snapshot date changed');
      writeImmutableJson(target('truth-snapshots', t.month), snapshot);
    }
    if (exists(target('truth-snapshots', t.month))) {
      const snapshot = read(target('truth-snapshots', t.month));
      validateOwnedSnapshot(snapshot, enrollment);
      const observed = romeTime(snapshot.extractedAt);
      assert(observed.date === t.due && observed.minute >= 1425, 'Truth snapshot missed the lock window');
      writeImmutableJson(target('truths', t.month), { month: t.month, dueDate: t.due, observedAt: snapshot.extractedAt, snapshotSha256: sha(fs.readFileSync(target('truth-snapshots', t.month))), recoveredFromOnTimeSnapshot: local.date !== t.due, actual: await actualSpending(snapshot, t.month) });
      result.newTruths.push(t.month);
    } else if (t.due < local.date && writeImmutableJson(target('missing-truths', t.month), { month: t.month, dueDate: t.due, detectedAt: now.toISOString(), reason: 'Scheduled truth lock missed; late data cannot replace primary truth' })) result.missing.push(`truth:${t.month}`);
  }
  const predictions = forecastDates().filter(d => exists(target('predictions', d))).map(d => {
    const p = read(target('predictions', d));
    assert.equal(p.protocolSha256, enrollment.protocolSha256);
    assert.equal(p.snapshotSha256, sha(fs.readFileSync(target('snapshots', d))), 'Captured snapshot changed');
    return p;
  });
  const truths = Object.fromEntries(truthDates().filter(t => exists(target('truths', t.month))).map(t => {
    const value = read(target('truths', t.month));
    assert.equal(value.snapshotSha256, sha(fs.readFileSync(target('truth-snapshots', t.month))), 'Truth snapshot changed');
    return [t.month, value.actual];
  }));
  const modelIds = [...protocol.registeredModels, ...protocol.registeredBlendFractions.map(([n, d]) => n === 1 && d === 2 ? protocol.candidate : `blend-current-${n}-of-${d}`)];
  const report = { generatedAt: new Date().toISOString(), protocolSha256: enrollment.protocolSha256, ...scorePredictions(predictions, truths, modelIds),
    pilot: truths['2026-10'] === undefined ? null : { actual: truths['2026-10'], forecasts: predictions.find(p => p.referenceDate === '2026-10-28')?.forecasts ?? null } };
  fs.mkdirSync(directory, { recursive: true });
  const pending = path.join(directory, `report-${crypto.randomUUID()}.pending`);
  fs.writeFileSync(pending, `${JSON.stringify(report, null, 2)}\n`); fs.renameSync(pending, path.join(directory, 'REPORT.json'));
  if (local.date === '2027-08-07' && withinWindow) {
    const snapshot = getLive();
    const revised = {};
    for (const t of truthDates()) revised[t.month] = await actualSpending(snapshot, t.month);
    writeImmutableJson(path.join(directory, 'FINAL_REVISION_SENSITIVITY.json'), { observedAt: snapshot.extractedAt, revisedActuals: revised, ...scorePredictions(predictions, revised, modelIds) });
  }
  result.completedPrimaryMonths = report.completedPrimaryMonths.length;
  result.finalReviewReady = !report.provisional;
  result.studyPeriodEnded = local.date >= '2027-08-07';
  return result;
}

export async function main(run = false) {
  const { enrollment, protocol } = verifyStudy();
  const now = new Date(), local = romeTime(now);
  if (!run) return { mode: 'dry-run', date: local.date, captureDue: forecastDates().includes(local.date) && local.minute >= 1425,
    truthDue: truthDates().filter(t => t.due === local.date && local.minute >= 1425).map(t => t.month),
    nextForecast: forecastDates().find(d => d > local.date) ?? null, frozenSourcesVerified: true, databaseRead: false };
  return collectForDate({ enrollment, protocol, now, snapshotProvider: () => databaseSnapshot(enrollment), directory: collectionRoot });
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    if (process.argv[2] === '--check-db') {
      const { enrollment } = verifyStudy(), snapshot = databaseSnapshot(enrollment);
      console.log(JSON.stringify({ mode: 'database-preflight', snapshotAt: snapshot.extractedAt, enrolledOwnerVerified: true, validationCapture: false }, null, 2));
    } else console.log(JSON.stringify(await main(process.argv[2] === '--run'), null, 2));
  }
  catch (error) { console.error(`Prospective collection stopped: ${error.message}`); process.exitCode = 1; }
}
