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
const compareQuarters = process.argv[2] === '--quarter-weights';
const compareFifths = process.argv[2] === '--fifth-weights';
const compareWeights = compareQuarters || compareFifths;
const output = path.resolve(process.argv[compareWeights ? 3 : 2] ?? path.join(root, `${compareFifths ? 'v10' : compareQuarters ? 'v9' : 'v8'}-comparison-7-14-21-28.json`));
const prior = compareWeights ? JSON.parse(fs.readFileSync(path.join(root, 'v8-comparison-7-14-21-28.json'), 'utf8').replace(/^\uFEFF/, '')) : null;
if (prior) {
  assert.equal(prior.inputSha256, source.inputSha256);
  assert.equal(prior.componentReportSha256, crypto.createHash('sha256').update(sourceRaw).digest('hex'));
}
const relative = path.relative(root, output);
if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || output === sourceFile || output === path.join(root, 'private-dataset.json')) throw Error('Report must stay in the ignored evaluation directory');
const baseline = 'weekday-history-v1', weekly = 'weekly-block-bootstrap-v6', combined = 'equal-current-weekly-v8';
const variants = [[combined, 1, 2], ...(compareQuarters ? [['current75-weekly25-v9', 3, 4], ['current25-weekly75-v9', 1, 4]] : compareFifths ? [['current60-weekly40-v10', 3, 5], ['current40-weekly60-v10', 2, 5]] : [])];
const models = [baseline, weekly, ...variants.map(([model]) => model)], origins = [7, 14, 21, 28];
assert.equal(source.method.candidate, weekly);
assert.deepEqual(source.method.origins, origins);
const months = source.method.months;
assert.equal(new Set(months).size, 38);
const round = value => Math.round(value * 100) / 100;
const server = await createServer({ configFile: false, server: { middlewareMode: true, watch: null }, optimizeDeps: { noDiscovery: true }, appType: 'custom' });
try {
  const { equalWeightForecastTotal, quarterWeightForecastTotal, fifthWeightForecastTotal } = await server.ssrLoadModule('/server/forecast-combination.ts');
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
      const predictions = { [baseline]: first, [weekly]: second };
      assert(first + 0.00001 >= f.spent + f.scheduled && second + 0.00001 >= f.spent + f.scheduled);
      for (const [model, numerator, denominator] of variants) {
        const total = denominator === 5 ? fifthWeightForecastTotal(first, second, numerator)
          : denominator === 4 ? quarterWeightForecastTotal(first, second, numerator) : equalWeightForecastTotal(first, second);
        assert(total + 0.00001 >= f.spent + f.scheduled);
        assert(total >= Math.min(first, second) && total <= Math.max(first, second));
        predictions[model] = total;
      }
      return { month: f.month, date: f.date, day: f.day, actual: f.actual, spent: f.spent, scheduled: f.scheduled, predictions };
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
  if (prior) {
    assert.deepEqual(scores[combined], prior.scores[combined]);
    assert.deepEqual(conservativeReplay[combined], prior.conservativeReplay[combined]);
    for (const key of ['folds', 'conservativeFolds']) {
      const evaluated = key === 'folds' ? folds : conservative;
      for (const f of evaluated) assert.equal(f.predictions[combined], prior[key].find(p => p.date === f.date)?.predictions[combined]);
    }
  }
  const report = { inputSha256: source.inputSha256, componentReportSha256: crypto.createHash('sha256').update(sourceRaw).digest('hex'), snapshotAt: source.snapshotAt,
    method: { candidate: compareFifths ? 'fifth-combinations-v10' : compareQuarters ? 'quarter-combinations-v9' : combined, components: [baseline, weekly],
      weights: compareWeights ? Object.fromEntries(variants.map(([model, n, d]) => [model, [n / d, 1 - n / d]])) : [0.5, 0.5], origins, months,
      point: 'weighted sum of cent-rounded point forecasts; one final cent rounding, half-cent upwards',
      componentPredictionsReusedExactly: true, weightsFixedBeforeEvaluation: true, weightSearchPerformed: compareWeights, userRequestedFixedComparison: true, weightOptimizationPerformed: false,
      independentHoldout: false, uncertaintyIntervalsComputed: false, baselineDefaultUnchanged: true,
      historicalConfigurationExcluded: true, conservativeReplayIncludesPlannedRowsKnownAtOrigin: true, importedHistoryAndUnavailableRevisions: true },
    scores, conservativeReplay, folds, conservativeFolds: conservative };
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ output, scores: Object.fromEntries(models.map(model => [model, { all: scores[model].all, recent2026: scores[model].recent2026 }])), conservativeReplay }, null, 2));
} finally { await server.close(); }
