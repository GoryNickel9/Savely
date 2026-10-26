import type { Transaction } from '../src/lib/types.js';
import { transactionEUR } from '../src/lib/spendingForecast.js';
import { addDays, endOfMonth, parseLocalDate, todayLocalISO } from './forecast-calendar.js';

export const WEEKLY_BOOTSTRAP_SAMPLES = 4096;
export const WEEKLY_BOOTSTRAP_SEED = 0x5a172026;
export const MIN_BOOTSTRAP_WEEKS = 8;
export interface BootstrapPoint { date: string; median: number; lower80: number; upper80: number; mean: number }
export interface WeeklyBootstrap { weeks: number; samples: number; seed: number; points: BootstrapPoint[] }

function quantile(sorted: number[], fraction: number): number {
  const position = (sorted.length - 1) * fraction, low = Math.floor(position), weight = position - low;
  return sorted[low] * (1 - weight) + sorted[Math.ceil(position)] * weight;
}
function randomGenerator(seed: number): () => number {
  let state = seed >>> 0;
  // Mulberry32: fixed integer arithmetic, reproducible across Node and browser runtimes.
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Offline candidate. Samples whole joint category vectors, never medians per day/category. */
export function weeklyBootstrapRemainder(
  historical: Transaction[], historyStart: Date, today: Date, plannedVariable: Transaction[],
  samples = WEEKLY_BOOTSTRAP_SAMPLES, seed = WEEKLY_BOOTSTRAP_SEED,
): WeeklyBootstrap | null {
  if (!Number.isInteger(samples) || samples < 128 || samples > 65536 || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Invalid bootstrap parameters');
  if (!Number.isFinite(historyStart.getTime()) || !Number.isFinite(today.getTime()) || historyStart > today) throw new Error('Invalid bootstrap calendar');
  // Complete calendar weeks only; no synthetic zeros outside the observed window.
  const firstMonday = addDays(historyStart, (8 - historyStart.getUTCDay()) % 7);
  const starts: Date[] = [];
  for (let start = firstMonday; addDays(start, 7) <= today; start = addDays(start, 7)) starts.push(start);
  if (starts.length < MIN_BOOTSTRAP_WEEKS) return null;
  const amounts = new Map<string, Map<string | null, number>>();
  const add = (target: Map<string, Map<string | null, number>>, row: Transaction) => {
    const categories = target.get(row.date) ?? new Map<string | null, number>();
    categories.set(row.category_id, (categories.get(row.category_id) ?? 0) + Math.round(transactionEUR(row) * 100));
    target.set(row.date, categories);
  };
  for (const row of historical) if (!row.deleted_at && row.type === 'expense' && parseLocalDate(row.date) >= historyStart && parseLocalDate(row.date) < today) add(amounts, row);
  const commitments = new Map<string, Map<string | null, number>>();
  for (const row of plannedVariable) if (!row.deleted_at && row.type === 'expense' && parseLocalDate(row.date) > today && parseLocalDate(row.date) <= endOfMonth(today)) add(commitments, row);
  const weeks = starts.map(start => Array.from({ length: 7 }, (_, day) => amounts.get(todayLocalISO(addDays(start, day))) ?? new Map<string | null, number>()));
  const dates: Date[] = [];
  for (let date = addDays(today, 1); date <= endOfMonth(today); date = addDays(date, 1)) dates.push(date);
  let dateSeed = seed >>> 0;
  for (const char of todayLocalISO(today)) dateSeed = Math.imul(dateSeed ^ char.charCodeAt(0), 16777619) >>> 0;
  const random = randomGenerator(dateSeed);
  const cumulative = dates.map(() => Array<number>(samples).fill(0));
  for (let path = 0; path < samples; path++) {
    let donor = 0, total = 0;
    dates.forEach((date, index) => {
      if (index === 0 || date.getUTCDay() === 1) donor = Math.floor(random() * weeks.length);
      const committed = commitments.get(todayLocalISO(date));
      for (const [category, amount] of weeks[donor][(date.getUTCDay() + 6) % 7]) total += Math.max(0, amount - (committed?.get(category) ?? 0));
      if (!Number.isSafeInteger(total)) throw new Error('Bootstrap amount overflow');
      cumulative[index][path] = total;
    });
  }
  return { weeks: weeks.length, samples, seed, points: dates.map((date, index) => {
    const values = cumulative[index].sort((a, b) => a - b);
    const mean = values.reduce((sum, value) => sum + value, 0) / samples / 100;
    return { date: todayLocalISO(date), median: quantile(values, 0.5) / 100,
      lower80: quantile(values, 0.1) / 100, upper80: quantile(values, 0.9) / 100, mean };
  }) };
}
