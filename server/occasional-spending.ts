import type { Budget, Category, Transaction } from '../src/lib/types.js';
import { validCalendarDate, transactionEUR, validTransactions } from '../src/lib/spendingForecast.js';

/** The only implementation of the 12-month comparison, shared by web and Android via the API. */
export function occasionalSpending(transactions: Transaction[], budgets: Budget[], categories: Category[], asOf: string) {
  if (!validCalendarDate(asOf)) throw new Error('Invalid budget reference date');
  const start = new Date(`${asOf.slice(0, 7)}-01T00:00:00Z`);
  start.setUTCMonth(start.getUTCMonth() - 11);
  const startDate = start.toISOString().slice(0, 10);
  const ids = new Set(categories.filter(category => !category.deleted_at && category.type === 'expense'
    && category.spending_pattern === 'occasional').map(category => category.id));
  const totals = new Map<string, number>();
  for (const transaction of validTransactions(transactions)) {
    if (transaction.type !== 'expense' || !transaction.category_id || !ids.has(transaction.category_id)
      || transaction.date < startDate || transaction.date > asOf) continue;
    const total = (totals.get(transaction.category_id) ?? 0) + Math.round(transactionEUR(transaction) * 100);
    if (!Number.isSafeInteger(total)) throw new Error('Budget spending overflow');
    totals.set(transaction.category_id, total);
  }
  return { startDate, endDate: asOf, months: 12 as const, categories: [...ids].sort().map(categoryId => {
    const matches = budgets.filter(budget => budget.category_id === categoryId);
    if (matches.length > 1) throw new Error('Duplicate category budget');
    const budget = matches[0];
    const expected = budget?.currency === 'EUR' ? Number(budget.amount) : null;
    if (expected !== null && (!Number.isFinite(expected) || expected < 0 || !Number.isSafeInteger(Math.round(expected * 100)))) {
      throw new Error('Invalid category budget');
    }
    const totalCents = totals.get(categoryId) ?? 0;
    const average = totalCents / 1200;
    const exceeded = expected !== null && expected > 0 && BigInt(totalCents) > BigInt(Math.round(expected * 100)) * 12n;
    return { categoryId, total: (totalCents / 100).toFixed(2), averageMonthly: average.toFixed(2),
      expectedMonthly: expected?.toFixed(2) ?? null, exceeded,
      over: (exceeded ? average - expected! : 0).toFixed(2) };
  }) };
}
