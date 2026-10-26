import type { Transaction } from '../src/lib/types.js';
import { transactionEUR } from '../src/lib/spendingForecast.js';
import { addDays, differenceInCalendarDays, parseLocalDate, todayLocalISO } from './forecast-calendar.js';

const MIN_ORDINARY_DAYS = 12;
const ACTIVE_WEEK_SHARE = 0.5;
function quantile(sorted: number[], fraction: number): number {
  const at = (sorted.length - 1) * fraction, low = Math.floor(at), part = at - low;
  return sorted[low] * (1 - part) + sorted[Math.ceil(at)] * part;
}
export interface ExpenseSegmentation {
  categoryId: string | null;
  kind: 'ordinary' | 'occasional';
  positiveDays: number;
  activeWeeks: number;
  observedOrdinary: number;
  observedExtraordinary: number;
  ordinaryDaily: number[];
  extraordinaryDaily: number;
}
export interface SegmentedRates {
  rates: Map<string | null, number[]>;
  categories: ExpenseSegmentation[];
}

/** Receives only non-recurring historical expenses; never edits or drops actual spending. */
export function ordinaryExtraDailyRates(transactions: Transaction[], historyStart: Date, today: Date): SegmentedRates {
  const count = differenceInCalendarDays(today, historyStart);
  const weeks = Math.floor(count / 7);
  if (count <= 0) return { rates: new Map(), categories: [] };
  const amounts = new Map<string | null, Map<string, number>>();
  for (const tx of transactions) {
    if (tx.type !== 'expense' || tx.deleted_at) continue;
    const day = parseLocalDate(tx.date);
    if (day < historyStart || day >= today) continue;
    const category = amounts.get(tx.category_id) ?? new Map<string, number>();
    category.set(tx.date, (category.get(tx.date) ?? 0) + transactionEUR(tx));
    amounts.set(tx.category_id, category);
  }
  const days = Array.from({ length: count }, (_, index) => {
    const date = addDays(historyStart, index);
    return { iso: todayLocalISO(date), weekday: date.getUTCDay(), block: Math.floor((count - 1 - index) / 7) };
  });
  const weekdayCounts = Array<number>(7).fill(0);
  days.forEach(day => weekdayCounts[day.weekday]++);
  const categories: ExpenseSegmentation[] = [];
  const rates = new Map<string | null, number[]>();
  for (const [categoryId, daily] of amounts) {
    const positive = [...daily.values()].filter(value => value > 0).sort((a, b) => a - b);
    const activeWeeks = new Set(days.filter(day => day.block < weeks && (daily.get(day.iso) ?? 0) > 0).map(day => day.block)).size;
    const ordinary = positive.length >= MIN_ORDINARY_DAYS && weeks >= 8 && activeWeeks >= Math.ceil(weeks * ACTIVE_WEEK_SHARE);
    let cap = 0;
    if (ordinary) {
      const median = quantile(positive, 0.5), q1 = quantile(positive, 0.25), q3 = quantile(positive, 0.75);
      cap = Math.round(Math.max(3 * median, q3 + 3 * (q3 - q1)) * 100) / 100;
    }
    const weekly = Array<number>(weeks).fill(0), weekdayTotals = Array<number>(7).fill(0);
    let observedOrdinary = 0, observedExtraordinary = 0;
    for (const day of days) {
      const amount = daily.get(day.iso) ?? 0, regular = Math.min(amount, cap);
      observedOrdinary += regular; observedExtraordinary += amount - regular;
      weekdayTotals[day.weekday] += regular;
      if (day.block < weeks) weekly[day.block] += regular;
    }
    const typicalWeek = ordinary ? quantile(weekly.sort((a, b) => a - b), 0.5) : 0;
    const weekdayMeans = weekdayTotals.map((sum, day) => weekdayCounts[day] ? sum / weekdayCounts[day] : 0);
    const weekdayMean = weekdayMeans.reduce((sum, value) => sum + value, 0) / 7;
    const ordinaryDaily = weekdayMeans.map(value => typicalWeek / 7 * (weekdayMean > 0 ? 0.5 + 0.5 * value / weekdayMean : 1));
    // Event probability * mean event size equals total extra / observed calendar days.
    const extraordinaryDaily = observedExtraordinary / count;
    categories.push({ categoryId, kind: ordinary ? 'ordinary' : 'occasional', positiveDays: positive.length, activeWeeks,
      observedOrdinary, observedExtraordinary, ordinaryDaily, extraordinaryDaily });
    rates.set(categoryId, ordinaryDaily.map(value => value + extraordinaryDaily));
  }
  return { rates, categories };
}
