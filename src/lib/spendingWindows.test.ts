import { describe, expect, it } from 'vitest';
import { budgetSpending } from '../../server/budget-spending';
import { forecastSpending } from '../../server/spending-forecast';
import { budgetSpendingSchema } from './forecastContract';
import { getBudgetReferenceSpending } from './budgetSpending';
import { generateInsights } from './insights';
import { spendingWindow } from './spendingWindow';
import type { Budget, Category, Transaction } from './types';

const asOf = '2026-11-01';
const categories = ['regular', 'occasional'].map((spending_pattern, index) => ({ id: `c${index}`, name: spending_pattern,
  type: 'expense', spending_pattern, deleted_at: null }) as Category);
const budgets = categories.map((category, index) => ({ id: `b${index}`, category_id: category.id, category,
  amount: index ? 15 : 25, currency: 'EUR' }) as Budget);
const tx = (id: string, date: string, amount: number, category_id: string | null = 'c0', extra = {}) => ({
  id, date, amount, category_id, type: 'expense', currency: 'EUR', exchange_rate_eur: 1, deleted_at: null, description: null, ...extra,
}) as Transaction;
const rows = [tx('coverage', '2024-01-01', 0, null, { type: 'income' }), tx('old-regular', '2026-05-04', 900),
  tx('boundary-regular', '2026-05-05', 70), tx('current', asOf, 140), tx('boundary-occasional', '2024-11-01', 250, 'c1'),
  tx('current-occasional', asOf, 250, 'c1'), tx('old-occasional', '2024-10-31', 1000, 'c1'),
  tx('future', '2026-11-02', 900), tx('deleted', asOf, 900, 'c0', { deleted_at: asOf })];

describe('shared 180/730-day monthly means', () => {
  it('uses exact rolling boundaries and observed zero/current months for each classification', () => {
    const result = budgetSpending(rows, budgets, categories, asOf);
    expect(budgetSpendingSchema.parse(result)).toEqual(result);
    expect(result.categories.find(row => row.categoryId === 'c0')).toMatchObject({ historyDays: 180, startDate: '2026-05-05', months: 7,
      total: '210.00', averageMonthly: '30.00', exceeded: true, over: '5.00' });
    expect(result.categories.find(row => row.categoryId === 'c1')).toMatchObject({ historyDays: 730, startDate: '2024-11-01', months: 25,
      total: '500.00', averageMonthly: '20.00', exceeded: true, over: '5.00' });
  });
  it('returns the same references and overrun decisions to Budget and Insights', () => {
    const result = budgetSpending(rows, budgets, categories, asOf);
    expect(budgets.map(budget => getBudgetReferenceSpending(budget, rows, result))).toEqual([30, 20]);
    const signals = generateInsights({ transactions: rows, budgets, categories, budgetSpending: result,
      openAssets: [], netWorthHistory: [], referenceDate: new Date(2026, 10, 1) }).filter(row => row.kind === 'budget_exceeded');
    expect(signals).toHaveLength(2);
    for (const signal of signals) expect(signal.value).toBe(5);
    expect(signals.find(row => row.categoryId === 'c0')?.message).toContain('180');
    expect(signals.find(row => row.categoryId === 'c1')?.message).toContain('730');
  });
  it('uses available account coverage, recorded FX and exact half-cent rounding', () => {
    const result = budgetSpending([tx('coverage', '2026-10-01', 0, null, { type: 'income' }), tx('cent', asOf, .01)], [], categories, asOf);
    expect(result.categories.find(row => row.categoryId === 'c0')).toMatchObject({ months: 2, averageMonthly: '0.01' });
    expect(budgetSpendingSchema.parse(result)).toEqual(result);
    const fx = budgetSpending([tx('fx', asOf, 100, 'c1', { currency: 'USD', exchange_rate_eur: .9 })], [], categories, asOf);
    expect(fx.categories.find(row => row.categoryId === 'c1')).toMatchObject({ months: 1, averageMonthly: '90.00' });
  });
  it('rejects tampered windows, means, duplicate categories and stale references', () => {
    const result = budgetSpending(rows, budgets, categories, asOf);
    for (const change of [{ historyDays: 730 }, { averageMonthly: '29.99' }, { exceeded: false }, { months: 6 }, { startDate: '2020-01-01' }]) {
      const changed = structuredClone(result); Object.assign(changed.categories.find(row => row.categoryId === 'c0')!, change);
      expect(() => budgetSpendingSchema.parse(changed)).toThrow();
    }
    expect(() => generateInsights({ transactions: rows, budgets, categories, budgetSpending: { ...result, endDate: '2026-10-31' },
      openAssets: [], netWorthHistory: [], referenceDate: new Date(2026, 10, 1) })).toThrow();
    expect(() => budgetSpending(rows, [budgets[0], budgets[0]], categories, asOf)).toThrow('Duplicate');
  });
  it('keeps recorded spending whole and uses 730-day occasional variable history in the forecast', () => {
    const history = [tx('coverage', '2024-01-01', 0, null, { type: 'income' }), tx('ordinary-old', '2026-05-04', 900),
      tx('occasional', '2025-01-01', 250, 'c1'), tx('current', asOf, 100, 'c1')];
    const forecast = forecastSpending(history, [], [], asOf, categories, 'regular180-occasional730-mean-v3');
    expect(forecast).toMatchObject({ historyDays: 730, spent: 100, variable: 9.67, total: 109.67 });
    expect(forecast.categories?.find(row => row.categoryId === 'c0')).toBeUndefined();
    expect(forecast.categories?.find(row => row.categoryId === 'c1')).toMatchObject({ spent: 100, variable: 9.67, total: 109.67 });
    expect(forecastSpending(history, [], [], asOf, [], 'weekday-history-mean-v2').variable).toBe(0);
  });
  it('handles leap days, empty and future-only histories and unsafe inputs', () => {
    expect(spendingWindow([], [], '2028-02-29', 730)).toMatchObject({ months: 1, averageMonthly: 0 });
    expect(spendingWindow([], [{ date: '2029-01-01' }], '2028-02-29', 180).months).toBe(1);
    expect(() => spendingWindow([{ date: asOf, amount: NaN }], [], asOf, 180)).toThrow();
    expect(() => spendingWindow([], [], '2026-02-30', 180)).toThrow();
  });
});
