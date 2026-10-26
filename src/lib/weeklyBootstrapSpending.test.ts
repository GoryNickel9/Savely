import { expect, it } from 'vitest';
import type { Transaction } from './types';
import { forecastSpending } from '../../server/spending-forecast';
import { weeklyBootstrapRemainder } from '../../server/weekly-bootstrap-spending';
import { addDays, parseLocalDate, todayLocalISO } from '../../server/forecast-calendar';

const today = parseLocalDate('2026-10-20'), start = addDays(today, -180);
const tx = (date: Date, amount: number, category: string | null = 'food'): Transaction => ({
  id: `${todayLocalISO(date)}-${amount}-${category}`, user_id: 'synthetic', type: 'expense',
  amount, currency: 'EUR', exchange_rate_eur: 1, date: todayLocalISO(date), category_id: category,
  description: null, deleted_at: null, created_at: '', updated_at: '',
});
const constant = () => Array.from({ length: 181 }, (_, i) => tx(addDays(start, i), 10));
it('preserves constant daily spending, cents, and the unchanged default model', () => {
  const rows = constant();
  const result = forecastSpending(rows, [], [], '2026-10-20', 'weekly-block-bootstrap-v6');
  expect(result.total).toBe(310); expect(result.variable).toBe(110);
  expect(result.bootstrap).toMatchObject({ weeks: 25, samples: 4096, fallback: false });
  expect(result.points.at(-1)?.projected).toBe(result.total);
  expect(forecastSpending(rows, [], [], '2026-10-20')).toEqual(forecastSpending(rows, [], [], '2026-10-20', 'weekday-history-v1'));
  expect(forecastSpending(rows, [], [], '2026-10-20').bootstrap).toBeUndefined();
});
it('takes the median after aggregating a whole week, retaining joint category dependence', () => {
  const origin = parseLocalDate('2026-05-24'), first = addDays(origin, -104);
  const rows = Array.from({ length: 14 }, (_, week) => tx(addDays(first, week * 7 + week % 7), 70, week % 2 ? 'a' : 'b'));
  const result = weeklyBootstrapRemainder(rows, first, origin, [])!;
  // Each donor week has one payment on a rotating weekday; each day's marginal median is zero.
  expect(result.points.at(-1)).toMatchObject({ date: '2026-05-31', median: 70, lower80: 70, upper80: 70, mean: 70 });
});
it('does not use incomplete weeks, today or future expenses in historical donors', () => {
  const rows = constant().slice(0, -1);
  const result = weeklyBootstrapRemainder(rows, start, today, []);
  // Monday Oct 19 belongs to an incomplete donor week at the Tuesday origin.
  expect(weeklyBootstrapRemainder([...rows, tx(addDays(today, -1), 99999), tx(today, 99999), tx(addDays(today, 1), 99999)], start, today, [])).toEqual(result);
});
it('is reproducible without mutating input or depending on transaction order', () => {
  const rows = constant(), original = JSON.stringify(rows);
  const a = weeklyBootstrapRemainder(rows, start, today, []);
  expect(weeklyBootstrapRemainder([...rows].reverse(), start, today, [])).toEqual(a);
  expect(JSON.stringify(rows)).toBe(original);
});
it('preserves known recurrence and substitutes planned variable spending path by path', () => {
  const rows = [...constant(), tx(addDays(today, 1), 100)];
  const recurring = [{ id: 'rent', name: 'Rent', category_id: 'rent', amount: 500, currency: 'EUR', frequency: 'monthly', next_due_date: '2026-10-21', is_active: true }];
  const result = forecastSpending(rows, [], recurring, '2026-10-20', 'weekly-block-bootstrap-v6');
  expect(result.spent).toBe(200); expect(result.scheduled).toBe(600); expect(result.variable).toBe(100); expect(result.total).toBe(900);
  const baseline = forecastSpending(rows, [], recurring, '2026-10-20');
  expect(result.spent).toBe(baseline.spent); expect(result.scheduled).toBe(baseline.scheduled);
  const onlyCommitment = weeklyBootstrapRemainder([], start, today, [tx(addDays(today, 1), 100)])!;
  expect(onlyCommitment.points.every(p => p.median === 0)).toBe(true);
});
it('falls back to v1 with fewer than eight complete weeks and preserves unavailable history', () => {
  const short = [tx(addDays(today, -56), 10), tx(today, 20)];
  const actual = forecastSpending(short, [], [], '2026-10-20', 'weekly-block-bootstrap-v6');
  const { bootstrap, ...forecast } = actual;
  expect(bootstrap?.fallback).toBe(true); expect(forecast).toEqual(forecastSpending(short, [], [], '2026-10-20'));
  expect(forecastSpending([tx(today, 20)], [], [], '2026-10-20', 'weekly-block-bootstrap-v6').total).toBeNull();
});
it('handles leap month end with no future days and keeps nonnegative monotone quantiles', () => {
  const date = parseLocalDate('2024-02-29'), first = addDays(date, -180);
  expect(weeklyBootstrapRemainder([], first, date, [])?.points).toEqual([]);
  const rows = constant().map((row, i) => ({ ...row, amount: i % 9 === 0 ? 100 : 0 }));
  const points = weeklyBootstrapRemainder(rows, start, today, [])!.points;
  points.forEach((p, i) => {
    expect(p.lower80).toBeGreaterThanOrEqual(0); expect(p.median).toBeGreaterThanOrEqual(p.lower80); expect(p.upper80).toBeGreaterThanOrEqual(p.median);
    if (i) expect(p.median).toBeGreaterThanOrEqual(points[i - 1].median);
  });
});
it('rejects invalid simulation parameters and unsafe accumulated amounts', () => {
  expect(() => weeklyBootstrapRemainder([], start, today, [], 0)).toThrow('Invalid bootstrap parameters');
  expect(() => weeklyBootstrapRemainder([], start, today, [], 128, -1)).toThrow('Invalid bootstrap parameters');
  expect(() => weeklyBootstrapRemainder([tx(addDays(today, -10), 1e20)], start, today, [])).toThrow('Bootstrap amount overflow');
});
