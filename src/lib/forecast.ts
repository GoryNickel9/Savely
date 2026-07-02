/**
 * Cash-flow forecast / projection.
 *
 * Pure functions that project the user's balance forward N months, combining:
 *   - a baseline daily burn derived from the median monthly spending
 *     (getGlobalMedianMonthlySpending over 730 days);
 *   - known recurring expenses due within the horizon (frequency-aware).
 *
 * No Supabase calls — fully unit-testable.
 */

import type { RecurringFrequency } from '@/hooks/useRecurringExpenses';

export interface ForecastRecurringInput {
  amount: number;
  frequency: RecurringFrequency;
  week_interval?: number;
  next_due_date: string; // YYYY-MM-DD
}

export interface ForecastPoint {
  date: string; // YYYY-MM-DD
  balance: number;
  isNegative: boolean;
}

export interface ForecastResult {
  points: ForecastPoint[];
  /** Lowest projected balance in the horizon. */
  minBalance: number;
  /** First date the balance goes below zero, or null if it never does. */
  negativeOn: string | null;
  /** Projected balance at the end of the horizon. */
  endBalance: number;
}

/**
 * Compute the next due date for a recurring expense, mirroring the
 * process-recurring-expenses edge function logic.
 *
 * End-of-month overflow is clamped: e.g. Jan 31 + 1 month → Feb 28/29.
 */
export function nextDueDate(
  current: Date,
  frequency: RecurringFrequency,
  weekInterval = 1
): Date {
  const d = new Date(current.getTime());
  switch (frequency) {
    case 'weekly':
      d.setUTCDate(d.getUTCDate() + 7 * Math.max(1, weekInterval));
      break;
    case 'monthly':
      addMonthsUTC(d, 1);
      break;
    case 'quarterly':
      addMonthsUTC(d, 3);
      break;
    case 'yearly':
      addMonthsUTC(d, 12);
      break;
  }
  return d;
}

/** Add N months to a date (UTC), clamping the day to the month's last day. */
function addMonthsUTC(d: Date, months: number): void {
  const day = d.getUTCDate();
  const month = d.getUTCMonth();
  const year = d.getUTCFullYear();

  const totalMonths = year * 12 + month + months;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = totalMonths % 12;

  // Last day of the target month.
  const lastDay = new Date(Date.UTC(newYear, newMonth + 1, 0)).getUTCDate();
  d.setUTCFullYear(newYear, newMonth, Math.min(day, lastDay));
}

/**
 * Project the cash balance forward.
 *
 * @param medianMonthlyBurn  median monthly expenses (from getGlobalMonthlyMedianSpending).
 *                           Used to derive a daily burn rate.
 * @param recurring          active recurring expenses (due dates projected forward).
 * @param startDate          first projection day (inclusive).
 * @param months             horizon length (1, 3, 6, 12...).
 * @param currentBalance     starting balance (e.g. all-time cashflow).
 *
 * The projection is day-by-day: each day subtracts (dailyBurn), and on any day
 * that matches a projected recurring due date it subtracts the recurring amount.
 */
export function projectCashFlow(params: {
  medianMonthlyBurn: number;
  recurring: ForecastRecurringInput[];
  startDate: Date;
  months: number;
  currentBalance: number;
}): ForecastResult {
  const { medianMonthlyBurn, recurring, startDate, months, currentBalance } = params;

  const dailyBurn = medianMonthlyBurn > 0 ? medianMonthlyBurn / 30 : 0;

  // Normalize all dates to UTC midnight to avoid timezone drift in comparisons.
  const startMs = Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate());

  // Horizon end: start + N months (day-clamped).
  const endTmp = new Date(startMs);
  addMonthsUTC(endTmp, months);
  const endMs = endTmp.getTime();

  // Pre-compute projected recurring due dates within the horizon.
  const recurringHits = new Map<string, number>(); // YYYY-MM-DD → total amount
  for (const r of recurring) {
    let due = new Date(r.next_due_date + 'T00:00:00Z');
    // If the next due date is in the past, fast-forward to the first future date.
    while (due.getTime() < startMs) {
      due = nextDueDate(due, r.frequency, r.week_interval);
    }
    while (due.getTime() <= endMs) {
      const key = toISODate(due);
      recurringHits.set(key, (recurringHits.get(key) ?? 0) + r.amount);
      due = nextDueDate(due, r.frequency, r.week_interval);
    }
  }

  const points: ForecastPoint[] = [];
  let balance = currentBalance;
  let minBalance = currentBalance;
  let negativeOn: string | null = null;
  let cursor = startMs;
  const ONE_DAY = 24 * 60 * 60 * 1000;

  while (cursor <= endMs) {
    balance -= dailyBurn;
    const d = new Date(cursor);
    const key = toISODate(d);
    if (recurringHits.has(key)) {
      balance -= recurringHits.get(key)!;
    }
    const isNegative = balance < 0;
    if (isNegative && negativeOn === null) {
      negativeOn = key;
    }
    if (balance < minBalance) minBalance = balance;

    points.push({ date: key, balance: round2(balance), isNegative });
    cursor += ONE_DAY;
  }

  return {
    points,
    minBalance: round2(minBalance),
    negativeOn,
    endBalance: round2(balance),
  };
}

function toISODate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
