import { addDays, addMonths, differenceInCalendarDays, differenceInCalendarMonths, endOfMonth, startOfDay, startOfMonth, subDays } from 'date-fns';
import type { RecurringExpense } from '@/hooks/useRecurringExpenses';
import type { Budget, Transaction } from './types';
import { detectRecurringCandidates, normalizeDescription } from './recurringDetection';
import { parseLocalDate, todayLocalISO } from './utils';

export const FORECAST_DAYS = 180;
export const MIN_FORECAST_DAYS = 56;
const cents = (value: number) => Math.round(value * 100) / 100;

/** EUR amounts use the transaction's recorded conversion, never today's FX. */
export function transactionEUR(transaction: Transaction): number {
  const amount = Number(transaction.amount);
  const rate = transaction.currency === 'EUR' ? 1 : Number(transaction.exchange_rate_eur);
  if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(rate) || rate <= 0) {
    throw new Error('Invalid transaction amount or exchange rate');
  }
  const converted = cents(amount * rate);
  if (!Number.isFinite(converted)) throw new Error('Transaction conversion overflow');
  return converted;
}

export function validTransactions(transactions: Transaction[]): Transaction[] {
  return transactions.filter(transaction => {
    if (transaction.deleted_at) return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(transaction.date) || todayLocalISO(parseLocalDate(transaction.date)) !== transaction.date) {
      throw new Error('Invalid transaction date');
    }
    transactionEUR(transaction);
    return true;
  });
}

export interface ForecastPoint {
  day: number;
  actual: number | null;
  projected: number | null;
}

export interface SpendingForecast {
  date: string;
  historyDays: number;
  available: boolean;
  spent: number;
  scheduled: number;
  variable: number;
  total: number | null;
  budget: { limit: number } | null;
  points: ForecastPoint[];
  unsupportedRecurring: number;
  unsupportedBudgets: number;
}

interface Schedule {
  key: string;
  category: string | null;
  amount: number;
  anchor: Date;
  months: number;
  weeks: number;
}

/** Anchored additions preserve the 31st after a short month (Jan 31, Feb 28, Mar 31). */
function occurrence(schedule: Schedule, index: number): Date {
  return schedule.weeks
    ? addDays(schedule.anchor, index * schedule.weeks * 7)
    : addMonths(schedule.anchor, index * schedule.months);
}

/**
 * Deterministic point forecast, as of the END of referenceDate.
 * Variable(category, weekday) = sum of historical variable expenses / observed
 * calendar occurrences of that weekday, including days with zero expenditure.
 * Remaining total = planned transactions + unmatched recurring dues + variable.
 * Recorded future expenses replace the variable expectation for their category/day.
 * No uncertainty interval is claimed; this estimator has no fitted error model.
 */
export function forecastSpending(
  transactions: Transaction[],
  budgets: Budget[],
  recurringExpenses: RecurringExpense[],
  referenceDate: Date = new Date(),
): SpendingForecast {
  const today = startOfDay(referenceDate);
  if (!Number.isFinite(today.getTime())) throw new Error('Invalid forecast date');
  const monthStart = startOfMonth(today);
  const monthEnd = startOfDay(endOfMonth(today));
  const tx = validTransactions(transactions);
  const known = tx.filter(item => parseLocalDate(item.date) <= today);
  const oldest = known.reduce((date, item) => Math.min(date, parseLocalDate(item.date).getTime()), today.getTime());
  const historyStart = new Date(Math.max(subDays(today, FORECAST_DAYS).getTime(), oldest));
  const historyDays = differenceInCalendarDays(today, historyStart);
  const available = historyDays >= MIN_FORECAST_DAYS;
  const historical = known.filter(item => item.type === 'expense' && parseLocalDate(item.date) >= historyStart && parseLocalDate(item.date) < today);
  const configured = recurringExpenses.filter(item => !item.deleted_at);
  const configuredKeys = new Set(configured.map(item => normalizeDescription(item.name)).filter(Boolean));
  const schedules: Schedule[] = [];
  let unsupportedRecurring = 0;
  for (const item of configured) {
    const key = normalizeDescription(item.name);
    const anchor = parseLocalDate(item.next_due_date);
    if (!key || todayLocalISO(anchor) !== item.next_due_date || !Number.isFinite(Number(item.amount)) || Number(item.amount) < 0
      || !['weekly', 'monthly', 'quarterly', 'yearly'].includes(item.frequency)) throw new Error('Invalid recurring expense');
    if (!item.is_active) continue;
    // Recurring records have no FX field: do not invent a conversion.
    if (item.currency !== 'EUR') { unsupportedRecurring++; continue; }
    const weeks = item.frequency === 'weekly' ? (item.week_interval ?? 1) : 0;
    if (item.frequency === 'weekly' && (!Number.isInteger(weeks) || weeks < 1 || weeks > 52)) throw new Error('Invalid weekly interval');
    schedules.push({ key, category: item.category_id, amount: Number(item.amount), anchor, weeks,
      months: item.frequency === 'monthly' ? 1 : item.frequency === 'quarterly' ? 3 : 12 });
  }
  // Detect on historical data only; future/planned transactions cannot train the model.
  const detected = detectRecurringCandidates(historical.map(item => ({ ...item, amount: transactionEUR(item) })), { allowLatestPriceChange: true });
  for (const candidate of detected) {
    if (configuredKeys.has(candidate.normalizedKey)) continue;
    const last = historical.filter(item => normalizeDescription(item.description) === candidate.normalizedKey).sort((a, b) => b.date.localeCompare(a.date))[0];
    schedules.push({ key: candidate.normalizedKey, category: last.category_id, amount: candidate.medianAmount,
      anchor: parseLocalDate(candidate.lastDate), weeks: candidate.frequency === 'weekly' ? 1 : 0,
      months: candidate.frequency === 'monthly' ? 1 : candidate.frequency === 'quarterly' ? 3 : 12 });
  }
  const recurringKeys = new Set([...configuredKeys, ...schedules.map(item => item.key)]);
  const variableByCategory = new Map<string | null, number[]>();
  const weekdayCounts = Array<number>(7).fill(0);
  for (let date = historyStart; date < today; date = addDays(date, 1)) weekdayCounts[date.getDay()]++;
  for (const item of historical) {
    if (recurringKeys.has(normalizeDescription(item.description))) continue;
    const totals = variableByCategory.get(item.category_id) ?? Array<number>(7).fill(0);
    totals[parseLocalDate(item.date).getDay()] += transactionEUR(item);
    variableByCategory.set(item.category_id, totals);
  }
  const dailyScheduled = new Map<string, Map<string | null, number>>();
  function scheduleAmount(date: string, category: string | null, amount: number) {
    const categories = dailyScheduled.get(date) ?? new Map<string | null, number>();
    categories.set(category, (categories.get(category) ?? 0) + amount);
    dailyScheduled.set(date, categories);
  }
  const planned = tx.filter(item => item.type === 'expense' && parseLocalDate(item.date) > today && parseLocalDate(item.date) <= monthEnd);
  planned.forEach(item => scheduleAmount(item.date, item.category_id, transactionEUR(item)));
  const usedPayments = new Set<string>();
  for (const schedule of schedules) {
    const first = Math.max(0, schedule.weeks
      ? Math.floor(differenceInCalendarDays(today, schedule.anchor) / (7 * schedule.weeks))
      : Math.floor(differenceInCalendarMonths(today, schedule.anchor) / schedule.months));
    for (let index = first; ; index++) {
      const due = occurrence(schedule, index);
      if (due > monthEnd) break;
      if (due <= today) continue;
      const previous = occurrence(schedule, index - 1);
      const payment = tx.find(item => item.type === 'expense' && !usedPayments.has(item.id)
        && normalizeDescription(item.description) === schedule.key
        && (schedule.category === null || item.category_id === schedule.category)
        && parseLocalDate(item.date) > previous && parseLocalDate(item.date) <= due);
      if (payment) { usedPayments.add(payment.id); continue; }
      scheduleAmount(todayLocalISO(due), schedule.category, schedule.amount);
    }
  }
  const limits = new Map<string, number>();
  let unsupportedBudgets = 0;
  for (const budget of budgets) {
    if (budget.currency !== 'EUR') { unsupportedBudgets++; continue; }
    const amount = Number(budget.amount);
    if (!Number.isFinite(amount) || amount < 0) throw new Error('Invalid budget');
    if (limits.has(budget.category_id)) throw new Error('Duplicate category budget');
    if (amount > 0) limits.set(budget.category_id, amount);
  }
  let spent = 0, scheduled = 0, variable = 0;
  const points: ForecastPoint[] = [];
  const currentByDay = new Map<string, Transaction[]>();
  for (const item of known) {
    if (item.type !== 'expense' || parseLocalDate(item.date) < monthStart) continue;
    const rows = currentByDay.get(item.date) ?? [];
    rows.push(item); currentByDay.set(item.date, rows);
  }
  for (let date = monthStart; date <= monthEnd; date = addDays(date, 1)) {
    const iso = todayLocalISO(date);
    if (date <= today) {
      for (const item of currentByDay.get(iso) ?? []) {
        const amount = transactionEUR(item);
        spent += amount;
      }
    } else {
      const scheduledCategories = dailyScheduled.get(iso) ?? new Map<string | null, number>();
      const categories = new Set([...variableByCategory.keys(), ...scheduledCategories.keys()]);
      for (const category of categories) {
        const committed = scheduledCategories.get(category) ?? 0;
        const totals = variableByCategory.get(category);
        const expectation = available && totals ? totals[date.getDay()] / weekdayCounts[date.getDay()] : 0;
        const plannedVariable = planned.filter(item => item.date === iso && item.category_id === category && !recurringKeys.has(normalizeDescription(item.description))).reduce((sum, item) => sum + transactionEUR(item), 0);
        const remaining = Math.max(0, expectation - plannedVariable);
        scheduled += committed;
        variable += remaining;
      }
    }
    points.push({ day: date.getDate(), actual: date <= today ? cents(spent) : null,
      projected: available && date >= today ? cents(spent + scheduled + variable) : null });
  }
  const complete = available && unsupportedRecurring === 0 && unsupportedBudgets === 0;
  return { date: todayLocalISO(today), historyDays, available: complete, spent: cents(spent), scheduled: cents(scheduled), variable: cents(variable),
    total: complete ? cents(cents(spent) + cents(scheduled) + cents(variable)) : null,
    budget: limits.size && unsupportedBudgets === 0 ? { limit: cents([...limits.values()].reduce((sum, value) => sum + value, 0)) } : null,
    points: complete ? points : points.map(point => ({ ...point, projected: null })), unsupportedRecurring, unsupportedBudgets };
}
