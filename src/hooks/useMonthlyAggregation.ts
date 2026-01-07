import { useMemo } from 'react';
import { Transaction } from '@/lib/types';

export interface MonthlyData {
  month: string;
  monthLabel: string;
  income: number;
  expenses: number;
  net: number;
}

export function useMonthlyAggregation(
  transactions: Transaction[]
): MonthlyData[] {
  return useMemo(() => {
    const monthlyMap = new Map<string, MonthlyData>();

    transactions.forEach(transaction => {
      const date = new Date(transaction.date);
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      const monthLabel = date.toLocaleDateString('it-IT', {
        month: 'long',
        year: 'numeric'
      });

      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, {
          month: monthKey,
          monthLabel,
          income: 0,
          expenses: 0,
          net: 0
        });
      }

      const monthData = monthlyMap.get(monthKey)!;
      const amount = transaction.amount;

      if (amount > 0) {
        monthData.income += amount;
      } else {
        monthData.expenses += Math.abs(amount);
      }

      monthData.net = monthData.income - monthData.expenses;
    });

    return Array.from(monthlyMap.values()).sort((a, b) => 
      b.month.localeCompare(a.month)
    );
  }, [transactions]);
}
