import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer } from 'vite';

// Read-only evidence audit. Freeze committed model sources, excluding parallel worktree changes.
const base = path.resolve('.vercel/forecast-evaluation');
const destination = path.join(base, 'independent-validation-20261026');
const manifestFile = path.join(destination, 'FROZEN_PROTOCOL.json');
assert(!fs.existsSync(manifestFile), 'A frozen protocol must not be overwritten');
const digest = data => crypto.createHash('sha256').update(data).digest('hex');
const raw = fs.readFileSync(path.join(base, 'private-dataset.json'), 'utf8').replace(/^\uFEFF/, '');
const envelope = JSON.parse(raw), data = envelope.rows?.[0]?.dataset ?? envelope;
const reference = JSON.parse(fs.readFileSync(path.join(base, 'v8-comparison-7-14-21-28.json'), 'utf8'));
assert.equal(digest(raw), reference.inputSha256);
const live = JSON.parse(fs.readFileSync(path.join(destination, 'current-audit.json'), 'utf8').replace(/^\uFEFF/, '')).rows[0].audit;
assert.equal(live.targetCount, 1);
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const files = [
  'server/spending-forecast.ts', 'server/forecast-calendar.ts', 'server/recent-spending.ts',
  'server/ordinary-extra-spending.ts', 'server/monthly-analogue-spending.ts', 'server/pace-spending.ts',
  'server/weekly-bootstrap-spending.ts', 'server/probability-amount-spending.ts',
  'server/forecast-simulation.ts', 'server/forecast-combination.ts',
  'src/lib/spendingForecast.ts', 'src/lib/recurringDetection.ts', 'src/lib/types.ts',
  'package.json', 'package-lock.json',
];
const sourceRoot = path.join(destination, 'frozen-source');
const hashes = {};
for (const file of files) {
  const content = execFileSync('git', ['show', `${sourceCommit}:${file}`], { maxBuffer: 10_000_000 });
  const target = path.join(sourceRoot, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, { flag: 'wx' }); hashes[file] = digest(content);
}
const archive = execFileSync('git', ['archive', '--format=zip', sourceCommit, '--', ...files], { maxBuffer: 10_000_000 });
fs.writeFileSync(path.join(destination, 'frozen-model-source.zip'), archive, { flag: 'wx' });
const used = new Set(reference.method.months);
const closed = live.months.map(m => m.month).filter(month => month < '2026-10');
const unused = closed.filter(month => !used.has(month));
const server = await createServer({ root: sourceRoot, configFile: false, server: { middlewareMode: true, watch: null }, optimizeDeps: { noDiscovery: true }, appType: 'custom' });
const probes = [];
try {
  const { forecastSpending } = await server.ssrLoadModule('/server/spending-forecast.ts');
  const { equalWeightForecastTotal } = await server.ssrLoadModule('/server/forecast-combination.ts');
  for (const month of unused) for (const day of [7, 14, 21, 28]) {
    const date = `${month}-${String(day).padStart(2, '0')}`;
    const known = data.transactions.filter(t => !t.deleted_at && t.date <= date);
    const current = forecastSpending(known, [], [], date);
    const weekly = forecastSpending(known, [], [], date, 'weekly-block-bootstrap-v6');
    const combined = current.total === null || weekly.total === null ? null : equalWeightForecastTotal(current.total, weekly.total);
    const reason = combined === null ? 'insufficient-history' : weekly.bootstrap.fallback ? 'weekly-falls-back-to-baseline' : 'usable';
    if (reason === 'weekly-falls-back-to-baseline') assert.equal(combined, current.total);
    probes.push({ date, historyDays: current.historyDays, available: combined !== null, reason });
  }
} finally { await server.close(); }
const recent = reference.folds.filter(f => f.month >= '2026-01');
const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
const monthDeltas = reference.method.months.filter(month => month >= '2026-01').map(month => ({ month,
  delta: mean(recent.filter(f => f.month === month).map(f => Math.abs(f.predictions['equal-current-weekly-v8'] - f.actual) - Math.abs(f.predictions['weekday-history-v1'] - f.actual))) }));
const sensitivity = monthDeltas.map(excluded => ({ excludedMonth: excluded.month, meanMaeDelta: mean(monthDeltas.filter(m => m !== excluded).map(m => m.delta)) }));
const independentOrigins = probes.filter(p => p.reason === 'usable');
const models = ['weekday-history-v1', 'recent-weekday-v2', 'robust-recent-weekday-v2', 'ordinary-extra-v3',
  'monthly-analogue-v4', 'pace-shrink-v5', 'weekly-block-bootstrap-v6', 'probability-amount-v7'];
const blends = [[1, 4], [2, 5], [9, 20], [1, 2], [11, 20], [3, 5], [3, 4]];
const protocol = {
  frozenAt: new Date().toISOString(), sourceCommit, sourceHashes: hashes, archiveSha256: digest(archive),
  node: process.version, candidate: 'equal-current-weekly-v8', baseline: 'weekday-history-v1',
  candidateWeights: [0.5, 0.5], registeredModels: models, registeredBlendFractions: blends,
  origins: [7, 14, 21, 28], tuningAllowed: false, newWeightsAllowed: false,
  inputSha256: digest(raw), historicalMonthsAlreadyUsed: [...used].sort(),
  independentValidationCompleted: false, liveAuditAt: live.auditedAt,
  currentUsableUnseenOrigins: independentOrigins.length,
  dataChoice: 'awaiting user choice: same-account future snapshots or specifically authorized unseen account',
  sameAccountPlan: { pilot: '2026-10-28 (diagnostic only)', firstFullMonth: '2026-11',
    primaryPeriod: ['2026-11', '2027-07'], months: 9, expectedOrigins: 36,
    requires: 'Actual timestamped snapshots before monthly outcome is known; no retrospective recreation or optional stopping' },
  unseenAccountPlan: { requires: 'User-provided account identity and authorization; not previously used in model selection',
    primaryMonths: 'Latest nine completed eligible months selected by date/availability before examining amounts' },
  primaryMetric: 'MAE of monthly total, equal origin weights; matched comparisons',
  secondaryMetrics: ['RMSE', 'bias', 'per-origin MAE', 'monthly errors'],
  uncertainty: 'Paired monthly blocks, report intervals and adjust comparisons against all registered rivals; nine blocks may remain inconclusive',
  conclusionRule: 'No best-model claim from a lower sample MAE alone; require independent matched evidence and account for multiple comparisons',
  missingOrigins: 'Record all failures and reasons; do not selectively discard poor outcomes',
  collectionScheduled: false, backendChanged: false, otherAccountsRead: false,
};
const audit = { auditedAt: protocol.frozenAt, historicalScoredMonths: used.size, liveClosedMonths: closed.length,
  unseenClosedMonths: unused, initialPeriodProbes: probes, newUsableUnseenOrigins: independentOrigins.length,
  omittedMonthSensitivity: sensitivity, sensitivityIsIndependentValidation: false,
  independentValidationCompleted: false, conclusion: independentOrigins.length ? 'Unseen eligible origins require complete authorized data before evaluation' : 'No usable independent completed-month holdout on the authorized account today' };
fs.writeFileSync(manifestFile, `${JSON.stringify(protocol, null, 2)}\n`, { flag: 'wx' });
fs.writeFileSync(path.join(destination, 'INDEPENDENCE_AUDIT.json'), `${JSON.stringify(audit, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ sourceCommit, scoredMonths: used.size, closedMonths: closed.length, unseenMonths: unused,
  probes, usableIndependentOrigins: independentOrigins.length,
  omittedMonthMaeDeltaRange: [Math.min(...sensitivity.map(p => p.meanMaeDelta)), Math.max(...sensitivity.map(p => p.meanMaeDelta))],
  independentValidationCompleted: false, frozenProtocol: manifestFile }, null, 2));
