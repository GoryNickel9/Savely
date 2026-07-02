import { useMemo } from 'react';
import { Transaction } from '@/lib/types';
import { parseLocalDate } from '@/lib/utils';

export type FilterMode = 'all' | 'year' | 'month' | 'since' | 'between';

interface UseFilteredTransactionsOptions {
  transactions: Transaction[];
  filterMode: FilterMode;
  selectedYear: string;
  selectedMonth: string;
  sinceDate: string;
  fromDate: string;
  toDate: string;
}

/**
 * Helper per validare e parsare una data in modo sicuro (ora locale)
 */
function parseDate(dateString: string): Date | null {
  if (!dateString) return null;

  const date = parseLocalDate(dateString);
  // Verifica che la data sia valida
  if (isNaN(date.getTime())) {
    console.warn(`Data non valida: ${dateString}`);
    return null;
  }

  return date;
}

export function useFilteredTransactions(
  options: UseFilteredTransactionsOptions
): Transaction[] {
  const { transactions, filterMode, selectedYear, selectedMonth, sinceDate, fromDate, toDate } = options;

  // Memoizza le date di filtro per evitare ripetuti parsing
  const filterDates = useMemo(() => ({
    since: parseDate(sinceDate),
    from: parseDate(fromDate),
    to: parseDate(toDate),
  }), [sinceDate, fromDate, toDate]);

  return useMemo(() => {
    return transactions.filter(transaction => {
      const transactionDate = parseDate(transaction.date);
      if (!transactionDate) return false;
      
      switch (filterMode) {
        case 'all':
          return true;
        
        case 'year':
          return transactionDate.getFullYear().toString() === selectedYear;
        
        case 'month':
          return transactionDate.getFullYear().toString() === selectedYear &&
                 (transactionDate.getMonth() + 1).toString() === selectedMonth;
        
        case 'since':
          return filterDates.since ? transactionDate >= filterDates.since : true;
        
        case 'between':
          return filterDates.from && filterDates.to
            ? transactionDate >= filterDates.from && transactionDate <= filterDates.to
            : true;
        
        default:
          return true;
      }
    });
  }, [transactions, filterMode, selectedYear, selectedMonth, filterDates]);
}
