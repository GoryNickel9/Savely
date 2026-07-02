import { useMemo } from 'react';
import { Transaction } from '@/lib/types';
import { parseLocalDate } from '@/lib/utils';

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
      const date = parseLocalDate(transaction.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}`;
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
      const amount = Number(transaction.amount);

      if (transaction.type === 'income') {
        monthData.income += amount;
      } else {
        monthData.expenses += amount;
      }

      monthData.net = monthData.income - monthData.expenses;
    });

    // Converti in array e ordina per mese (più recente prima)
    const result = Array.from(monthlyMap.values());
    result.sort((a, b) => b.month.localeCompare(a.month));
    
    return result;
  }, [transactions]);
}
