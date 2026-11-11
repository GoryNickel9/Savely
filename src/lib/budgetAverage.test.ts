import { expect, it } from 'vitest';
import type { Transaction } from './types';
import { getAverageMonthlySpending } from './budgetSpending';
import { getAverageMonthlySpendingShared } from './coupleExpenses';

const referenceDate = new Date(2026, 10, 15);
const tx = (date: string, amount: number, extra: Partial<Transaction> = {}): Transaction => ({
  id: date, user_id: 'u', type: 'expense', category_id: 'food', amount, currency: 'EUR', exchange_rate_eur: 1,
  date, description: null, created_at: date, updated_at: date, deleted_at: null, ...extra,
});

it('averages monthly totals rather than individual payments or their median, including zero months', () => {
  const transactions = [tx('2026-08-05', 40), tx('2026-08-10', 60), tx('2026-10-10', 1000), tx('2026-11-10', 100),
    tx('2026-09-10', 50, { category_id: 'other' }), tx('2026-11-20', 99999), tx('2020-01-01', 99999, { deleted_at: '2020-01-02' })];
  expect(getAverageMonthlySpending({ transactions, categoryId: 'food', referenceDate })).toBe(300);
  expect(getAverageMonthlySpending({ transactions, categoryId: 'other', referenceDate })).toBe(12.5);
  expect(getAverageMonthlySpending({ transactions, referenceDate })).toBe(312.5);
  expect(getAverageMonthlySpending({ transactions, excludeCategoryIds: new Set(['food']), referenceDate })).toBe(12.5);
});

it('limits existing coverage to 180 calendar days without discarding zero months inside the window', () => {
  const transactions = [tx('2020-01-01', 90000), tx('2026-11-10', 250)];
  expect(getAverageMonthlySpending({ transactions, referenceDate })).toBe(250 / 7); // May through November: seven observed calendar buckets.
});

it('converts to EUR before averaging and rejects non-finite amounts', () => {
  expect(getAverageMonthlySpending({ transactions: [tx('2026-11-01', 100, { currency: 'USD', exchange_rate_eur: 0.9 })], referenceDate })).toBe(90);
  expect(() => getAverageMonthlySpending({ transactions: [tx('2026-11-01', NaN)], referenceDate })).toThrow();
  expect(getAverageMonthlySpending({ transactions: [tx('2027-01-01', 100)], referenceDate })).toBe(0);
});

it('averages family shares over the same covered months for every category', () => {
  const expenses = [
    { date: '2026-08-05', my_share_amount: 40, couple_category_name: 'Cibo', tx_deleted_at: null },
    { date: '2026-08-10', my_share_amount: 60, couple_category_name: 'Cibo', tx_deleted_at: null },
    { date: '2026-10-10', my_share_amount: 1000, couple_category_name: 'Cibo', tx_deleted_at: null },
    { date: '2026-11-10', my_share_amount: 100, couple_category_name: 'Cibo', tx_deleted_at: null },
    { date: '2026-09-10', my_share_amount: 50, couple_category_name: 'Casa', tx_deleted_at: null },
    { date: '2026-11-20', my_share_amount: 99999, couple_category_name: 'Cibo', tx_deleted_at: null },
  ];
  expect(getAverageMonthlySpendingShared(expenses, 'Cibo', referenceDate)).toBe(300);
  expect(getAverageMonthlySpendingShared(expenses, 'Casa', referenceDate)).toBe(12.5);
  expect(getAverageMonthlySpendingShared(expenses, undefined, referenceDate)).toBe(312.5);
});
