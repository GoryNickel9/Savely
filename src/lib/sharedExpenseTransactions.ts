import type { Transaction } from '@/lib/types';
import type { SharedExpenseViewRow } from '@/hooks/useSharedExpenses';

/** Returns the user's share of linked expenses for personal expense analytics. */
export function withPersonalSharedExpenses(
  transactions: Transaction[],
  sharedExpenses: SharedExpenseViewRow[],
  userId: string | undefined,
): Transaction[] {
  if (!userId || sharedExpenses.length === 0) return transactions;

  const ownShares = new Map(sharedExpenses
    .filter(expense => expense.created_by === userId && !expense.tx_deleted_at)
    .map(expense => [expense.original_tx_id, expense]));
  const adjusted = transactions.map(transaction => {
    const share = ownShares.get(transaction.id);
    if (!share || transaction.type !== 'expense') return transaction;
    return { ...transaction, amount: share.creator_share_amount };
  });

  for (const share of sharedExpenses) {
    if (share.created_by === userId || share.tx_deleted_at) continue;
    adjusted.push({
      id: `shared-${share.id}`,
      user_id: userId,
      category_id: null,
      type: 'expense',
      amount: share.my_share_amount,
      currency: share.currency as Transaction['currency'],
      description: share.description,
      date: share.date,
      exchange_rate_eur: share.exchange_rate_eur,
      created_at: share.created_at,
      updated_at: share.updated_at,
      deleted_at: null,
    });
  }

  return adjusted;
}
