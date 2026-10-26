import { expect, it } from 'vitest';
import type { Transaction } from './types';
import { forecastSpending } from '../../server/spending-forecast';
import { fitProbabilityAmount, probabilityAmountRemainder } from '../../server/probability-amount-spending';
import { addDays, parseLocalDate, todayLocalISO } from '../../server/forecast-calendar';

const today = parseLocalDate('2026-10-20'), start = addDays(today, -180);
const tx = (offset: number, amount: number, category: string | null = 'food'): Transaction => ({
  id: `${offset}-${amount}-${category}`, user_id: 'synthetic', type: 'expense', amount, currency: 'EUR', exchange_rate_eur: 1,
  date: todayLocalISO(addDays(start, offset)), category_id: category, description: null, deleted_at: null, created_at: '', updated_at: '',
});
const constant = () => Array.from({ length: 181 }, (_, i) => tx(i, 10));
it('separates category/day occurrence from positive amount and uses explicit shrinkage', () => {
  const rows = [...constant().slice(0, 180), tx(10, 100, 'rare')];
  const fit = fitProbabilityAmount(rows, start, today), rare = fit.categories.find(c => c.categoryId === 'rare')!;
  expect(fit.pooledProbability).toBeCloseTo(181 / 360, 12);
  expect(rare.probability).toBeCloseTo((1 + 28 * (181 / 360)) / 208, 12);
  expect(rare.logAmountMean).toBeCloseTo((Math.log(10000) + 4 * fit.pooledLogMean) / 5, 12);
  expect(rare.logAmountVariance).toBeCloseTo(fit.pooledLogVariance, 12);
  expect(rare.weekdayProbabilities.every(p => p >= 0 && p <= 1)).toBe(true);
  expect(rare.positiveDays).toBe(1);
});
it('groups multiple purchases on one day before fitting amounts and ignores zero expenses', () => {
  const fit = fitProbabilityAmount([tx(1, 4), tx(1, 6), tx(2, 0)], start, today);
  expect(fit.categories[0].positiveDays).toBe(1);
  expect(fit.categories[0].logAmountMean).toBeCloseTo(Math.log(1000), 12);
});
it('preserves constant daily spending and keeps v1 as the unchanged default', () => {
  const rows = constant(), result = forecastSpending(rows, [], [], '2026-10-20', 'probability-amount-v7');
  expect(result.total).toBe(310); expect(result.variable).toBe(110); expect(result.twoPart?.samples).toBe(4096);
  expect(result.points.at(-1)?.projected).toBe(result.total);
  expect(forecastSpending(rows, [], [], '2026-10-20')).toEqual(forecastSpending(rows, [], [], '2026-10-20', 'weekday-history-v1'));
  expect(forecastSpending(rows, [], [], '2026-10-20').twoPart).toBeUndefined();
});
it('simulates the median of the monthly sum and matches the analytical hurdle mean', () => {
  const rows = Array.from({ length: 180 }, (_, i) => tx(i, i % 5 === 0 ? (i % 2 ? 10 : 12) : 0));
  const result = probabilityAmountRemainder(rows, start, today, []);
  const c = result.fit.categories[0];
  const expected = result.points.reduce((sum, point) => sum + c.weekdayProbabilities[parseLocalDate(point.date).getUTCDay()] * Math.exp(c.logAmountMean + c.logAmountVariance / 2) / 100, 0);
  expect(Math.abs(result.points.at(-1)!.mean - expected) / expected).toBeLessThan(0.05);
  expect(result.points.at(-1)!.median).toBeGreaterThan(0);
  result.points.forEach((p, i) => {
    expect(p.lower80).toBeGreaterThanOrEqual(0); expect(p.median).toBeGreaterThanOrEqual(p.lower80); expect(p.upper80).toBeGreaterThanOrEqual(p.median);
    if (i) expect(p.median).toBeGreaterThanOrEqual(result.points[i - 1].median);
  });
});
it('excludes origin/future, deleted rows and income from fitting and is order independent', () => {
  const rows = [...constant(), tx(10, 20, null), tx(40, 40, 'other')];
  const extra = [tx(181, 99999, 'future'), { ...tx(10, 99999), deleted_at: '2026-01-01' }, { ...tx(12, 99999), type: 'income' as const }];
  const original = JSON.stringify(rows), result = probabilityAmountRemainder(rows, start, today, []);
  expect(probabilityAmountRemainder([...rows, ...extra].reverse(), start, today, [])).toEqual(result);
  expect(fitProbabilityAmount([...rows, tx(180, 999999, 'today')], start, today)).toEqual(result.fit);
  expect(JSON.stringify(rows)).toBe(original);
});
it('keeps planned substitution and known recurring commitments identical to v1', () => {
  const rows = [...constant(), tx(181, 100)];
  const recurring = [{ id: 'rent', name: 'Rent', category_id: 'rent', amount: 500, currency: 'EUR', frequency: 'monthly', next_due_date: '2026-10-21', is_active: true }];
  const result = forecastSpending(rows, [], recurring, '2026-10-20', 'probability-amount-v7');
  expect(result.spent).toBe(200); expect(result.scheduled).toBe(600); expect(result.variable).toBe(100); expect(result.total).toBe(900);
  const baseline = forecastSpending(rows, [], recurring, '2026-10-20');
  expect(result.spent).toBe(baseline.spent); expect(result.scheduled).toBe(baseline.scheduled);
});
it('handles zero history, insufficient history, leap years and month end without invented spending', () => {
  expect(probabilityAmountRemainder([], start, today, []).points.every(p => p.median === 0 && p.mean === 0)).toBe(true);
  expect(forecastSpending([tx(180, 20)], [], [], '2026-10-20', 'probability-amount-v7').total).toBeNull();
  const date = parseLocalDate('2024-02-29');
  expect(probabilityAmountRemainder([], addDays(date, -180), date, []).points).toEqual([]);
  const rows = constant();
  expect(forecastSpending(rows, [], [], '2026-10-31', 'probability-amount-v7').total).toBe(forecastSpending(rows, [], [], '2026-10-31').spent);
});
it('uses recorded exchange rates and rejects unsafe amounts and invalid parameters', () => {
  const fit = fitProbabilityAmount([{ ...tx(1, 10), currency: 'USD', exchange_rate_eur: 0.5 }], start, today);
  expect(fit.categories[0].logAmountMean).toBeCloseTo(Math.log(500), 12);
  expect(() => probabilityAmountRemainder([], start, today, [], 0)).toThrow('Invalid hurdle simulation parameters');
  expect(() => fitProbabilityAmount([tx(1, 1e20)], start, today)).toThrow('Hurdle amount overflow');
  expect(() => fitProbabilityAmount([], today, today)).toThrow('Invalid hurdle calendar');
});
