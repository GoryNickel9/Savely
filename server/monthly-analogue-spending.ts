import type { Transaction } from '../src/lib/types.js';
import { transactionEUR } from '../src/lib/spendingForecast.js';
import { addMonths, endOfMonth, parseLocalDate, startOfMonth, todayLocalISO } from './forecast-calendar.js';

const NEIGHBOURS = 3;
const NEIGHBOUR_WEIGHT = 0.75;
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b), mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
/** Rates for the remaining days, conditioned only on spending already observed at the origin. */
export function monthlyAnalogueDailyRates(transactions: Transaction[], historyStart: Date, today: Date): Map<string | null, number[]> | null {
  const current = todayLocalISO(today), day = today.getUTCDate(), month = current.slice(0, 7);
  const rows = transactions.filter(row => !row.deleted_at && row.type === 'expense' && row.date <= current && parseLocalDate(row.date) >= historyStart);
  const categories = [...new Set(rows.map(row => row.category_id))];
  const currentAmounts = new Map<string | null, number>();
  for (const row of rows.filter(row => row.date.slice(0, 7) === month)) currentAmounts.set(row.category_id, (currentAmounts.get(row.category_id) ?? 0) + transactionEUR(row));
  const currentTotal = [...currentAmounts.values()].reduce((sum, value) => sum + value, 0);
  const candidates: { month: string; distance: number; totalRate: number; rates: Map<string | null, number> }[] = [];
  for (let age = 1; age <= 6; age++) {
    const first = startOfMonth(addMonths(today, -age)), last = endOfMonth(first);
    if (first < historyStart || last.getUTCDate() <= day) continue;
    const iso = todayLocalISO(first).slice(0, 7), remainingDays = last.getUTCDate() - day;
    const observed = new Map<string | null, number>(), remaining = new Map<string | null, number>();
    for (const row of rows.filter(row => row.date.slice(0, 7) === iso)) {
      const target = Number(row.date.slice(8)) <= day ? observed : remaining;
      target.set(row.category_id, (target.get(row.category_id) ?? 0) + transactionEUR(row));
    }
    const observedTotal = [...observed.values()].reduce((sum, value) => sum + value, 0);
    const denominator = currentTotal + observedTotal + 1;
    const categoryDifference = categories.reduce((sum, category) => sum + Math.abs((observed.get(category) ?? 0) - (currentAmounts.get(category) ?? 0)), 0);
    const rates = new Map(categories.map(category => [category, (remaining.get(category) ?? 0) / remainingDays]));
    candidates.push({ month: iso, distance: (Math.abs(observedTotal - currentTotal) + categoryDifference) / (2 * denominator),
      totalRate: [...rates.values()].reduce((sum, value) => sum + value, 0), rates });
  }
  if (candidates.length < NEIGHBOURS) return null;
  const nearest = [...candidates].sort((a, b) => a.distance - b.distance || b.month.localeCompare(a.month)).slice(0, NEIGHBOURS);
  const targetRate = NEIGHBOUR_WEIGHT * median(nearest.map(row => row.totalRate)) + (1 - NEIGHBOUR_WEIGHT) * candidates.reduce((sum, row) => sum + row.totalRate, 0) / candidates.length;
  const distribution = new Map(categories.map(category => [category,
    NEIGHBOUR_WEIGHT * nearest.reduce((sum, row) => sum + (row.rates.get(category) ?? 0), 0) / nearest.length +
    (1 - NEIGHBOUR_WEIGHT) * candidates.reduce((sum, row) => sum + (row.rates.get(category) ?? 0), 0) / candidates.length]));
  const distributionTotal = [...distribution.values()].reduce((sum, value) => sum + value, 0);
  return new Map(categories.map(category => [category, Array<number>(7).fill(distributionTotal > 0 ? (distribution.get(category) ?? 0) * targetRate / distributionTotal : 0)]));
}
