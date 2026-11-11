import { validCalendarDate } from './spendingForecast.js';

export const REGULAR_SPENDING_DAYS = 180;
export const OCCASIONAL_SPENDING_DAYS = 730;

/** Calendar-month mean inside a rolling day window. Boundary months are observed, not extrapolated. */
export function spendingWindow(
  amounts: readonly { date: string; amount: number }[],
  coverage: readonly { date: string }[],
  endDate: string,
  historyDays: number,
) {
  if (!validCalendarDate(endDate) || !Number.isInteger(historyDays) || historyDays <= 0) throw new Error('Invalid spending window');
  const cutoff = new Date(`${endDate}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - historyDays);
  let first = endDate;
  for (const row of coverage) {
    if (!validCalendarDate(row.date)) throw new Error('Invalid spending date');
    if (row.date < first) first = row.date;
  }
  const startDate = first > cutoff.toISOString().slice(0, 10) ? first : cutoff.toISOString().slice(0, 10);
  const index = (date: string) => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7));
  const months = index(endDate) - index(startDate) + 1;
  let totalCents = 0;
  for (const row of amounts) {
    if (!validCalendarDate(row.date)) throw new Error('Invalid spending date');
    if (row.date < startDate || row.date > endDate) continue;
    const cents = Math.round(row.amount * 100);
    if (!Number.isFinite(row.amount) || row.amount < 0 || !Number.isSafeInteger(cents) || !Number.isSafeInteger(totalCents + cents)) throw new Error('Invalid spending amount');
    totalCents += cents;
  }
  return { startDate, endDate, historyDays, months, totalCents, averageMonthly: totalCents / (100 * months) };
}
