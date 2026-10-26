import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { Category } from '@/lib/types';
import { useTransactions } from './useTransactions';
import { useBudgets } from './useBudgets';
import { usePortfolio } from './usePortfolio';
import { useNetWorthHistory } from './useNetWorthHistory';
import { useRecurringCandidates } from './useRecurringCandidates';
import { generateInsights, type Insight } from '@/lib/insights';
import { forecastSpending, type SpendingForecast } from '@/lib/spendingForecast';
import { parseLocalDate, todayLocalISO } from '@/lib/utils';
import { useRecurringExpenses } from './useRecurringExpenses';

/**
 * Derives the user's insights from already-cached data.
 *
 * No new Supabase queries are issued: this hook consumes the existing
 * transactions / budgets / portfolio / net-worth / recurring-candidates
 * queries and runs the pure `generateInsights` over them inside useMemo.
 */
export function useInsights() {
  const { i18n } = useTranslation();
  const client = useQueryClient();
  const [date, setDate] = useState(todayLocalISO);
  useEffect(() => {
    const timer = setInterval(() => setDate(todayLocalISO()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const referenceDate = useMemo(() => parseLocalDate(date), [date]);
  const { transactions, isLoading: txLoading, isError: txError } = useTransactions();
  const { budgets, isLoading: budgetLoading, isError: budgetError } = useBudgets();
  const { assets, isLoading: portfolioLoading, isError: portfolioError } = usePortfolio();
  const { data: netWorthHistory, isLoading: netWorthLoading, isError: netWorthError } = useNetWorthHistory();
  const { candidates, isLoading: recurringLoading, isError: candidateError } = useRecurringCandidates();
  const { recurringExpenses, isLoading: scheduleLoading, isError: scheduleError } = useRecurringExpenses();

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

  const result = useMemo<{ insights: Insight[]; forecast: SpendingForecast | null; dataError: boolean }>(() => {
    try {
      const insights = generateInsights({
        transactions,
        budgets,
        categories,
        openAssets,
        netWorthHistory: netWorthHistory ?? [],
        recurringCandidates: candidates,
        referenceDate,
      });
      return { insights, forecast: forecastSpending(transactions, budgets, recurringExpenses, referenceDate), dataError: false };
    } catch {
      return { insights: [], forecast: null, dataError: true };
    }
  // Detectors read i18n internally: a language change must invalidate their messages.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, budgets, categories, openAssets, netWorthHistory, candidates, recurringExpenses, referenceDate, i18n.language]);

  return {
    insights: result.insights,
    forecast: result.forecast,
    referenceDate,
    dataError: result.dataError,
    hasTransactions: transactions.some(transaction => !transaction.deleted_at && transaction.date <= date),
    isError: Boolean(result.dataError || txError || budgetError || portfolioError || netWorthError || candidateError || scheduleError),
    isLoading: txLoading || budgetLoading || portfolioLoading || netWorthLoading || recurringLoading || scheduleLoading,
    retry: () => Promise.all(['transactions', 'budgets', 'portfolio', 'net-worth-history', 'recurring_expenses'].map(key => client.invalidateQueries({ queryKey: [key] }))),
  };
}
