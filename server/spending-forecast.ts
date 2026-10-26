import { addDays, addMonths, differenceInCalendarDays, differenceInCalendarMonths, endOfMonth, startOfDay, startOfMonth, subDays, parseLocalDate, todayLocalISO } from './forecast-calendar.js';
import { FORECAST_DAYS, MIN_FORECAST_DAYS, transactionEUR, validTransactions, validCalendarDate, type SpendingForecast, type ForecastPoint } from '../src/lib/spendingForecast.js';
import type { Budget, Category, Transaction } from '../src/lib/types.js';
import { occasionalExpenseTotals } from './occasional-spending.js';
import { detectRecurringCandidates, normalizeDescription } from '../src/lib/recurringDetection.js';
export interface RecurringExpense {
  id: string; name: string; category_id: string | null; amount: number; currency: string;
  frequency: string; next_due_date: string; is_active: boolean; week_interval?: number; deleted_at?: string | null;
}
export const FORECAST_MODEL_VERSION = 'weekday-regular-occasional-v2';
const cents = (value: number) => Math.round(value * 100) / 100;
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
 * Occasional categories use their 12-calendar-month variable total / 12, prorated
 * to days remaining; future planned variable payments replace that category's
 * remaining expectation across the month. Actual spending is never smoothed.
 * No uncertainty interval is claimed; this estimator has no fitted error model.
 */
export function forecastSpending(
  transactions: Transaction[],
  budgets: Budget[],
  recurringExpenses: RecurringExpense[],
  referenceDate: string = new Date().toISOString().slice(0, 10),
  categories: Category[] = [],
): SpendingForecast {
  if (!validCalendarDate(referenceDate)) throw new Error('Invalid forecast date');
  const today = parseLocalDate(referenceDate);
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
  const occasionalCategories = categories.filter(category => !category.deleted_at && category.type === 'expense'
    && category.spending_pattern === 'occasional');
  const occasionalTotals = occasionalCategories.length
    ? occasionalExpenseTotals(known.filter(item => !configuredKeys.has(normalizeDescription(item.description))), occasionalCategories, referenceDate).totals
    : new Map<string, number>();
  const occasionalIds = new Set(occasionalTotals.keys());
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
  const regularHistorical = historical.filter(item => !occasionalIds.has(item.category_id ?? ''));
  const detected = detectRecurringCandidates(regularHistorical.map(item => ({ ...item, amount: transactionEUR(item) })), { allowLatestPriceChange: true });
  for (const candidate of detected) {
    if (configuredKeys.has(candidate.normalizedKey)) continue;
    const last = regularHistorical.filter(item => normalizeDescription(item.description) === candidate.normalizedKey).sort((a, b) => b.date.localeCompare(a.date))[0];
    schedules.push({ key: candidate.normalizedKey, category: last.category_id, amount: candidate.medianAmount,
      anchor: parseLocalDate(candidate.lastDate), weeks: candidate.frequency === 'weekly' ? 1 : 0,
      months: candidate.frequency === 'monthly' ? 1 : candidate.frequency === 'quarterly' ? 3 : 12 });
  }
  const recurringKeys = new Set([...configuredKeys, ...schedules.map(item => item.key)]);
  const variableByCategory = new Map<string | null, number[]>();
  const weekdayCounts = Array<number>(7).fill(0);
  for (let date = historyStart; date < today; date = addDays(date, 1)) weekdayCounts[date.getUTCDay()]++;
  for (const item of regularHistorical) {
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
  const plannedOccasional = new Map<string, number>();
  for (const item of planned) {
    if (!item.category_id || !occasionalIds.has(item.category_id) || configuredKeys.has(normalizeDescription(item.description))) continue;
    plannedOccasional.set(item.category_id, (plannedOccasional.get(item.category_id) ?? 0) + transactionEUR(item));
  }
  const daysLeft = monthEnd.getUTCDate() - today.getUTCDate();
  const occasionalDaily = new Map<string, number>();
  if (available && daysLeft > 0) {
    for (const [category, totalCents] of occasionalTotals) {
      const expectedRemaining = totalCents / 1200 * daysLeft / monthEnd.getUTCDate();
      occasionalDaily.set(category, Math.max(0, expectedRemaining - (plannedOccasional.get(category) ?? 0)) / daysLeft);
    }
  }
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
      const remainingCategories = new Set([...variableByCategory.keys(), ...occasionalDaily.keys(), ...scheduledCategories.keys()]);
      for (const category of remainingCategories) {
        const committed = scheduledCategories.get(category) ?? 0;
        const totals = variableByCategory.get(category);
        const isOccasional = category !== null && occasionalIds.has(category);
        const expectation = isOccasional ? occasionalDaily.get(category) ?? 0
          : available && totals ? totals[date.getUTCDay()] / weekdayCounts[date.getUTCDay()] : 0;
        const plannedVariable = planned.filter(item => item.date === iso && item.category_id === category && !recurringKeys.has(normalizeDescription(item.description))).reduce((sum, item) => sum + transactionEUR(item), 0);
        const remaining = isOccasional ? expectation : Math.max(0, expectation - plannedVariable);
        scheduled += committed;
        variable += remaining;
      }
    }
    points.push({ day: date.getUTCDate(), actual: date <= today ? cents(spent) : null,
      projected: available && date >= today ? cents(spent + scheduled + variable) : null });
  }
  const complete = available && unsupportedRecurring === 0 && unsupportedBudgets === 0;
  return { date: todayLocalISO(today), historyDays, available: complete, spent: cents(spent), scheduled: cents(scheduled), variable: cents(variable),
    total: complete ? cents(cents(spent) + cents(scheduled) + cents(variable)) : null,
    budget: limits.size && unsupportedBudgets === 0 ? { limit: cents([...limits.values()].reduce((sum, value) => sum + value, 0)) } : null,
    points: complete ? points : points.map(point => ({ ...point, projected: null })), unsupportedRecurring, unsupportedBudgets };
}
