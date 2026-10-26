import type { Transaction } from '../src/lib/types.js';
import { transactionEUR } from '../src/lib/spendingForecast.js';
import { addDays, parseLocalDate, todayLocalISO, differenceInCalendarDays } from './forecast-calendar.js';

export type ForecastModel = 'weekday-history-v1' | 'recent-weekday-v2' | 'robust-recent-weekday-v2' | 'ordinary-extra-v3';
export const RECENT_HALF_LIFE_DAYS = 56;
export const WEEKDAY_PRIOR_DAYS = 4;

function quantile(sorted: number[], fraction: number): number {
  const index = (sorted.length - 1) * fraction;
  const lower = Math.floor(index), weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[Math.ceil(index)] * weight;
}

/** Variable expenses only. Zero-spend days remain observations; observed spending is never altered. */
export function recentDailyRates(transactions: Transaction[], historyStart: Date, today: Date, robust: boolean): Map<string | null, number[]> {
  const daily = new Map<string | null, Map<string, number>>();
  for (const row of transactions) {
    const category = daily.get(row.category_id) ?? new Map<string, number>();
    category.set(row.date, (category.get(row.date) ?? 0) + transactionEUR(row));
    daily.set(row.category_id, category);
  }
  const days: { iso: string; weekday: number; weight: number }[] = [];
  const weekdayWeights = Array<number>(7).fill(0);
  let weightTotal = 0;
  for (let date = historyStart; date < today; date = addDays(date, 1)) {
    const age = differenceInCalendarDays(today, date);
    const weight = 2 ** (-(age - 1) / RECENT_HALF_LIFE_DAYS);
    days.push({ iso: todayLocalISO(date), weekday: date.getUTCDay(), weight });
    weekdayWeights[date.getUTCDay()] += weight; weightTotal += weight;
  }
  const result = new Map<string | null, number[]>();
  for (const [category, amounts] of daily) {
    const positive = [...amounts.values()].filter(value => value > 0).sort((a, b) => a - b);
    const activeWeeks = new Set([...amounts.keys()].map(date => Math.floor(differenceInCalendarDays(parseLocalDate(date), historyStart) / 7))).size;
    // A sparse category cannot establish whether a large payment is exceptional.
    let cap = Infinity;
    if (robust && positive.length >= 12 && activeWeeks >= 8) {
      const q1 = quantile(positive, 0.25), q3 = quantile(positive, 0.75);
      cap = q3 + 3 * (q3 - q1);
    }
    const sums = Array<number>(7).fill(0); let total = 0;
    for (const day of days) {
      const value = Math.min(amounts.get(day.iso) ?? 0, cap) * day.weight;
      sums[day.weekday] += value; total += value;
    }
    const dailyMean = weightTotal > 0 ? total / weightTotal : 0;
    result.set(category, sums.map((sum, weekday) => (sum + WEEKDAY_PRIOR_DAYS * dailyMean) / (weekdayWeights[weekday] + WEEKDAY_PRIOR_DAYS)));
  }
  return result;
}
