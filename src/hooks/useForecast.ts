import { useMemo } from 'react';
import { useTransactions } from './useTransactions';
import { useRecurringExpenses } from './useRecurringExpenses';
import { getGlobalMedianMonthlySpending } from '@/lib/utils';
import { calculateNetWorth } from '@/lib/netWorth';
import { projectCashFlow, type ForecastResult } from '@/lib/forecast';

/**
 * Combines transactions + recurring expenses + net worth to produce a cash-flow
 * forecast for the given horizon (in months).
 */
export function useForecast(months: number): {
  data: ForecastResult | null;
  currentBalance: number;
  isLoading: boolean;
} {
  const { transactions, isLoading: txLoading } = useTransactions();
  const { recurringExpenses, isLoading: recLoading } = useRecurringExpenses();

  // Current cashflow balance = all-time (income - expense).
  // We use the cashflow component of net worth (which excludes unrealized P&L
  // since that's not spendable cash).
  const { cashflow: currentBalance } = useMemo(
    () => calculateNetWorth({ transactions, assets: [] }),
    [transactions]
  );

  const data = useMemo<ForecastResult | null>(() => {
    if (txLoading || recLoading) return null;

    const medianMonthlyBurn = getGlobalMedianMonthlySpending(transactions);
    const activeRecurring = recurringExpenses
      .filter((r) => r.is_active && !r.deleted_at)
      .map((r) => ({
        amount: Number(r.amount),
        frequency: r.frequency,
        week_interval: r.week_interval,
        next_due_date: r.next_due_date,
      }));

    return projectCashFlow({
      medianMonthlyBurn,
      recurring: activeRecurring,
      startDate: new Date(),
      months,
      currentBalance,
    });
  }, [transactions, recurringExpenses, txLoading, recLoading, months, currentBalance]);

  return {
    data,
    currentBalance,
    isLoading: txLoading || recLoading,
  };
}
