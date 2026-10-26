import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

// Exact offline combination of the retained component predictions, not a new fitted model.
const root = path.resolve('.vercel/forecast-evaluation');
const sourceFile = path.join(root, 'v6-comparison-7-14-21-28.json');
const sourceRaw = fs.readFileSync(sourceFile, 'utf8').replace(/^\uFEFF/, '');
const source = JSON.parse(sourceRaw);
const snapshot = fs.readFileSync(path.join(root, 'private-dataset.json'), 'utf8').replace(/^\uFEFF/, '');
assert.equal(crypto.createHash('sha256').update(snapshot).digest('hex'), source.inputSha256, 'Snapshot differs from previous comparison');
const output = path.resolve(process.argv[2] ?? path.join(root, 'v8-comparison-7-14-21-28.json'));
const relative = path.relative(root, output);
if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || output === sourceFile || output === path.join(root, 'private-dataset.json')) throw Error('Report must stay in the ignored evaluation directory');
const baseline = 'weekday-history-v1', weekly = 'weekly-block-bootstrap-v6', combined = 'equal-current-weekly-v8';
const models = [baseline, weekly, combined], origins = [7, 14, 21, 28];
assert.equal(source.method.candidate, weekly);
assert.deepEqual(source.method.origins, origins);
const months = source.method.months;
assert.equal(new Set(months).size, 38);
const round = value => Math.round(value * 100) / 100;
const server = await createServer({ configFile: false, server: { middlewareMode: true, watch: null }, optimizeDeps: { noDiscovery: true }, appType: 'custom' });
try {
  const { equalWeightForecastTotal } = await server.ssrLoadModule('/server/forecast-combination.ts');
  function combine(rows, expectedMonths) {
    assert.equal(rows.length, expectedMonths.length * origins.length);
    const dates = new Set();
    return rows.map(f => {
      assert(expectedMonths.includes(f.month) && origins.includes(f.day));
      assert.equal(f.date, `${f.month}-${String(f.day).padStart(2, '0')}`);
      assert(!dates.has(f.date), 'Duplicate origin'); dates.add(f.date);
      assert(Number.isFinite(f.actual) && f.actual >= 0 && Number.isFinite(f.spent) && f.spent >= 0 && Number.isFinite(f.scheduled) && f.scheduled >= 0);
      const first = f.predictions[baseline], second = f.predictions[weekly];
      assert(Number.isFinite(first) && Number.isFinite(second));
      const total = equalWeightForecastTotal(first, second);
      assert(first + 0.00001 >= f.spent + f.scheduled && second + 0.00001 >= f.spent + f.scheduled);
      assert(total + 0.00001 >= f.spent + f.scheduled);
      assert(total >= Math.min(first, second) && total <= Math.max(first, second));
      return { month: f.month, date: f.date, day: f.day, actual: f.actual, spent: f.spent, scheduled: f.scheduled,
        predictions: { [baseline]: first, [weekly]: second, [combined]: total } };
    });
  }
  const folds = combine(source.folds, months);
  const recent = folds.filter(f => f.month >= '2026-01');
  const recentMonths = months.filter(month => month >= '2026-01');
  const conservative = combine(source.conservativeFolds, recentMonths);
  function metrics(rows, model) {
    assert(rows.length > 0);
    const errors = rows.map(f => f.predictions[model] - f.actual);
    const absolute = errors.reduce((sum, error) => sum + Math.abs(error), 0);
    return { origins: rows.length, months: new Set(rows.map(f => f.month)).size,
      mae: round(absolute / errors.length), rmse: round(Math.sqrt(errors.reduce((sum, error) => sum + error * error, 0) / errors.length)),
      bias: round(errors.reduce((sum, error) => sum + error, 0) / errors.length),
      wapePercent: round(100 * absolute / rows.reduce((sum, f) => sum + f.actual, 0)),
      winsAgainstBaseline: rows.filter(f => Math.abs(f.predictions[model] - f.actual) < Math.abs(f.predictions[baseline] - f.actual) - 0.00001).length,
      ties: rows.filter(f => Math.abs(Math.abs(f.predictions[model] - f.actual) - Math.abs(f.predictions[baseline] - f.actual)) < 0.00001).length };
  }
  const scores = Object.fromEntries(models.map(model => [model, { all: metrics(folds, model), recent2026: metrics(recent, model),
    byDay2026: Object.fromEntries(origins.map(day => [day, metrics(recent.filter(f => f.day === day), model)])),
    byDayAll: Object.fromEntries(origins.map(day => [day, metrics(folds.filter(f => f.day === day), model)])),
    byMonth: Object.fromEntries(months.map(month => [month, metrics(folds.filter(f => f.month === month), model)])) }]));
  const conservativeReplay = Object.fromEntries(models.map(model => [model, metrics(conservative, model)]));
  // Every component statistic must reproduce the previous calculation before comparing the blend.
  for (const model of [baseline, weekly]) {
    assert.deepEqual(scores[model], source.scores[model]);
    assert.deepEqual(conservativeReplay[model], source.conservativeReplay[model]);
  }
  const report = { inputSha256: source.inputSha256, componentReportSha256: crypto.createHash('sha256').update(sourceRaw).digest('hex'), snapshotAt: source.snapshotAt,
    method: { candidate: combined, components: [baseline, weekly], weights: [0.5, 0.5], origins, months,
      point: 'arithmetic mean of rounded point forecasts; one final cent rounding, half-cent upwards',
      componentPredictionsReusedExactly: true, weightsFixedBeforeEvaluation: true, weightSearchPerformed: false,
      independentHoldout: false, uncertaintyIntervalsComputed: false, baselineDefaultUnchanged: true,
      historicalConfigurationExcluded: true, conservativeReplayIncludesPlannedRowsKnownAtOrigin: true, importedHistoryAndUnavailableRevisions: true },
    scores, conservativeReplay, folds, conservativeFolds: conservative };
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ output, scores: Object.fromEntries(models.map(model => [model, { all: scores[model].all, recent2026: scores[model].recent2026 }])), conservativeReplay }, null, 2));
} finally { await server.close(); }
