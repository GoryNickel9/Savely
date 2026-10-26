import { expect, it } from 'vitest';
import type { Transaction } from './types';
import { forecastSpending } from '../../server/spending-forecast';
import { ordinaryExtraDailyRates } from '../../server/ordinary-extra-spending';
import { addDays, parseLocalDate, todayLocalISO } from '../../server/forecast-calendar';
const today = '2026-10-20', date = parseLocalDate(today), start = addDays(date, -180);
const tx = (offset: number, amount: number, category = 'food'): Transaction => ({ id: `${offset}-${amount}-${category}`, user_id: 'synthetic',
  type: 'expense', amount, currency: 'EUR', exchange_rate_eur: 1, date: todayLocalISO(addDays(start, offset)), category_id: category,
  description: null, deleted_at: null, created_at: '', updated_at: '' });

it('preserves constant ordinary spending and financial accounting', () => {
  const input = Array.from({ length: 181 }, (_, i) => tx(i, 10));
  const candidate = forecastSpending(input, [], [], today, 'ordinary-extra-v3');
  expect(candidate.total).toBe(310); expect(candidate.spent).toBe(200); expect(candidate.variable).toBe(110);
  expect(candidate.segmentation?.ordinary).toBe(110); expect(candidate.segmentation?.extraordinary).toBe(0);
  expect(candidate.segmentation?.categories[0].kind).toBe('ordinary');
  expect(candidate.points.at(-1)?.projected).toBe(candidate.total);
});
it('estimates rare-event frequency rather than assuming an entire purchase will recur', () => {
  const input = [tx(0, 0), tx(167, 600)];
  const rates = ordinaryExtraDailyRates(input, start, date);
  const category = rates.categories[0];
  expect(category.kind).toBe('occasional'); expect(category.observedOrdinary).toBe(0);
  expect(category.extraordinaryDaily).toBeCloseTo(600 / 180, 12);
  expect(category.ordinaryDaily.every(value => value === 0)).toBe(true);
  const candidate = forecastSpending(input, [], [], today, 'ordinary-extra-v3');
  expect(candidate.spent).toBe(600); expect(candidate.variable).toBe(36.67); expect(candidate.total).toBe(636.67);
});
it('separates excess amounts without dropping actual expense or mutating the input', () => {
  const input = Array.from({ length: 25 }, (_, i) => tx(i * 7, i === 24 ? 600 : 10));
  const before = JSON.stringify(input);
  const category = ordinaryExtraDailyRates(input, start, date).categories[0];
  expect(category.kind).toBe('ordinary'); expect(category.observedExtraordinary).toBe(570);
  expect(category.ordinaryDaily.reduce((sum, value) => sum + value, 0)).toBeCloseTo(10, 12);
  expect(category.observedOrdinary + category.observedExtraordinary).toBe(840);
  expect(JSON.stringify(input)).toBe(before);
  const candidate = forecastSpending([...input, tx(180, 1000)], [], [], today, 'ordinary-extra-v3');
  expect(candidate.spent).toBe(forecastSpending([...input, tx(180, 1000)], [], [], today).spent);
});
it('classifies each forecast using only the past and ignores deleted or income rows', () => {
  const past = [tx(170, 10)];
  const future = Array.from({ length: 30 }, (_, i) => tx(180 + i, 10));
  expect(ordinaryExtraDailyRates([...past, ...future, { ...tx(1, 999), deleted_at: '2026-01-01' }, { ...tx(2, 999), type: 'income' }], start, date))
    .toEqual(ordinaryExtraDailyRates(past, start, date));
  const base = [tx(0, 0), ...past];
  expect(forecastSpending([...base, tx(220, 99999)], [], [], today, 'ordinary-extra-v3'))
    .toEqual(forecastSpending(base, [], [], today, 'ordinary-extra-v3'));
});
it('includes zero-spend weeks and requires frequent complete weeks for ordinary classification', () => {
  const concentrated = Array.from({ length: 12 }, (_, i) => tx(i, 10));
  const category = ordinaryExtraDailyRates(concentrated, start, date).categories[0];
  expect(category.activeWeeks).toBeLessThan(13); expect(category.kind).toBe('occasional');
  expect(category.extraordinaryDaily).toBeCloseTo(120 / 180, 12);
  const zero = ordinaryExtraDailyRates([tx(1, 0)], start, date).categories[0];
  expect(zero.extraordinaryDaily).toBe(0); expect(zero.ordinaryDaily.every(value => value === 0)).toBe(true);
  expect(ordinaryExtraDailyRates([], date, date).rates.size).toBe(0);
});
it('replaces both components with committed spending without double counting', () => {
  const base = Array.from({ length: 180 }, (_, i) => tx(i, 10));
  const candidate = forecastSpending([...base, tx(181, 100)], [], [], today, 'ordinary-extra-v3');
  expect(candidate.scheduled).toBe(100); expect(candidate.variable).toBe(100);
  expect(candidate.segmentation!.ordinary + candidate.segmentation!.extraordinary).toBe(candidate.variable);
  expect(candidate.total).toBe(390);
});
it('converts historical FX consistently and maintains the minimum-history guard', () => {
  const usd = Array.from({ length: 180 }, (_, i) => ({ ...tx(i, 10), currency: 'USD' as const, exchange_rate_eur: 0.9 }));
  const eur = Array.from({ length: 180 }, (_, i) => tx(i, 9));
  expect(ordinaryExtraDailyRates(usd, start, date)).toEqual(ordinaryExtraDailyRates(eur, start, date));
  expect(forecastSpending([tx(170, 10)], [], [], today, 'ordinary-extra-v3').total).toBeNull();
});

it('keeps spent, scheduled and component totals valid across deterministic mixed-category archives', () => {
  let seed = 97231;
  const random = (max: number) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % max; };
  for (let sample = 0; sample < 40; sample++) {
    const input = [tx(0, 0), ...Array.from({ length: 80 }, (_, index) => ({ ...tx(random(192), random(60000) / 100, String(random(5))), id: `row-${index}` }))];
    const before = JSON.stringify(input), baseline = forecastSpending(input, [], [], today);
    const candidate = forecastSpending(input, [], [], today, 'ordinary-extra-v3');
    expect(candidate.spent).toBe(baseline.spent); expect(candidate.scheduled).toBe(baseline.scheduled);
    expect(candidate.total).toBeGreaterThanOrEqual(candidate.spent + candidate.scheduled - 0.005);
    expect(candidate.segmentation!.ordinary).toBeGreaterThanOrEqual(0);
    expect(candidate.segmentation!.extraordinary).toBeGreaterThanOrEqual(0);
    expect(candidate.segmentation!.ordinary + candidate.segmentation!.extraordinary).toBeCloseTo(candidate.variable, 2);
    expect(candidate.total).toBeCloseTo(candidate.spent + candidate.scheduled + candidate.variable, 2);
    expect(JSON.stringify(input)).toBe(before);
    expect(forecastSpending(input, [], [], today, 'ordinary-extra-v3')).toEqual(candidate);
  }
});
