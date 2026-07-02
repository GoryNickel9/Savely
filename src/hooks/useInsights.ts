import { useMemo } from 'react';
import type { Category } from '@/lib/types';
import { useTransactions } from './useTransactions';
import { useBudgets } from './useBudgets';
import { usePortfolio } from './usePortfolio';
import { useNetWorthHistory } from './useNetWorthHistory';
import { useRecurringCandidates } from './useRecurringCandidates';
import { generateInsights, type Insight } from '@/lib/insights';

/**
 * Derives the user's insights from already-cached data.
 *
 * No new Supabase queries are issued: this hook consumes the existing
 * transactions / budgets / portfolio / net-worth / recurring-candidates
 * queries and runs the pure `generateInsights` over them inside useMemo.
 */
export function useInsights(): { insights: Insight[]; isLoading: boolean } {
  const { transactions, isLoading: txLoading } = useTransactions();
  const { budgets, isLoading: budgetLoading } = useBudgets();
  const { assets, isLoading: portfolioLoading } = usePortfolio();
  const { data: netWorthHistory, isLoading: netWorthLoading } = useNetWorthHistory();
  const { candidates, isLoading: recurringLoading } = useRecurringCandidates();

  const openAssets = useMemo(() => assets.filter((a) => !a.sold_at), [assets]);

  // De-dupe category list from transactions + budgets (no separate fetch).
  const categories = useMemo(() => {
    const map = new Map<string, Category>();
    for (const t of transactions) {
      if (t.category) map.set(t.category.id, t.category);
    }
    for (const b of budgets) {
      if (b.category) map.set(b.category.id, b.category);
    }
    return [...map.values()];
  }, [transactions, budgets]);

  const insights = useMemo(
    () =>
      generateInsights({
        transactions,
        budgets,
        categories,
        openAssets,
        netWorthHistory: netWorthHistory ?? [],
        recurringCandidates: candidates,
      }),
    [transactions, budgets, categories, openAssets, netWorthHistory, candidates]
  );

  return {
    insights,
    isLoading: txLoading || budgetLoading || portfolioLoading || netWorthLoading || recurringLoading,
  };
}
