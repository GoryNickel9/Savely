import { format, subDays } from 'date-fns';
import { validCalendarDate } from './spendingForecast.js';

/** Mean of calendar-month totals over observed coverage, including zero months.
 * Boundary months are included as observed; they are not extrapolated to full months.
 */
export function monthlyAverage(
  amounts: readonly { date: string; amount: number }[],
  coverage: readonly { date: string }[],
  referenceDate = new Date(),
  historyDays?: number,
): number {
  if (historyDays !== undefined && (!Number.isInteger(historyDays) || historyDays <= 0)) throw new Error('Invalid spending history window');
  const end = format(referenceDate, 'yyyy-MM-dd');
  const cutoff = historyDays === undefined ? '0001-01-01' : format(subDays(referenceDate, historyDays), 'yyyy-MM-dd');
  let first: string | undefined;
  for (const row of coverage) {
    if (!validCalendarDate(row.date)) throw new Error('Invalid spending date');
    if (row.date <= end && (first === undefined || row.date < first)) first = row.date;
  }
  if (first === undefined) return 0;
  if (first < cutoff) first = cutoff;
  const monthIndex = (date: string) => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7));
  const months = monthIndex(end) - monthIndex(first) + 1;
  let totalCents = 0;
  for (const row of amounts) {
    if (!validCalendarDate(row.date)) throw new Error('Invalid spending date');
    if (row.date < first || row.date > end) continue;
    if (!Number.isFinite(row.amount) || row.amount < 0) throw new Error('Invalid spending amount');
    const cents = Math.round(row.amount * 100);
    if (!Number.isSafeInteger(cents) || !Number.isSafeInteger(totalCents + cents)) throw new Error('Spending amount overflow');
    totalCents += cents;
  }
  return totalCents / (100 * months);
}
