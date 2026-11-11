import { expect, it } from 'vitest';
import { categoryForecasts, type CategoryAmounts } from '../../server/category-forecast';

it('allocates fractional cents deterministically without changing any published total', () => {
  const amounts = new Map<string | null, CategoryAmounts>(['c', 'b', 'a'].map(id => [id, { spent: 0.01, scheduled: 0.014, variable: 0.004 }]));
  const totals = { spent: 0.03, scheduled: 0.042, variable: 0.012 };
  const rows = categoryForecasts(amounts, new Map(), totals, true);
  expect(rows.map(row => [row.categoryId, row.scheduled, row.variable, row.total])).toEqual([
    ['a', 0.02, 0.01, 0.04], ['b', 0.01, 0, 0.02], ['c', 0.01, 0, 0.02],
  ]);
  expect(categoryForecasts(new Map([...amounts].reverse()), new Map(), totals, true)).toEqual(rows);
});
it('reconciles many tiny categories and preserves unknown totals', () => {
  const amounts = new Map(Array.from({ length: 100 }, (_, index) => [String(index), { spent: 0, scheduled: 0, variable: 0.004 }]));
  const rows = categoryForecasts(amounts, new Map(), { spent: 0, scheduled: 0, variable: 0.4 }, false);
  expect(rows.reduce((sum, row) => sum + Math.round(row.variable * 100), 0)).toBe(40);
  expect(rows.every(row => row.total === null)).toBe(true);
});
