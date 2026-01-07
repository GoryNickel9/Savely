import { useMemo } from 'react';
import { Transaction } from '@/lib/types';

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

export function useFilteredTransactions(
  options: UseFilteredTransactionsOptions
): Transaction[] {
  const { transactions, filterMode, selectedYear, selectedMonth, sinceDate, fromDate, toDate } = options;

  return useMemo(() => {
    return transactions.filter(transaction => {
      const transactionDate = new Date(transaction.date);
      
      switch (filterMode) {
        case 'all':
          return true;
        
        case 'year':
          return transactionDate.getFullYear().toString() === selectedYear;
        
        case 'month':
          return transactionDate.getFullYear().toString() === selectedYear &&
                 transactionDate.getMonth().toString() === selectedMonth;
        
        case 'since':
          return transactionDate >= new Date(sinceDate);
        
        case 'between':
          return transactionDate >= new Date(fromDate) && transactionDate <= new Date(toDate);
        
        default:
          return true;
      }
    });
  }, [transactions, filterMode, selectedYear, selectedMonth, sinceDate, fromDate, toDate]);
}
