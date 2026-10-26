import { expect, it } from 'vitest';
import type { Transaction } from './types';
import { monthlyAnalogueDailyRates } from '../../server/monthly-analogue-spending';
import { forecastSpending } from '../../server/spending-forecast';
import { addDays, parseLocalDate, todayLocalISO } from '../../server/forecast-calendar';
const today = '2026-10-20', date = parseLocalDate(today), start = addDays(date, -180);
const tx = (offset: number, amount: number): Transaction => ({ id: `${offset}-${amount}`, user_id: 'synthetic', type: 'expense',
  amount, currency: 'EUR', exchange_rate_eur: 1, date: todayLocalISO(addDays(start, offset)), category_id: 'food', description: null,
  deleted_at: null, created_at: '', updated_at: '' });
it('preserves constant daily spending across different month lengths', () => {
  const input = Array.from({ length: 181 }, (_, i) => tx(i, 10));
  const candidate = forecastSpending(input, [], [], today, 'monthly-analogue-v4');
  expect(candidate.total).toBe(310); expect(candidate.spent).toBe(200); expect(candidate.variable).toBe(110);
  expect(candidate.points.at(-1)?.projected).toBe(candidate.total);
});
it('falls back exactly to v1 when there are fewer than three comparable full months', () => {
  const input = Array.from({ length: 58 }, (_, i) => tx(i + 123, i % 2 ? 10 : 0));
  expect(monthlyAnalogueDailyRates(input, addDays(date, -57), date)).toBeNull();
  expect(forecastSpending(input, [], [], today, 'monthly-analogue-v4')).toEqual(forecastSpending(input, [], [], today));
});
it('never trains on future, deleted or income transactions and does not mutate inputs', () => {
  const input = Array.from({ length: 181 }, (_, i) => tx(i, 10)), before = JSON.stringify(input);
  const noisy = [...input, tx(220, 9999), { ...tx(160, 1e6), type: 'income' as const }, { ...tx(161, 1e6), deleted_at: '2026-01-01' }];
  expect(monthlyAnalogueDailyRates(noisy, start, date)).toEqual(monthlyAnalogueDailyRates(input, start, date));
  expect(forecastSpending([...input, tx(220, 99999)], [], [], today, 'monthly-analogue-v4')).toEqual(forecastSpending(input, [], [], today, 'monthly-analogue-v4'));
  expect(JSON.stringify(input)).toBe(before);
});
it('substitutes planned expense for the same category and day without double counting', () => {
  const input = Array.from({ length: 181 }, (_, i) => tx(i, 10));
  const candidate = forecastSpending([...input, tx(181, 100)], [], [], today, 'monthly-analogue-v4');
  expect(candidate.scheduled).toBe(100); expect(candidate.variable).toBe(100); expect(candidate.total).toBe(400);
});
it('keeps zero histories and completed months finite', () => {
  const input = Array.from({ length: 181 }, (_, i) => tx(i, 0));
  expect(forecastSpending(input, [], [], today, 'monthly-analogue-v4').total).toBe(0);
  const end = '2026-10-31';
  expect(forecastSpending(input, [], [], end, 'monthly-analogue-v4').variable).toBe(0);
});
