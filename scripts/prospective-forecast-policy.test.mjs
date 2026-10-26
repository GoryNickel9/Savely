import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { forecastDates, truthDates, romeTime, captureWindow, validateOwnedSnapshot, scorePredictions } from './prospective-forecast-policy.mjs';
import { writeImmutableJson, calculatePredictions, collectForDate, studyRoot } from './collect-prospective-forecasts.mjs';

const frozenAt = '2026-10-26T20:43:29.940Z';
test('registers one pilot and exactly 36 primary origins, with nine full months', () => {
  const dates = forecastDates();
  assert.equal(dates.length, 37); assert.equal(new Set(dates).size, 37);
  assert.equal(dates[0], '2026-10-28'); assert.equal(dates[1], '2026-11-07'); assert.equal(dates.at(-1), '2027-07-28');
  assert(dates.every(d => [7, 14, 21, 28].includes(Number(d.slice(-2)))));
});
test('uses Rome civil time through winter and daylight saving changes', () => {
  assert.deepEqual(romeTime('2026-10-28T22:45:00Z'), { date: '2026-10-28', minute: 1425 });
  assert.deepEqual(romeTime('2027-03-28T21:45:00Z'), { date: '2027-03-28', minute: 1425 });
  assert(captureWindow('2027-03-28', '2027-03-28T21:45:00Z', frozenAt));
});
test('rejects early, late, past-origin and pre-freeze snapshots', () => {
  assert(!captureWindow('2026-10-28', '2026-10-28T22:44:59Z', frozenAt));
  assert(captureWindow('2026-10-28', '2026-10-28T22:59:59Z', frozenAt));
  assert(!captureWindow('2026-10-28', '2026-10-28T23:00:00Z', frozenAt));
  assert(!captureWindow('2026-10-28', '2026-11-07T22:45:00Z', frozenAt));
  assert(!captureWindow('2026-10-28', '2026-10-28T22:45:00Z', '2026-10-29T00:00:00Z'));
});
test('fixes monthly truth locks on the seventh of the following month, including the year boundary', () => {
  assert.equal(truthDates().length, 10);
  assert.deepEqual(truthDates()[0], { month: '2026-10', due: '2026-11-07' });
  assert.deepEqual(truthDates()[2], { month: '2026-12', due: '2027-01-07' });
  assert.deepEqual(truthDates().at(-1), { month: '2027-07', due: '2027-08-07' });
});
test('enforces the enrolled owner across every financial collection', () => {
  const data = { ownerId: 'owner', extractedAt: frozenAt, transactions: [{ user_id: 'owner' }], budgets: [], recurringExpenses: [], categories: [] };
  validateOwnedSnapshot(data, { accountId: 'owner' });
  assert.throws(() => validateOwnedSnapshot({ ...data, categories: [{ user_id: 'other' }] }, { accountId: 'owner' }), /Foreign row/);
  assert.throws(() => validateOwnedSnapshot(data, { accountId: 'other' }), /Snapshot owner/);
});
test('primary evidence is complete and never overwritten on retries', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'savely-prospective-synthetic-'));
  const file = path.join(dir, 'prediction.json');
  assert.equal(writeImmutableJson(file, { value: 1 }), true);
  assert.equal(writeImmutableJson(file, { value: 2 }), false);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { value: 1 });
  assert.deepEqual(fs.readdirSync(dir), ['prediction.json']);
});
test('scores only primary months and exposes missing origins instead of claiming a winner', () => {
  const predictions = ['2026-11-07', '2026-11-14', '2026-11-21', '2026-11-28'].map((referenceDate, i) => ({ referenceDate, forecasts: { a: { total: i % 2 ? 80 : 120 }, b: { total: i === 0 ? null : 110 } } }));
  const result = scorePredictions(predictions, { '2026-10': 999, '2026-11': 100 }, ['a', 'b']);
  assert.equal(result.metrics.a.mae, 20); assert.equal(result.metrics.a.rmse, 20); assert.equal(result.metrics.a.bias, 0);
  assert.equal(result.metrics.b.mae, 10); assert.equal(result.metrics.b.matchedOrigins, 3);
  assert.deepEqual(result.metrics.b.missingDates, ['2026-11-07']); assert(result.provisional); assert.equal(result.bestModelConfirmed, false);
  assert.throws(() => scorePredictions([...predictions, predictions[0]], {}, ['a']), /Duplicate/);
});
test('an empty study reports no scores and remains provisional', () => {
  const result = scorePredictions([], {}, ['current', 'combined']);
  assert.equal(result.metrics.current.mae, null); assert.equal(result.metrics.current.matchedOrigins, 0); assert(result.provisional);
});
test('all fifteen frozen models run on synthetic constant spending without reading a real account', { skip: !fs.existsSync(path.join(studyRoot, 'FROZEN_PROTOCOL.json')) }, async () => {
  const protocol = JSON.parse(fs.readFileSync(path.join(studyRoot, 'FROZEN_PROTOCOL.json'), 'utf8'));
  const origin = new Date('2026-10-28T00:00:00Z');
  const transactions = Array.from({ length: 181 }, (_, i) => {
    const date = new Date(origin); date.setUTCDate(date.getUTCDate() - 180 + i);
    return { id: `synthetic-${i}`, user_id: 'synthetic', type: 'expense', date: date.toISOString().slice(0, 10), amount: 10, currency: 'EUR', exchange_rate_eur: 1, category_id: 'food', description: null, deleted_at: null, created_at: frozenAt, updated_at: frozenAt };
  });
  const forecasts = await calculatePredictions({ transactions, budgets: [], recurringExpenses: [] }, '2026-10-28', protocol);
  assert.equal(Object.keys(forecasts).length, 15);
  for (const [model, value] of Object.entries(forecasts)) assert.equal(value.total, 310, model);
});

function syntheticSetup() {
  const protocol = JSON.parse(fs.readFileSync(path.join(studyRoot, 'FROZEN_PROTOCOL.json'), 'utf8'));
  const enrollment = { accountId: 'synthetic', protocolSha256: 'synthetic-protocol' };
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'savely-prospective-e2e-synthetic-'));
  const snapshot = timestamp => {
    const origin = new Date(`${romeTime(timestamp).date}T00:00:00Z`);
    return { ownerId: 'synthetic', extractedAt: timestamp, budgets: [], categories: [], recurringExpenses: [],
      transactions: Array.from({ length: 181 }, (_, i) => {
        const day = new Date(origin); day.setUTCDate(day.getUTCDate() - 180 + i);
        return { id: `synthetic-${i}`, user_id: 'synthetic', type: 'expense', date: day.toISOString().slice(0, 10), amount: 10, currency: 'EUR', exchange_rate_eur: 1, category_id: 'food', description: null, deleted_at: null, created_at: frozenAt, updated_at: frozenAt };
      }) };
  };
  return { protocol, enrollment, directory, snapshot };
}
test('captures, retries idempotently and locks pilot truth on the next seventh', { skip: !fs.existsSync(path.join(studyRoot, 'FROZEN_PROTOCOL.json')) }, async () => {
  const setup = syntheticSetup(); let calls = 0;
  const first = '2026-10-28T22:45:00Z';
  const run = timestamp => collectForDate({ ...setup, now: new Date(timestamp), snapshotProvider: () => { calls++; return setup.snapshot(timestamp); } });
  const initial = await run(first); assert.deepEqual(initial.captured, ['2026-10-28']); assert.equal(calls, 1);
  const evidence = fs.readFileSync(path.join(setup.directory, 'predictions/2026-10-28.json'));
  const retry = await run(first); assert.deepEqual(retry.captured, []); assert.equal(calls, 1);
  assert.deepEqual(fs.readFileSync(path.join(setup.directory, 'predictions/2026-10-28.json')), evidence);
  const next = await run('2026-11-07T22:45:00Z'); assert.deepEqual(next.captured, ['2026-11-07']); assert.deepEqual(next.newTruths, ['2026-10']); assert.equal(calls, 2);
  assert.equal(JSON.parse(fs.readFileSync(path.join(setup.directory, 'truths/2026-10.json'), 'utf8')).actual, 310);
});
test('a missed origin cannot query later account data or fabricate a forecast', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'savely-prospective-missed-synthetic-'));
  const result = await collectForDate({ enrollment: {}, protocol: { registeredModels: [], registeredBlendFractions: [] }, directory,
    now: new Date('2026-10-29T22:45:00Z'), snapshotProvider: () => { throw Error('Database must not be read'); } });
  assert.deepEqual(result.missing, ['2026-10-28']); assert(!fs.existsSync(path.join(directory, 'predictions/2026-10-28.json')));
});
test('recovers a prediction only from its on-time snapshot, never from later information', { skip: !fs.existsSync(path.join(studyRoot, 'FROZEN_PROTOCOL.json')) }, async () => {
  const setup = syntheticSetup();
  const timestamp = '2026-10-28T22:45:00Z';
  await collectForDate({ ...setup, now: new Date(timestamp), snapshotProvider: () => setup.snapshot(timestamp) });
  fs.unlinkSync(path.join(setup.directory, 'predictions/2026-10-28.json'));
  const result = await collectForDate({ ...setup, now: new Date('2026-10-29T22:45:00Z'), snapshotProvider: () => { throw Error('Later data must not be read'); } });
  assert.deepEqual(result.recovered, ['2026-10-28']);
  const prediction = JSON.parse(fs.readFileSync(path.join(setup.directory, 'predictions/2026-10-28.json'), 'utf8'));
  assert.equal(prediction.snapshotAt, timestamp); assert.equal(prediction.forecasts['equal-current-weekly-v8'].total, 310);
});
test('recovers a truth record from its original lock snapshot without reading later spending', { skip: !fs.existsSync(path.join(studyRoot, 'FROZEN_PROTOCOL.json')) }, async () => {
  const setup = syntheticSetup();
  for (const timestamp of ['2026-10-28T22:45:00Z', '2026-11-07T22:45:00Z']) await collectForDate({ ...setup, now: new Date(timestamp), snapshotProvider: () => setup.snapshot(timestamp) });
  fs.unlinkSync(path.join(setup.directory, 'truths/2026-10.json'));
  const result = await collectForDate({ ...setup, now: new Date('2026-11-08T22:45:00Z'), snapshotProvider: () => { throw Error('Later actual spending must not be read'); } });
  assert.deepEqual(result.newTruths, ['2026-10']);
  const truth = JSON.parse(fs.readFileSync(path.join(setup.directory, 'truths/2026-10.json'), 'utf8'));
  assert.equal(truth.actual, 310); assert.equal(truth.observedAt, '2026-11-07T22:45:00Z'); assert.equal(truth.recoveredFromOnTimeSnapshot, true);
});
