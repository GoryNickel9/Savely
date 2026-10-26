import { expect, it } from 'vitest';
import type { Transaction } from './types';
import { forecastSpending } from '../../server/spending-forecast';
import { paceDailyRates } from '../../server/pace-spending';
import { addDays, parseLocalDate, todayLocalISO } from '../../server/forecast-calendar';
const today = '2026-10-20', date = parseLocalDate(today), start = addDays(date, -180);
const tx = (offset: number, amount: number, category = 'food'): Transaction => ({ id: `${offset}-${amount}-${category}`, user_id: 'synthetic', type: 'expense',
  amount, currency: 'EUR', exchange_rate_eur: 1, date: todayLocalISO(addDays(start, offset)), category_id: category,
  description: null, deleted_at: null, created_at: '', updated_at: '' });
it('keeps constant daily expense unchanged', () => {
  const input = Array.from({ length: 181 }, (_, i) => tx(i, 10));
  expect(forecastSpending(input, [], [], today, 'pace-shrink-v5').total).toBe(310);
});
it('shrinks the observed current-month pace with 28 days of historical prior', () => {
  const input = [tx(0, 0), tx(180, 480, 'new')];
  const rates = paceDailyRates(input, start, date).get('new')!;
  expect(rates).toEqual(Array<number>(7).fill(10));
  const result = forecastSpending(input, [], [], today, 'pace-shrink-v5');
  expect(result.spent).toBe(480); expect(result.variable).toBe(110); expect(result.total).toBe(590);
});
it('does not use future transactions or modify source rows', () => {
  const input = Array.from({ length: 181 }, (_, i) => tx(i, 10)), source = JSON.stringify(input);
  expect(forecastSpending([...input, tx(220, 99999)], [], [], today, 'pace-shrink-v5')).toEqual(forecastSpending(input, [], [], today, 'pace-shrink-v5'));
  expect(JSON.stringify(input)).toBe(source);
});
it('keeps planned spending substitution and insufficient-history errors', () => {
  const input = Array.from({ length: 181 }, (_, i) => tx(i, 10));
  const result = forecastSpending([...input, tx(181, 100)], [], [], today, 'pace-shrink-v5');
  expect(result.scheduled).toBe(100); expect(result.variable).toBe(100); expect(result.total).toBe(400);
  expect(forecastSpending([tx(170, 10)], [], [], today, 'pace-shrink-v5').total).toBeNull();
});
