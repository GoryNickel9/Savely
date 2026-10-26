import { expect, it } from 'vitest';
import { forecastSpending } from '../../server/spending-forecast';
import { recentDailyRates } from '../../server/recent-spending';
import { addDays, parseLocalDate, todayLocalISO } from '../../server/forecast-calendar';
import type { Transaction } from './types';
const today = '2026-10-20';
const date = parseLocalDate(today), start = addDays(date, -180);
const tx = (offset: number, amount: number): Transaction => ({ id: String(offset), user_id: 'synthetic', type: 'expense',
  amount, currency: 'EUR', exchange_rate_eur: 1, date: todayLocalISO(addDays(start, offset)), category_id: 'food',
  description: null, deleted_at: null, created_at: '', updated_at: '' });

it('keeps exact constant daily spending and the existing financial accounting', () => {
  const input = Array.from({ length: 181 }, (_, i) => tx(i, 10));
  const baseline = forecastSpending(input, [], [], today);
  for (const model of ['recent-weekday-v2', 'robust-recent-weekday-v2'] as const) {
    const candidate = forecastSpending(input, [], [], today, model);
    expect(candidate.spent).toBe(baseline.spent); expect(candidate.scheduled).toBe(baseline.scheduled);
    expect(candidate.total).toBe(310); expect(candidate.variable).toBe(110);
    expect(candidate.points.at(-1)?.projected).toBe(candidate.total);
  }
});
it('adapts more quickly to recent changes without using future expenses to train', () => {
  const input = Array.from({ length: 180 }, (_, i) => tx(i, i < 90 ? 1 : 20));
  const baseline = forecastSpending(input, [], [], today);
  const candidate = forecastSpending(input, [], [], today, 'recent-weekday-v2');
  expect(candidate.variable).toBeGreaterThan(baseline.variable);
  expect(candidate.variable).toBeLessThan(220);
  expect(forecastSpending([...input, { ...tx(220, 1e6), id: 'future' }], [], [], today, 'recent-weekday-v2')).toEqual(candidate);
});
it('shrinks sparse weekday patterns towards the category daily rate while retaining zero-spend days', () => {
  const rates = recentDailyRates([tx(170, 100)], start, date, false).get('food')!;
  expect(rates.every(value => value > 0)).toBe(true);
  expect(rates.reduce((s, x) => s + x, 0) / 7).toBeLessThan(2);
  expect(recentDailyRates([tx(170, 100)], start, date, true)).toEqual(recentDailyRates([tx(170, 100)], start, date, false));
});
it('limits only sufficiently observed historical tails and never modifies spending already incurred', () => {
  const input = Array.from({ length: 25 }, (_, i) => tx(i * 7, i === 24 ? 1000 : 10));
  input.push(tx(180, 1000));
  const original = JSON.stringify(input);
  const recent = forecastSpending(input, [], [], today, 'recent-weekday-v2');
  const robust = forecastSpending(input, [], [], today, 'robust-recent-weekday-v2');
  expect(robust.spent).toBe(recent.spent); expect(robust.variable).toBeLessThan(recent.variable);
  expect(JSON.stringify(input)).toBe(original);
});
it('retains the minimum history requirement and rejects unsupported models', () => {
  expect(forecastSpending([tx(170, 10)], [], [], today, 'recent-weekday-v2').total).toBeNull();
  expect(() => forecastSpending([], [], [], today, 'invalid' as never)).toThrow();
});
