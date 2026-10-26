import { describe, expect, it } from 'vitest';
import { forecastSpending, type RecurringExpense } from '../../server/spending-forecast';
import type { Budget, Category, Transaction } from './types';
import { decodeForecast } from './forecastContract';
import fixture from '../test/fixtures/occasional-forecast.json';

const category: Category = { id: 'dentist', user_id: 'u', name: 'Dentista', type: 'expense', spending_pattern: 'occasional',
  icon: '', color: '', created_at: '', deleted_at: null };
const asOf = '2026-10-26';
const tx = (date: string, amount: number, extra: Partial<Transaction> = {}): Transaction => ({ id: `${date}-${amount}`,
  user_id: 'u', type: 'expense', category_id: 'dentist', amount, currency: 'EUR', exchange_rate_eur: 1,
  date, description: null, deleted_at: null, created_at: '', updated_at: '', ...extra });
const rows = ['2025-11-01', '2026-05-15', asOf].map(date => tx(date, 100));
const marker = tx('2025-11-01', 0, { type: 'income', category_id: null });
const run = (transactions = rows, date = asOf, recurring: RecurringExpense[] = []) => forecastSpending(transactions, [], recurring, date, [category]);

describe('occasional spending forecast', () => {
  it('uses 300 / 12 / 31 * 5 for the future and preserves the complete 100 EUR already paid', () => {
    const result = run();
    expect(result).toMatchObject({ spent: 100, variable: 4.03, scheduled: 0, total: 104.03 });
    const regular = forecastSpending(rows, [], [], asOf);
    expect(result.spent).toBe(regular.spent);
    expect(result.points.map(point => point.actual)).toEqual(regular.points.map(point => point.actual));
    expect(result.variable).not.toBe(regular.variable);
    expect(result.points.at(-1)?.projected).toBe(104.03);
  });
  it('includes zero months without shrinking the fixed divisor when payments are rare', () => {
    expect(run([marker, tx(asOf, 100)])).toMatchObject({ spent: 100, variable: 1.34, total: 101.34 });
    expect(run([marker])).toMatchObject({ spent: 0, variable: 0, total: 0 });
  });
  it('never learns from future, deleted, income, other-category or out-of-window transactions', () => {
    const extra = [tx('2025-10-31', 9999), tx('2026-11-01', 9999), tx(asOf, 9999, { deleted_at: asOf }),
      tx(asOf, 9999, { type: 'income' })];
    expect(run([...rows, ...extra])).toEqual(run());
    // Other categories still contribute to real spending, but not the dentist's annual average.
    expect(run([...rows, tx(asOf, 200, { category_id: 'other' })])).toMatchObject({ spent: 300, variable: 4.03, total: 304.03 });
  });
  it('future planned payments replace the remaining category expectation across the month', () => {
    expect(run([...rows, tx('2026-10-30', 100)])).toMatchObject({ spent: 100, scheduled: 100, variable: 0, total: 200 });
    expect(run([...rows, tx('2026-10-30', 1)])).toMatchObject({ spent: 100, scheduled: 1, variable: 3.03, total: 104.03 });
    expect(run([...rows, tx('2026-10-27', 1), tx('2026-10-30', 1)])).toMatchObject({ scheduled: 2, variable: 2.03, total: 104.03 });
  });
  it('does not infer recurring payments for categories explicitly marked occasional', () => {
    const subscriptions = ['06', '07', '08', '09'].map(month => tx(`2026-${month}-25`, 100, { description: 'Dentist' }));
    expect(run([marker, ...subscriptions], '2026-10-20')).toMatchObject({ scheduled: 0, variable: 11.83 });
    expect(forecastSpending([marker, ...subscriptions], [], [], '2026-10-20').scheduled).toBe(100);
  });
  it('honors configured recurrences, excluding their payments from the occasional baseline', () => {
    const recurring: RecurringExpense = { id: 'r', name: 'Dentist', category_id: 'dentist', amount: 100, currency: 'EUR',
      frequency: 'monthly', next_due_date: '2026-10-30', is_active: true };
    const previous = ['08', '09'].map(month => tx(`2026-${month}-30`, 100, { description: 'Dentist' }));
    expect(run([marker, ...previous], asOf, [recurring])).toMatchObject({ spent: 0, scheduled: 100, variable: 0, total: 100 });
    expect(run([marker, ...previous, tx(asOf, 100, { description: 'Dentist' })], asOf, [recurring]))
      .toMatchObject({ spent: 100, scheduled: 0, variable: 0, total: 100 });
    expect(run([marker, ...previous, tx('2026-10-30', 100, { description: 'Dentist' })], asOf, [recurring]))
      .toMatchObject({ scheduled: 100, variable: 0, total: 100 });
  });
  it('keeps the regular-category forecast unchanged in mixed categories and preserves sum and chart invariants', () => {
    const regular = [tx('2026-04-01', 0, { type: 'income' }), tx('2026-09-10', 30, { category_id: 'food' })];
    const baseline = forecastSpending(regular, [], [], asOf);
    const mixed = run([...regular, ...rows]);
    expect(mixed.spent).toBe(100 + baseline.spent);
    // Round the combined unrounded expectations, not the already rounded 1.15 EUR subtotal.
    expect(baseline.variable).toBe(1.15);
    expect(mixed.variable).toBe(5.19);
    expect(mixed.total).toBeCloseTo(mixed.spent + mixed.scheduled + mixed.variable, 2);
    const values = mixed.points.flatMap(point => point.projected === null ? [] : [point.projected]);
    expect(values.every((value, i) => i === 0 || value >= values[i - 1])).toBe(true);
    expect(run([...rows].reverse())).toEqual(run());
  });
  it('respects month lengths, leap day and month-end with no remaining forecast', () => {
    const leap = [tx('2027-03-01', 348)];
    expect(run(leap, '2028-02-20')).toMatchObject({ spent: 0, variable: 9, total: 9 });
    expect(run(leap, '2028-02-29')).toMatchObject({ variable: 0, total: 0 });
    expect(run(rows, '2026-10-31')).toMatchObject({ spent: 100, variable: 0, total: 100 });
  });
  it('uses recorded FX and retains insufficient-history guards without averaging actual spending', () => {
    expect(run([marker, tx(asOf, 100, { currency: 'USD', exchange_rate_eur: 0.9 })]))
      .toMatchObject({ spent: 90, variable: 1.21, total: 91.21 });
    expect(run([tx(asOf, 100)])).toMatchObject({ spent: 100, variable: 0, total: null, available: false });
  });
  it('matches the independent cent-exact reference fixture decoded by both web and Android', () => {
    const decoded = decodeForecast(fixture.response, fixture.response.userId, 'Europe/Rome');
    const actual = forecastSpending(fixture.input.transactions as Transaction[], fixture.input.budgets as Budget[], [], asOf,
      fixture.input.categories as Category[]);
    expect(actual).toEqual(decoded.forecast);
  });
});
