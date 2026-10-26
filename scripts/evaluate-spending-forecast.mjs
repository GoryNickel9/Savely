import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { createServer } from 'vite';

// Offline only: read a locally retained account snapshot, never a database or a session.
const input = path.resolve(process.argv[2] ?? '.vercel/forecast-evaluation/private-dataset.json');
const output = path.resolve(process.argv[3] ?? '.vercel/forecast-evaluation/comparison.json');
const privateRoot = path.resolve('.vercel/forecast-evaluation');
const relativeOutput = path.relative(privateRoot, output);
if (!relativeOutput || relativeOutput.startsWith('..') || path.isAbsolute(relativeOutput) || input === output) throw Error('Report must stay inside the ignored evaluation directory');
const raw = fs.readFileSync(input, 'utf8').replace(/^\uFEFF/, '');
const envelope = JSON.parse(raw);
if (envelope.rows && envelope.rows.length !== 1) throw Error('Exactly one account snapshot is required');
const data = envelope.rows?.[0]?.dataset ?? envelope;
if (!Array.isArray(data.transactions) || !Array.isArray(data.budgets) || !Array.isArray(data.recurringExpenses)) throw Error('Invalid account snapshot');
const asOf = process.argv[4] ?? '2026-10-26';
const models = ['weekday-history-v1', 'recent-weekday-v2', 'robust-recent-weekday-v2', 'ordinary-extra-v3'];
const origins = [7, 14, 21, 26];
const server = await createServer({ configFile: false, server: { middlewareMode: true, watch: null }, optimizeDeps: { noDiscovery: true }, appType: 'custom' });
const started = performance.now();
try {
  const { forecastSpending } = await server.ssrLoadModule('/server/spending-forecast.ts');
  const { transactionEUR } = await server.ssrLoadModule('/src/lib/spendingForecast.ts');
  const { addDays, parseLocalDate, todayLocalISO, endOfMonth, startOfMonth } = await server.ssrLoadModule('/server/forecast-calendar.ts');
  const rows = data.transactions.filter(t => !t.deleted_at);
  const current = Object.fromEntries(models.map(model => {
    const f = forecastSpending(rows, data.budgets, data.recurringExpenses, asOf, model);
    return [model, { ...f, points: undefined }];
  }));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) throw Error('Invalid reference date');
  const folds = [];
  let month = startOfMonth(parseLocalDate(rows.reduce((first, row) => row.date < first ? row.date : first, asOf)));
  while (todayLocalISO(month).slice(0, 7) < asOf.slice(0, 7)) {
    const monthISO = todayLocalISO(month).slice(0, 7), finalDate = todayLocalISO(endOfMonth(month));
    const actual = Math.round(rows.filter(t => t.type === 'expense' && t.date.slice(0, 7) === monthISO).reduce((sum, t) => sum + transactionEUR(t), 0) * 100) / 100;
    for (const day of origins) {
      const date = `${monthISO}-${String(day).padStart(2, '0')}`;
      // No future-dated transactions or today's recurring configuration enter retrospective training.
      const known = rows.filter(t => t.date <= date);
      const results = Object.fromEntries(models.map(model => [model, forecastSpending(known, [], [], date, model)]));
      if (Object.values(results).some(f => f.total === null)) continue;
      const predictions = Object.fromEntries(models.map(model => [model, results[model].total]));
      folds.push({ month: monthISO, date, day, actual, predictions, partition: monthISO < '2026-01' ? 'development' : 'holdout-2026' });
    }
    month = addDays(endOfMonth(month), 1);
  }
  const round = value => Math.round(value * 100) / 100;
  const metrics = (subset, model) => {
    if (!subset.length) return { origins: 0, months: 0, mae: null, rmse: null, bias: null, wapePercent: null, winsAgainstBaseline: 0 };
    const errors = subset.map(f => f.predictions[model] - f.actual);
    return { origins: subset.length, months: new Set(subset.map(f => f.month)).size,
      mae: round(errors.reduce((s,e) => s+Math.abs(e),0) / errors.length),
      rmse: round(Math.sqrt(errors.reduce((s,e) => s+e*e,0) / errors.length)),
      bias: round(errors.reduce((s,e) => s+e,0) / errors.length),
      wapePercent: round(100 * errors.reduce((s,e) => s+Math.abs(e),0) / subset.reduce((s,f) => s+f.actual,0)),
      winsAgainstBaseline: subset.filter(f => Math.abs(f.predictions[model]-f.actual) < Math.abs(f.predictions[models[0]]-f.actual)).length,
    };
  };
  const scores = Object.fromEntries(models.map(model => [model, {
    development: metrics(folds.filter(f => f.partition === 'development'), model),
    holdout: metrics(folds.filter(f => f.partition === 'holdout-2026'), model),
    all: metrics(folds, model),
    byDay: Object.fromEntries(origins.map(day => [day, metrics(folds.filter(f => f.partition === 'holdout-2026' && f.day === day), model)])),
  }]));
  const quantile80 = values => values.length >= 12 ? values.sort((a,b)=>a-b)[Math.min(values.length-1,Math.ceil((values.length+1)*0.8)-1)] : null;
  const intervals = Object.fromEntries(models.map(model => {
    const evaluated = [];
    for (const f of folds.filter(f=>f.partition==='holdout-2026')) {
      const past = folds.filter(p=>p.day===f.day && p.month < f.month).slice(-24);
      if (past.length<12) continue;
      const q = quantile80(past.map(p=>Math.abs(p.predictions[model]-p.actual)));
      evaluated.push({ covered: Math.abs(f.predictions[model]-f.actual)<=q, width:2*q });
    }
    const past = folds.filter(f=>f.day===26).slice(-24);
    const error = quantile80(past.map(p=>Math.abs(p.predictions[model]-p.actual)));
    return [model, { nominalCoveragePercent:80, actualHoldoutCoveragePercent:evaluated.length ? round(100*evaluated.filter(f=>f.covered).length/evaluated.length) : null, evaluatedOrigins:evaluated.length,
      currentLower:error === null || current[model].total === null ? null : round(Math.max(current[model].spent+current[model].scheduled, current[model].total-error)), currentUpper:error === null || current[model].total === null ? null : round(current[model].total+error), calibrationMonths:past.length }];
  }));
  // An additional conservative replay respects creation/update timestamps but cannot reconstruct old revisions.
  function localDayEnd(date) {
    const noon = new Date(`${date}T12:00:00Z`);
    const zone = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Rome', timeZoneName: 'shortOffset' }).formatToParts(noon).find(p => p.type === 'timeZoneName').value;
    const offset = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(zone);
    if (!offset) throw Error('Unexpected evaluation timezone offset');
    const minutes = (Number(offset[2]) * 60 + Number(offset[3] ?? 0)) * (offset[1] === '+' ? 1 : -1);
    return Date.parse(`${date}T23:59:59.999Z`) - minutes * 60_000;
  }
  if (localDayEnd('2026-01-26') !== Date.parse('2026-01-26T22:59:59.999Z') || localDayEnd('2026-07-26') !== Date.parse('2026-07-26T21:59:59.999Z')) throw Error('Calendar cutoff regression');
  const conservative = [];
  for (const f of folds.filter(f=>f.partition==='holdout-2026')) {
    const limit = localDayEnd(f.date);
    const known = rows.filter(t=>Date.parse(t.created_at)<=limit && Date.parse(t.updated_at)<=limit);
    const schedules = data.recurringExpenses.filter(r=>Date.parse(r.created_at)<=limit && Date.parse(r.updated_at)<=limit);
    const results = Object.fromEntries(models.map(model=>[model,forecastSpending(known,[],schedules,f.date,model)]));
    if(Object.values(results).some(r=>r.total===null))continue;
    conservative.push({...f,predictions:Object.fromEntries(models.map(model=>[model,results[model].total]))});
  }
  const report = { asOf, snapshotAt:data.extractedAt, inputSha256:crypto.createHash('sha256').update(raw).digest('hex'),
    rows:rows.length, current, scores, intervals, conservativeReplay:Object.fromEntries(models.map(model=>[model,metrics(conservative,model)])),
    method:{lookbackDays:180,halfLifeDays:56,weekdayPriorDays:4,robustMinimumPositiveDays:12,robustMinimumActiveWeeks:8,robustCap:'Q3+3*(Q3-Q1)',origins,
      developmentThrough:'2025-12',holdout:'2026-01 through 2026-09',configurationExcludedFromRetrospective:true,unavailableHistoricalRevisions:true, ordinaryExtraV3:{minPositiveDays:12,minActiveWeekShare:0.5,minCompleteWeeks:8,ordinary:'median full-week spending with half-smoothed weekday profile',extraordinary:'event frequency times average event amount',independentHoldout:false}},
    elapsedMs:round(performance.now()-started),folds };
  fs.writeFileSync(output,`${JSON.stringify(report,null,2)}\n`);
  console.log(JSON.stringify({...report,folds:undefined},null,2));
} finally { await server.close(); }
