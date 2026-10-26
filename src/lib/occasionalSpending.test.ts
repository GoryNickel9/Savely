import { describe, expect, it } from 'vitest';
import { occasionalSpending } from '../../server/occasional-spending';
import type { Budget, Category, Transaction } from './types';
import { generateInsights } from './insights';
import { getBudgetReferenceSpending } from './budgetSpending';
import { occasionalSpendingSchema } from './forecastContract';

const category: Category = { id: 'dentist', user_id: 'u', name: 'Dentista', type: 'expense', icon: '', color: '',
  spending_pattern: 'occasional', created_at: '', deleted_at: null };
const budget: Budget = { id: 'b', user_id: 'u', category_id: 'dentist', amount: 25, currency: 'EUR',
  month: 1, year: 2000, created_at: '', updated_at: '', category };
const tx = (date: string, amount: number, overrides: Partial<Transaction> = {}): Transaction => ({
  id: date, user_id: 'u', category_id: 'dentist', type: 'expense', amount, currency: 'EUR', exchange_rate_eur: 1,
  date, description: null, created_at: '', updated_at: '', deleted_at: null, ...overrides,
});
const asOf = '2026-10-26';
const transactions = ['2025-11-01', '2026-05-15', '2026-10-26'].map(date => tx(date, 100));
const run = (rows = transactions, budgets = [budget], categories = [category], date = asOf) => occasionalSpending(rows, budgets, categories, date);
const insights = (rows = transactions, remote = run(rows)) => generateInsights({ transactions: rows, budgets: [budget], categories: [category],
  openAssets: [], netWorthHistory: [], referenceDate: new Date(2026, 9, 26), occasionalSpending: remote });

describe('server-owned occasional budget comparison', () => {
  it('divides three 100 EUR payments by all 12 months, including nine zero months', () => {
    const result = run();
    expect(result).toMatchObject({ startDate: '2025-11-01', endDate: asOf, months: 12,
      categories: [{ total: '300.00', averageMonthly: '25.00', expectedMonthly: '25.00', exceeded: false }] });
    expect(occasionalSpendingSchema.parse(result)).toEqual(result);
    expect(getBudgetReferenceSpending(budget, transactions, result)).toBe(25);
    expect(insights()).toEqual([]);
  });
  it('reports an overrun from the average even when the current month has zero spending', () => {
    const rows = [tx('2026-05-01', 360)];
    expect(run(rows).categories[0]).toMatchObject({ averageMonthly: '30.00', exceeded: true, over: '5.00' });
    expect(insights(rows).find(signal => signal.kind === 'budget_exceeded')).toMatchObject({ value: 5 });
    expect(insights(rows)[0].message).toContain('12 mesi');
    expect(insights(rows)[0].message).not.toContain('Sono inclusi i mesi a zero');
  });
  it('keeps the fixed divisor with sparse history and excludes old, future, deleted, income and unrelated rows', () => {
    const rows = [tx(asOf, 100), tx('2025-10-31', 900), tx('2026-10-27', 900), tx(asOf, 900, { deleted_at: asOf }),
      tx(asOf, 900, { type: 'income' }), tx(asOf, 900, { category_id: 'other' })];
    expect(run(rows).categories[0]).toMatchObject({ total: '100.00', averageMonthly: '8.33', exceeded: false });
    expect(run([]).categories[0].averageMonthly).toBe('0.00');
  });
  it('uses historical FX, calendar boundaries, leap years and integer-cent totals', () => {
    expect(run([tx(asOf, 120, { currency: 'USD', exchange_rate_eur: 0.8 })]).categories[0].averageMonthly).toBe('8.00');
    expect(run([tx('2028-02-29', 120), tx('2027-03-01', 120), tx('2027-02-28', 999)], [budget], [category], '2028-02-29'))
      .toMatchObject({ startDate: '2027-03-01', categories: [{ total: '240.00', averageMonthly: '20.00' }] });
    expect(run([tx(asOf, 0.1), tx(asOf, 0.2)]).categories[0].total).toBe('0.30');
  });
  it('rejects invalid data, duplicate budgets and unsafe totals; leaves foreign budgets unsupported', () => {
    expect(() => run([], [budget, budget])).toThrow('Duplicate');
    expect(() => run([tx('2026-02-30', 1)])).toThrow();
    expect(() => run([tx(asOf, Number.MAX_VALUE)])).toThrow();
    expect(() => run([], [{ ...budget, amount: NaN }])).toThrow();
    expect(run(transactions, [{ ...budget, currency: 'USD' }]).categories[0]).toMatchObject({ expectedMonthly: null, exceeded: false });
    expect(run(transactions, [budget], [{ ...category, spending_pattern: 'regular' }]).categories).toEqual([]);
  });
  it('requires the backend result and never substitutes a local average or zero', () => {
    expect(getBudgetReferenceSpending(budget, transactions)).toBeNull();
    expect(() => generateInsights({ transactions, budgets: [budget], categories: [category], openAssets: [], netWorthHistory: [],
      referenceDate: new Date(2026, 9, 26) })).toThrow('comparison unavailable');
    expect(getBudgetReferenceSpending({ ...budget, amount: 30 }, transactions, run())).toBeNull();
    expect(() => insights(transactions, { ...run(), endDate: '2026-10-25' })).toThrow('comparison unavailable');
  });
  it('suppresses monthly anomaly and trend detectors for explicitly occasional categories', () => {
    const rows = [tx('2026-01-01', 0), ...['07', '08', '09'].map(month => tx(`2026-${month}-10`, 50)), tx('2026-10-10', 100)];
    expect(insights(rows)).toEqual([]);
    const regularCategory = { ...category, spending_pattern: 'regular' as const };
    const regular = generateInsights({ transactions: rows, categories: [regularCategory], budgets: [{ ...budget, category: regularCategory }],
      openAssets: [], netWorthHistory: [], referenceDate: new Date(2026, 9, 26) });
    expect(regular.some(signal => signal.kind === 'budget_exceeded')).toBe(true);
  });
});
