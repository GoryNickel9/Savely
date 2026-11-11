import type { Budget, Category, Transaction } from '../src/lib/types.js';
import { transactionEUR, validTransactions } from '../src/lib/spendingForecast.js';
import { spendingWindow, REGULAR_SPENDING_DAYS, OCCASIONAL_SPENDING_DAYS } from '../src/lib/spendingWindow.js';

/** Both clients consume the same mean and exact comparison, including current and zero months. */
export function budgetSpending(transactions: Transaction[], budgets: Budget[], categories: Category[], asOf: string) {
  const valid = validTransactions(transactions);
  const patterns = new Map(categories.filter(category => !category.deleted_at && category.type === 'expense')
    .map(category => [category.id, category.spending_pattern ?? 'regular']));
  const limits = new Map<string, number | null>();
  for (const budget of budgets) {
    if (limits.has(budget.category_id)) throw new Error('Duplicate category budget');
    const limit = Number(budget.amount);
    if (!Number.isFinite(limit) || limit < 0 || !Number.isSafeInteger(Math.round(limit * 100))) throw new Error('Invalid category budget');
    limits.set(budget.category_id, budget.currency === 'EUR' ? limit : null);
  }
  const byCategory = new Map<string | null, { date: string; amount: number }[]>();
  for (const id of new Set([...patterns.keys(), ...limits.keys()])) byCategory.set(id, []);
  for (const tx of valid) {
    if (tx.type !== 'expense') continue;
    const rows = byCategory.get(tx.category_id) ?? [];
    rows.push({ date: tx.date, amount: transactionEUR(tx) });
    byCategory.set(tx.category_id, rows);
  }
  return { endDate: asOf, categories: [...byCategory].sort(([a], [b]) => (a ?? '').localeCompare(b ?? '')).map(([categoryId, rows]) => {
    const spendingPattern = categoryId !== null && patterns.get(categoryId) === 'occasional' ? 'occasional' as const : 'regular' as const;
    const historyDays: 180 | 730 = spendingPattern === 'occasional' ? OCCASIONAL_SPENDING_DAYS : REGULAR_SPENDING_DAYS;
    const { totalCents, averageMonthly: _average, ...window } = spendingWindow(rows, valid, asOf, historyDays);
    const expected = categoryId === null ? null : limits.get(categoryId) ?? null;
    const exceeded = expected !== null && expected > 0 && BigInt(totalCents) > BigInt(Math.round(expected * 100)) * BigInt(window.months);
    const averageCents = Number((BigInt(totalCents) + BigInt(Math.floor(window.months / 2))) / BigInt(window.months));
    return { categoryId, spendingPattern, ...window, historyDays, total: (totalCents / 100).toFixed(2), averageMonthly: (averageCents / 100).toFixed(2),
      expectedMonthly: expected?.toFixed(2) ?? null, exceeded, over: (exceeded ? (averageCents - Math.round(expected! * 100)) / 100 : 0).toFixed(2) };
  }) };
}
