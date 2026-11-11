import type { Budget, Transaction } from './types';
import { monthlyAverage } from './monthlyAverage';
import { transactionEUR, validTransactions } from './spendingForecast';
import type { BudgetSpending, OccasionalSpending } from './forecastContract';
import { REGULAR_SPENDING_DAYS } from './spendingWindow';

export function getAverageMonthlySpending({ transactions, categoryId, excludeCategoryIds, referenceDate = new Date() }: {
  transactions: Transaction[]; categoryId?: string; excludeCategoryIds?: ReadonlySet<string>; referenceDate?: Date;
}): number {
  const valid = validTransactions(transactions);
  const expenses = valid.filter(transaction => transaction.type === 'expense'
    && (categoryId === undefined || transaction.category_id === categoryId)
    && !excludeCategoryIds?.has(transaction.category_id ?? ''));
  return monthlyAverage(expenses.map(transaction => ({ date: transaction.date, amount: transactionEUR(transaction) })),
    valid, referenceDate, REGULAR_SPENDING_DAYS);
}

/** Budget page and dashboard share the same per-category reference. */
export function getBudgetReferenceSpending(budget: Budget, transactions: Transaction[], remote?: OccasionalSpending | BudgetSpending): number | null {
  const comparison = remote?.categories.find(category => category.categoryId === budget.category_id);
  if (remote && !('months' in remote)) {
    if (!comparison || !('spendingPattern' in comparison)) return null;
    return comparison.spendingPattern === (budget.category?.spending_pattern ?? 'regular') && comparison.expectedMonthly === Number(budget.amount).toFixed(2)
      ? Number(comparison.averageMonthly) : null;
  }
  if (budget.category?.spending_pattern !== 'occasional' || budget.category.deleted_at) {
    return getAverageMonthlySpending({ transactions, categoryId: budget.category_id });
  }
  return comparison?.expectedMonthly === Number(budget.amount).toFixed(2) ? Number(comparison.averageMonthly) : null;
}
