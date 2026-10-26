import type { Transaction } from '../src/lib/types.js';
import { transactionEUR } from '../src/lib/spendingForecast.js';
import { addDays, parseLocalDate, todayLocalISO } from './forecast-calendar.js';

const PRIOR_DAYS = 28;
/** Shrink the current calendar-month pace towards the existing weekday estimate. */
export function paceDailyRates(transactions: Transaction[], historyStart: Date, today: Date): Map<string | null, number[]> {
  const asOf = todayLocalISO(today), month = asOf.slice(0, 7), day = today.getUTCDate();
  const counts = Array<number>(7).fill(0);
  for (let date = historyStart; date < today; date = addDays(date, 1)) counts[date.getUTCDay()]++;
  const historical = new Map<string | null, number[]>(), current = new Map<string | null, number>();
  for (const row of transactions) {
    if (row.deleted_at || row.type !== 'expense' || row.date > asOf || parseLocalDate(row.date) < historyStart) continue;
    const amount = transactionEUR(row);
    if (row.date < asOf) {
      const sums = historical.get(row.category_id) ?? Array<number>(7).fill(0);
      sums[parseLocalDate(row.date).getUTCDay()] += amount; historical.set(row.category_id, sums);
    }
    if (row.date.slice(0, 7) === month) current.set(row.category_id, (current.get(row.category_id) ?? 0) + amount);
  }
  const keys = new Set([...historical.keys(), ...current.keys()]);
  return new Map([...keys].map(category => [category, counts.map((count, weekday) =>
    PRIOR_DAYS / (day + PRIOR_DAYS) * (count ? (historical.get(category)?.[weekday] ?? 0) / count : 0) + (current.get(category) ?? 0) / (day + PRIOR_DAYS))]));
}
