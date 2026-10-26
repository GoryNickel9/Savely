import assert from 'node:assert/strict';
import { cpus, platform, totalmem } from 'node:os';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const server = await createServer({ root, configFile: false, resolve: { alias: { '@': `${root}src` } }, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true } });
try {
  const { forecastSpending } = await server.ssrLoadModule('/server/spending-forecast.ts');
  const { generateInsights } = await server.ssrLoadModule('/src/lib/insights.ts');
  const referenceDate = new Date(2026, 9, 20);
  const model = process.argv[2] ?? 'weekday-history-v1';
  const transactions = [];
  for (let offset = 180; offset >= 0; offset--) {
    const date = new Date(2026, 9, 20 - offset);
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    for (let merchant = 0; merchant < 100; merchant++) transactions.push({
      id: `${iso}-${merchant}`, user_id: 'benchmark', type: 'expense', date: iso, amount: 1,
      currency: 'EUR', exchange_rate_eur: 1, category_id: `category-${merchant % 10}`,
      description: `merchant-${merchant}`, deleted_at: null, created_at: iso, updated_at: iso,
    });
  }
  const run = () => {
    const forecast = forecastSpending(transactions, [], [], '2026-10-20', model);
    assert.equal(forecast.total, 3100);
    assert.equal(forecast.spent, 2000);
    assert.equal(forecast.variable, 1100);
    generateInsights({ transactions, budgets: [], categories: [], openAssets: [], netWorthHistory: [], referenceDate });
  };
  for (let warmup = 0; warmup < 3; warmup++) run();
  const times = [];
  for (let iteration = 0; iteration < 10; iteration++) {
    const start = performance.now(); run(); times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  console.log(JSON.stringify({ benchmark: 'forecast-and-insights', model, transactions: transactions.length, samples: times.length, medianMs: +((times[4] + times[5]) / 2).toFixed(2), maxMs: +times.at(-1).toFixed(2), cpu: cpus()[0]?.model, logicalCPUs: cpus().length, ramGiB: +(totalmem() / 1024 ** 3).toFixed(1), os: platform(), node: process.version, precision: 'float64', seed: 'deterministic fixture', threads: 1 }, null, 2));
} finally {
  await server.close();
}
