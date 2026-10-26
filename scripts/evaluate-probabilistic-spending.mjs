import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { createServer } from 'vite';

// Offline only: reuse the previously authorized snapshot; never open a database or session.
const root = path.resolve('.vercel/forecast-evaluation');
const input = path.resolve(process.argv[2] ?? path.join(root, 'private-dataset.json'));
const candidateModel = process.argv[4] ?? 'weekly-block-bootstrap-v6';
if (!['weekly-block-bootstrap-v6', 'probability-amount-v7'].includes(candidateModel)) throw Error('Invalid offline candidate');
const isHurdle = candidateModel === 'probability-amount-v7';
const output = path.resolve(process.argv[3] ?? path.join(root, `${isHurdle ? 'v7' : 'v6'}-comparison-7-14-21-28.json`));
const relative = path.relative(root, output);
if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || input === output) throw Error('Report must stay in the ignored evaluation directory');
const raw = fs.readFileSync(input, 'utf8').replace(/^\uFEFF/, '');
const envelope = JSON.parse(raw);
if (envelope.rows && envelope.rows.length !== 1) throw Error('Exactly one account snapshot is required');
const data = envelope.rows?.[0]?.dataset ?? envelope;
const reference = JSON.parse(fs.readFileSync(path.join(root, isHurdle ? 'v6-comparison-7-14-21-28.json' : 'v5-comparison.json'), 'utf8').replace(/^\uFEFF/, ''));
const inputSha256 = crypto.createHash('sha256').update(raw).digest('hex');
if (inputSha256 !== reference.inputSha256) throw Error('Snapshot differs from the previous comparison');
const months = [...new Set(reference.folds.map(f => f.month))].sort();
const origins = [7, 14, 21, 28];
const models = ['weekday-history-v1', candidateModel];
const rows = data.transactions.filter(row => !row.deleted_at);
const round = value => Math.round(value * 100) / 100;
const server = await createServer({ configFile: false, server: { middlewareMode: true, watch: null }, optimizeDeps: { noDiscovery: true }, appType: 'custom' });
const started = performance.now();
try {
  const { forecastSpending } = await server.ssrLoadModule('/server/spending-forecast.ts');
  const { transactionEUR } = await server.ssrLoadModule('/src/lib/spendingForecast.ts');
  const { WEEKLY_BOOTSTRAP_SAMPLES, WEEKLY_BOOTSTRAP_SEED, MIN_BOOTSTRAP_WEEKS } = await server.ssrLoadModule('/server/weekly-bootstrap-spending.ts');
  const hurdle = await server.ssrLoadModule('/server/probability-amount-spending.ts');
  const actuals = Object.fromEntries(months.map(month => [month, round(rows.filter(t => t.type === 'expense' && t.date.slice(0, 7) === month).reduce((sum, row) => sum + transactionEUR(row), 0))]));
  function fold(month, day, known, recurring = []) {
    const date = `${month}-${String(day).padStart(2, '0')}`;
    const baseline = forecastSpending(known, [], recurring, date);
    const candidate = forecastSpending(known, [], recurring, date, models[1]);
    if (baseline.total === null || candidate.total === null) throw Error(`Unavailable forecast: ${date}`);
    if (baseline.spent !== candidate.spent || baseline.scheduled !== candidate.scheduled) throw Error('Deterministic accounting differs');
    if (baseline.total < baseline.spent + baseline.scheduled || candidate.total < candidate.spent + candidate.scheduled) throw Error('Commitment lower bound violated');
    const simulation = isHurdle ? { ...candidate.twoPart, fallback: false, weeks: undefined } : candidate.bootstrap;
    if (!simulation?.points) throw Error('Missing simulation diagnostics');
    const final = simulation.points.at(-1);
    const deterministic = candidate.spent + candidate.scheduled;
    return { month, date, day, actual: actuals[month], spent: baseline.spent, scheduled: baseline.scheduled,
      predictions: { [models[0]]: baseline.total, [models[1]]: candidate.total },
      simulation: { weeks: simulation.weeks, categories: simulation.categories?.length, samples: simulation.samples, fallback: simulation.fallback,
        // Diagnostic mean uses the identical simulated paths, never selected as a replacement after evaluation.
        meanTotal: final ? round(deterministic + final.mean) : candidate.total,
        lower80: final ? round(deterministic + final.lower80) : simulation.fallback ? null : round(deterministic),
        upper80: final ? round(deterministic + final.upper80) : simulation.fallback ? null : round(deterministic) } };
  }
  const folds = [];
  for (const month of months) {
    for (const day of origins) {
      const date = `${month}-${String(day).padStart(2, '0')}`;
      const result = fold(month, day, rows.filter(row => row.date <= date));
      const old = reference.folds.find(f => f.date === date);
      if (old && old.predictions[models[0]] !== result.predictions[models[0]]) throw Error(`Baseline regression: ${date}`);
      folds.push(result);
    }
  }
  function metrics(subset, model) {
    if (!subset.length) return { origins: 0, months: 0, mae: null, rmse: null, bias: null, wapePercent: null, winsAgainstBaseline: 0, ties: 0 };
    const errors = subset.map(f => f.predictions[model] - f.actual);
    const absolute = errors.reduce((sum, error) => sum + Math.abs(error), 0);
    return { origins: subset.length, months: new Set(subset.map(f => f.month)).size,
      mae: round(absolute / errors.length), rmse: round(Math.sqrt(errors.reduce((sum, error) => sum + error * error, 0) / errors.length)),
      bias: round(errors.reduce((sum, error) => sum + error, 0) / errors.length),
      wapePercent: round(100 * absolute / subset.reduce((sum, f) => sum + f.actual, 0)),
      winsAgainstBaseline: subset.filter(f => Math.abs(f.predictions[model] - f.actual) < Math.abs(f.predictions[models[0]] - f.actual) - 0.00001).length,
      ties: subset.filter(f => Math.abs(Math.abs(f.predictions[model] - f.actual) - Math.abs(f.predictions[models[0]] - f.actual)) < 0.00001).length };
  }
  const recent = folds.filter(f => f.month >= '2026-01');
  const scores = Object.fromEntries(models.map(model => [model, { all: metrics(folds, model), recent2026: metrics(recent, model),
    byDay2026: Object.fromEntries(origins.map(day => [day, metrics(recent.filter(f => f.day === day), model)])),
    byDayAll: Object.fromEntries(origins.map(day => [day, metrics(folds.filter(f => f.day === day), model)])),
    byMonth: Object.fromEntries(months.map(month => [month, metrics(folds.filter(f => f.month === month), model)])) }]));
  function localDayEnd(date) {
    const zone = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Rome', timeZoneName: 'shortOffset' }).formatToParts(new Date(`${date}T12:00:00Z`)).find(p => p.type === 'timeZoneName').value;
    const offset = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(zone);
    if (!offset) throw Error('Unexpected timezone offset');
    return Date.parse(`${date}T23:59:59.999Z`) - (Number(offset[2]) * 60 + Number(offset[3] ?? 0)) * (offset[1] === '+' ? 1 : -1) * 60000;
  }
  if (localDayEnd('2026-01-28') !== Date.parse('2026-01-28T22:59:59.999Z') || localDayEnd('2026-07-28') !== Date.parse('2026-07-28T21:59:59.999Z')) throw Error('Calendar cutoff regression');
  const conservative = [];
  for (const f of recent) {
    const limit = localDayEnd(f.date);
    const known = rows.filter(t => Date.parse(t.created_at) <= limit && Date.parse(t.updated_at) <= limit);
    const schedules = data.recurringExpenses.filter(r => Date.parse(r.created_at) <= limit && Date.parse(r.updated_at) <= limit);
    conservative.push(fold(f.month, f.day, known, schedules));
  }
  const bandRows = recent.filter(f => f.simulation.lower80 !== null);
  const meanDiagnostic = recent.map(f => ({ ...f, predictions: { ...f.predictions, 'same-path-mean': f.simulation.meanTotal } }));
  const report = { inputSha256, snapshotAt: data.extractedAt, rows: rows.length,
    method: { candidate: models[1], origins, months, lookbackDays: 180, minimumCompleteWeeks: isHurdle ? undefined : MIN_BOOTSTRAP_WEEKS,
      samples: isHurdle ? hurdle.PROBABILITY_AMOUNT_SAMPLES : WEEKLY_BOOTSTRAP_SAMPLES, seed: isHurdle ? hurdle.PROBABILITY_AMOUNT_SEED : WEEKLY_BOOTSTRAP_SEED,
      sampling: isHurdle ? 'independent Bernoulli category/day event; pooled lognormal positive daily amount' : 'uniform complete Monday-Sunday blocks; joint categories; new donor each target calendar week',
      hurdleParameters: isHurdle ? { probabilityPriorDays: hurdle.PROBABILITY_PRIOR_DAYS, weekdayPrior: hurdle.WEEKDAY_PROBABILITY_PRIOR, logMeanPriorEvents: hurdle.LOG_AMOUNT_PRIOR_EVENTS, logVariancePriorEvents: hurdle.LOG_VARIANCE_PRIOR_EVENTS } : undefined,
      point: 'median of cumulative residual after pathwise planned-variable substitution',
      baselineDefaultUnchanged: true, fixedBeforeEvaluation: true, independentHoldout: false,
      historicalConfigurationExcluded: true, conservativeReplayIncludesPlannedRowsKnownAtOrigin: true, importedHistoryAndUnavailableRevisions: true },
    scores, conservativeReplay: Object.fromEntries(models.map(model => [model, metrics(conservative, model)])),
    samePathMeanDiagnostic2026: metrics(meanDiagnostic, 'same-path-mean'),
    empiricalBand2026: { nominalPercent: 80, evaluatedOrigins: bandRows.length,
      coveragePercent: round(100 * bandRows.filter(f => f.actual >= f.simulation.lower80 && f.actual <= f.simulation.upper80).length / bandRows.length),
      meanWidth: round(bandRows.reduce((sum, f) => sum + f.simulation.upper80 - f.simulation.lower80, 0) / bandRows.length), calibrated: false },
    fallbackOrigins: folds.filter(f => f.simulation.fallback).length, elapsedMs: round(performance.now() - started), folds, conservativeFolds: conservative };
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ output, scores: Object.fromEntries(models.map(model => [model, { all: scores[model].all, recent2026: scores[model].recent2026 }])), conservativeReplay: report.conservativeReplay,
    samePathMeanDiagnostic2026: report.samePathMeanDiagnostic2026, empiricalBand2026: report.empiricalBand2026, elapsedMs: report.elapsedMs }, null, 2));
} finally { await server.close(); }
