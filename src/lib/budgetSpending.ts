import type { Budget, Transaction } from './types';
import { getMedianMonthlySpending } from './utils';
import type { OccasionalSpending } from './forecastContract';

/** Budget page and dashboard share the same per-category reference. */
export function getBudgetReferenceSpending(budget: Budget, transactions: Transaction[], remote?: OccasionalSpending): number | null {
  if (budget.category?.spending_pattern !== 'occasional' || budget.category.deleted_at) {
    return getMedianMonthlySpending({ transactions, categoryId: budget.category_id });
  }
  const comparison = remote?.categories.find(category => category.categoryId === budget.category_id);
  return comparison?.expectedMonthly === Number(budget.amount).toFixed(2) ? Number(comparison.averageMonthly) : null;
}
