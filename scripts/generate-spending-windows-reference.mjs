import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const server = await createServer({ root, configFile: false, resolve: { alias: { '@': `${root}src` } },
  server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true } });
try {
  const { budgetSpending } = await server.ssrLoadModule('/server/budget-spending.ts');
  const { forecastSpending } = await server.ssrLoadModule('/server/spending-forecast.ts');
  const { forecastResponseSchema } = await server.ssrLoadModule('/src/lib/forecastContract.ts');
  const { generateInsights } = await server.ssrLoadModule('/src/lib/insights.ts');
  const categories = ['regular', 'occasional'].map((spending_pattern, index) => ({ id: `c${index}`, name: `Category ${index}`, type: 'expense', spending_pattern, deleted_at: null }));
  const budgets = categories.map((category, index) => ({ id: `b${index}`, category_id: category.id, category, amount: index ? 15 : 25, currency: 'EUR' }));
  const tx = (id, date, amount, category_id = 'c0', extra = {}) => ({ id, date, amount, category_id, type: 'expense', currency: 'EUR', exchange_rate_eur: 1, description: null, deleted_at: null, ...extra });
  const transactions = [tx('coverage', '2024-01-01', 0, null, { type: 'income' }), tx('old-regular', '2026-05-04', 900),
    tx('boundary-regular', '2026-05-05', 70), tx('current', '2026-11-01', 140), tx('boundary-occasional', '2024-11-01', 250, 'c1'),
    tx('current-occasional', '2026-11-01', 250, 'c1'), tx('old-occasional', '2024-10-31', 1000, 'c1'),
    tx('future', '2026-11-02', 900), tx('deleted', '2026-11-01', 900, 'c0', { deleted_at: '2026-11-01' })];
  const cases = [
    { name: 'rolling-boundaries', date: '2026-11-01', transactions, categories, budgets },
    { name: 'classification-change', date: '2026-11-01', transactions, categories: categories.map(c => ({ ...c, spending_pattern: c.spending_pattern === 'regular' ? 'occasional' : 'regular' })), budgets },
    { name: 'half-cent-and-fx', date: '2026-11-01', transactions: [tx('coverage', '2026-10-01', 0, null, { type: 'income' }), tx('cent', '2026-11-01', .01), tx('fx', '2026-11-01', 100, 'c1', { currency: 'USD', exchange_rate_eur: .9 })], categories, budgets: [] },
    { name: 'leap-day', date: '2028-02-29', transactions: [tx('coverage', '2020-01-01', 0, null, { type: 'income' }), tx('leap', '2028-02-29', 250, 'c1'), tx('past', '2026-03-01', 250, 'c1')], categories, budgets },
    { name: 'empty', date: '2026-11-01', transactions: [], categories, budgets },
  ];
  const money = value => value === null ? null : value.toFixed(2);
  for (const row of cases) {
    row.budgets = row.budgets.map(budget => ({ ...budget, category: row.categories.find(category => category.id === budget.category_id) }));
    const f = forecastSpending(row.transactions, row.budgets, [], row.date, 'regular180-occasional730-mean-v3', row.categories);
    const forecast = { ...f, ...Object.fromEntries(['spent', 'scheduled', 'variable', 'total'].map(key => [key, money(f[key])])),
      budget: f.budget && { limit: money(f.budget.limit) },
      categories: f.categories?.map(c => ({ ...c, ...Object.fromEntries(['spent', 'scheduled', 'variable', 'total'].map(key => [key, money(c[key])])), budget: c.budget && { limit: money(c.budget.limit) } })),
      points: f.points.map(p => ({ ...p, actual: money(p.actual), projected: money(p.projected) })) };
    const averages = budgetSpending(row.transactions, row.budgets, row.categories, row.date);
    row.response = forecastResponseSchema.parse({ schemaVersion: 2, modelVersion: 'regular180-occasional730-mean-v3',
      userId: '11111111-1111-4111-8111-111111111111', timeZone: 'Europe/Rome', generatedAt: `${row.date}T12:00:00Z`, inputSha256: 'a'.repeat(64), budgetSpending: averages, forecast });
    row.insights = generateInsights({ ...row, budgetSpending: averages, openAssets: [], netWorthHistory: [], referenceDate: new Date(`${row.date}T00:00:00`) })
      .map(({ id, kind, severity }) => ({ id, kind, severity }));
  }
  assert.deepEqual(cases[0].response.budgetSpending.categories.map(c => c.averageMonthly), ['30.00', '20.00']);
  const text = `${JSON.stringify({ model: 'regular180-occasional730-mean-v3', cases }, null, 2)}\n`;
  await writeFile(new URL('../src/test/fixtures/spending-windows.json', import.meta.url), text);
  await writeFile(new URL('../../Savely-Android/app/src/test/resources/spending-windows.json', import.meta.url), text);
  await writeFile(new URL('../../Savely-Android/app/src/androidTest/assets/spending-windows.json', import.meta.url), text);
  console.log(`Generated and validated ${cases.length} shared window cases.`);
} finally { await server.close(); }
