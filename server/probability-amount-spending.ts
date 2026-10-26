import type { Transaction } from '../src/lib/types.js';
import { transactionEUR } from '../src/lib/spendingForecast.js';
import { addDays, differenceInCalendarDays, endOfMonth, parseLocalDate, todayLocalISO } from './forecast-calendar.js';
import { dateSeed, quantile, randomGenerator, type SimulationPoint } from './forecast-simulation.js';

export const PROBABILITY_AMOUNT_SAMPLES = 4096;
export const PROBABILITY_AMOUNT_SEED = 0x5a172027;
export const PROBABILITY_PRIOR_DAYS = 28;
export const WEEKDAY_PROBABILITY_PRIOR = 4;
export const LOG_AMOUNT_PRIOR_EVENTS = 4;
export const LOG_VARIANCE_PRIOR_EVENTS = 8;
export interface HurdleCategory {
  categoryId: string | null; positiveDays: number; probability: number; weekdayProbabilities: number[];
  logAmountMean: number; logAmountVariance: number;
}
export interface HurdleFit { days: number; pooledProbability: number; pooledLogMean: number; pooledLogVariance: number; categories: HurdleCategory[] }

/** Positive daily totals, not individual purchases: each category has one Bernoulli trial per day. */
export function fitProbabilityAmount(historical: Transaction[], historyStart: Date, today: Date): HurdleFit {
  const days = differenceInCalendarDays(today, historyStart);
  if (!Number.isFinite(days) || days <= 0) throw new Error('Invalid hurdle calendar');
  const daily = new Map<string | null, Map<string, number>>();
  for (const row of historical) {
    if (row.deleted_at || row.type !== 'expense') continue;
    const date = parseLocalDate(row.date);
    if (!Number.isFinite(date.getTime())) throw new Error('Invalid hurdle transaction date');
    if (date < historyStart || date >= today) continue;
    const amount = Math.round(transactionEUR(row) * 100);
    if (!Number.isSafeInteger(amount)) throw new Error('Hurdle amount overflow');
    if (amount === 0) continue;
    const values = daily.get(row.category_id) ?? new Map<string, number>();
    const sum = (values.get(row.date) ?? 0) + amount;
    if (!Number.isSafeInteger(sum)) throw new Error('Hurdle amount overflow');
    values.set(row.date, sum); daily.set(row.category_id, values);
  }
  // Sorting keeps summation and PRNG/category order stable when input rows are reordered.
  const observed = [...daily].sort(([a], [b]) => a === b ? 0 : a === null ? -1 : b === null ? 1 : a < b ? -1 : 1).map(([categoryId, values]) => {
    const records = [...values].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([date, amount]) => ({ date, log: Math.log(amount) }));
    const mean = records.reduce((sum, value) => sum + value.log, 0) / records.length;
    return { categoryId, records, mean, ss: records.reduce((sum, value) => sum + (value.log - mean) ** 2, 0) };
  });
  const events = observed.reduce((sum, c) => sum + c.records.length, 0);
  const pooledProbability = observed.length ? events / (days * observed.length) : 0;
  const pooledLogMean = events ? observed.reduce((sum, c) => sum + c.records.length * c.mean, 0) / events : 0;
  const degrees = events - observed.length;
  // If no category has repeated positive days, use a fixed factor-two log standard deviation.
  const pooledLogVariance = degrees > 0 ? observed.reduce((sum, c) => sum + c.ss, 0) / degrees : Math.log(2) ** 2;
  const weekdayDays = Array<number>(7).fill(0);
  for (let date = historyStart; date < today; date = addDays(date, 1)) weekdayDays[date.getUTCDay()]++;
  const categories = observed.map(c => {
    const n = c.records.length, weekdayEvents = Array<number>(7).fill(0);
    c.records.forEach(record => weekdayEvents[parseLocalDate(record.date).getUTCDay()]++);
    const probability = (n + PROBABILITY_PRIOR_DAYS * pooledProbability) / (days + PROBABILITY_PRIOR_DAYS);
    return { categoryId: c.categoryId, positiveDays: n, probability,
      weekdayProbabilities: weekdayEvents.map((events, weekday) => (events + WEEKDAY_PROBABILITY_PRIOR * probability) / (weekdayDays[weekday] + WEEKDAY_PROBABILITY_PRIOR)),
      logAmountMean: (n * c.mean + LOG_AMOUNT_PRIOR_EVENTS * pooledLogMean) / (n + LOG_AMOUNT_PRIOR_EVENTS),
      logAmountVariance: (c.ss + LOG_VARIANCE_PRIOR_EVENTS * pooledLogVariance) / (Math.max(0, n - 1) + LOG_VARIANCE_PRIOR_EVENTS) };
  });
  return { days, pooledProbability, pooledLogMean, pooledLogVariance, categories };
}

/** Offline hurdle model: independent category/day events, lognormal positive daily amount. */
export function probabilityAmountRemainder(
  historical: Transaction[], historyStart: Date, today: Date, plannedVariable: Transaction[],
  samples = PROBABILITY_AMOUNT_SAMPLES, seed = PROBABILITY_AMOUNT_SEED,
): { samples: number; seed: number; fit: HurdleFit; points: SimulationPoint[] } {
  if (!Number.isInteger(samples) || samples < 128 || samples > 65536 || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Invalid hurdle simulation parameters');
  const fit = fitProbabilityAmount(historical, historyStart, today);
  const random = randomGenerator(dateSeed(seed, todayLocalISO(today)));
  const dates: { date: string; weekday: number }[] = [];
  for (let date = addDays(today, 1); date <= endOfMonth(today); date = addDays(date, 1)) dates.push({ date: todayLocalISO(date), weekday: date.getUTCDay() });
  const commitments = new Map<string, Map<string | null, number>>();
  for (const row of plannedVariable) {
    if (row.deleted_at || row.type !== 'expense' || parseLocalDate(row.date) <= today || parseLocalDate(row.date) > endOfMonth(today)) continue;
    const categories = commitments.get(row.date) ?? new Map<string | null, number>();
    const amount = (categories.get(row.category_id) ?? 0) + Math.round(transactionEUR(row) * 100);
    if (!Number.isSafeInteger(amount)) throw new Error('Hurdle amount overflow');
    categories.set(row.category_id, amount); commitments.set(row.date, categories);
  }
  const cumulative = dates.map(() => Array<number>(samples).fill(0));
  for (let path = 0; path < samples; path++) {
    let total = 0;
    dates.forEach(({ date, weekday }, index) => {
      for (const category of fit.categories) {
        if (random() >= category.weekdayProbabilities[weekday]) continue;
        const normal = category.logAmountVariance === 0 ? 0 : Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
        const amount = Math.max(1, Math.round(Math.exp(category.logAmountMean + Math.sqrt(category.logAmountVariance) * normal)));
        if (!Number.isSafeInteger(amount)) throw new Error('Hurdle amount overflow');
        total += Math.max(0, amount - (commitments.get(date)?.get(category.categoryId) ?? 0));
        if (!Number.isSafeInteger(total)) throw new Error('Hurdle amount overflow');
      }
      cumulative[index][path] = total;
    });
  }
  return { samples, seed, fit, points: dates.map(({ date }, index) => {
    const values = cumulative[index].sort((a, b) => a - b);
    return { date, median: quantile(values, 0.5) / 100, lower80: quantile(values, 0.1) / 100, upper80: quantile(values, 0.9) / 100,
      mean: values.reduce((sum, value) => sum + value / samples, 0) / 100 };
  }) };
}
