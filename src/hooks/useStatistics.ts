import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { useTransactions } from './useTransactions';
import { useBudgets } from './useBudgets';
import { useCategories } from './useCategories';
import { Transaction, Budget, Category } from '@/lib/types';
import { useEffect, useMemo } from 'react';
import {
  calculateMean,
  calculateMedian,
  calculateWinsorizedMean
} from '@/lib/statistics';
import {
  MEAN_CALCULATION_DAYS,
  MEDIAN_CALCULATION_DAYS,
  WINSORIZED_MEAN_CALCULATION_DAYS
} from '@/lib/constants';

export interface StatisticResult {
  name: string;
  value: number;
  period: string;
  description: string;
}

export interface CategoryStatistic {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  value: number;
  budget: number | null;
  budgetPercentage: number | null;
  isOverBudget: boolean;
}

export function useStatistics(winsorizedPercentile: number = 0.10, meanDays?: number, medianDays?: number, winsorizedDays?: number) {
  const { user } = useAuth();
  const { transactions } = useTransactions();
  const { budgets } = useBudgets();
  const { categories } = useCategories();
  const queryClient = useQueryClient();

  // Invalida il query quando cambiano i parametri
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['statistics'] });
  }, [winsorizedPercentile, meanDays, medianDays, winsorizedDays, queryClient]);

  /**
   * Recupera le spese per un periodo specifico (in giorni)
   * Memoizzato per evitare ripetuti calcoli
   */
  const getExpensesByPeriod = useMemo(() => {
    return (days: number): Transaction[] => {
      if (!transactions.length) return [];
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      return transactions.filter(t => {
        const txDate = new Date(t.date);
        return t.type === 'expense' && txDate >= startDate;
      });
    };
  }, [transactions]);

  /**
   * Crea un array con tutti i mesi nel periodo specificato (in giorni)
   * Include il mese di partenza (come pd.period_range in pandas)
   * pd.period_range(start=start_date, end=end_date, freq='M') genera i periodi mensili
   * dal primo giorno del mese di start_date all'ultimo giorno del mese di end_date
   * Include TUTTI i mesi che intersecano il range [start_date, end_date]
   */
  const getAllMonthsInPeriod = (days: number): string[] => {
    const result: string[] = [];
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // pd.period_range con freq='M' genera periodi mensili dal primo giorno del mese di start
    // all'ultimo giorno del mese di end (incluso)
    // Per 365 giorni, pd.period_range genera 13 mesi (non 12!)
    const startMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    
    const current = new Date(startMonth);
    
    // Continua finché non superiamo il mese di fine
    while (current <= endMonth) {
      const key = `${current.getFullYear()}-${current.getMonth()}`;
      result.push(key);
      current.setMonth(current.getMonth() + 1);
    }
    
    return result;
  };

  /**
   * Calcola una statistica per tutte le spese (raggruppate per mese)
   * ✅ CORREZIONE: Calcola i totali mensili di TUTTE le spese, includendo mesi con 0 spese
   */
  const calculateStatisticForAllExpenses = (
    statisticFunction: (values: number[], percentile?: number) => number,
    days: number,
    percentile?: number
  ): number => {
    const expenses = getExpensesByPeriod(days);
    const allMonths = getAllMonthsInPeriod(days);
    
    // Raggruppa TUTTE le spese per mese (non per categoria)
    const monthlyTotals: Record<string, number> = {};
    expenses.forEach(t => {
      const date = new Date(t.date);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      monthlyTotals[key] = (monthlyTotals[key] || 0) + Number(t.amount);
    });
    
    // ✅ Includi TUTTI i mesi, anche quelli senza spese (valore 0)
    const values = allMonths.map(month => monthlyTotals[month] || 0);
    
    if (values.length === 0) return 0;
    
    return statisticFunction(values, percentile);
  };

  /**
   * Calcola una statistica per categoria (raggruppata per mese)
   */
  const calculateStatisticByCategory = (
    statisticFunction: (values: number[], percentile?: number) => number,
    days: number,
    percentile?: number
  ): CategoryStatistic[] => {
    const expenses = getExpensesByPeriod(days);
    const expenseCategories = categories.filter(c => c.type === 'expense');
    const allMonths = getAllMonthsInPeriod(days);
    
    return expenseCategories
      .map(category => {
      const categoryExpenses = expenses.filter(t => t.category_id === category.id);
      
      // Raggruppa le spese della categoria per mese
      const monthlyTotals: Record<string, number> = {};
      categoryExpenses.forEach(t => {
        const date = new Date(t.date);
        const key = `${date.getFullYear()}-${date.getMonth()}`;
        monthlyTotals[key] = (monthlyTotals[key] || 0) + Number(t.amount);
      });
      
      // ✅ Includi TUTTI i mesi, anche quelli senza spese (valore 0)
      const values = allMonths.map(month => monthlyTotals[month] || 0);
      const value = statisticFunction(values, percentile);
      
      // Trova il budget per questa categoria
      const budget = budgets.find(b => b.category_id === category.id);
      const budgetAmount = budget?.amount || null;
      const budgetPercentage = budgetAmount ? ((value - budgetAmount) / budgetAmount) * 100 : null;
      const isOverBudget = budgetAmount ? value > budgetAmount : false;
      
      return {
        categoryId: category.id,
        categoryName: category.name,
        categoryIcon: category.icon,
        categoryColor: category.color,
        value,
        budget: budgetAmount,
        budgetPercentage,
        isOverBudget,
      };
    })
    .filter(categoryStat => categoryStat.budget !== null);
  };

  /**
   * Calcola le 4 statistiche principali
   */
  const { data: statistics, isLoading } = useQuery({
    queryKey: ['statistics', user?.id, winsorizedPercentile, meanDays, medianDays, winsorizedDays],
    queryFn: (): StatisticResult[] => {
      const actualMeanDays = meanDays || MEAN_CALCULATION_DAYS;
      const actualMedianDays = medianDays || MEDIAN_CALCULATION_DAYS;
      const actualWinsorizedDays = winsorizedDays || WINSORIZED_MEAN_CALCULATION_DAYS;
      
      return [
        {
          name: 'Media',
          value: calculateStatisticForAllExpenses(calculateMean, actualMeanDays),
          period: `Ultimi ${Math.round(actualMeanDays / 30.41)} mesi`,
          description: 'Media aritmetica di tutte le spese',
        },
        {
          name: 'Mediana',
          value: calculateStatisticForAllExpenses(calculateMedian, actualMedianDays),
          period: `Ultimi ${Math.round(actualMedianDays / 30.41)} mesi`,
          description: 'Valore mediano delle spese',
        },
        {
          name: `Media winsorizzata (${(winsorizedPercentile * 100).toFixed(0)}%)`,
          value: calculateStatisticForAllExpenses(calculateWinsorizedMean, actualWinsorizedDays, winsorizedPercentile),
          period: `Ultimi ${Math.round(actualWinsorizedDays / 30.41)} mesi`,
          description: `Media con riduzione degli outlier (${(winsorizedPercentile * 100).toFixed(0)}%)`,
        },
      ];
    },
    enabled: !!user && transactions.length > 0,
  });

  /**
   * Recupera il dettaglio per categoria per una statistica specifica
   */
  const getCategoryStatistics = (
    statisticType: 'mean' | 'median' | 'winsorized',
    days: number,
    percentile?: number
  ): CategoryStatistic[] => {
    let statisticFunction: (values: number[], percentile?: number) => number;
    
    switch (statisticType) {
      case 'mean':
        statisticFunction = calculateMean;
        break;
      case 'median':
        statisticFunction = calculateMedian;
        break;
      case 'winsorized':
        statisticFunction = calculateWinsorizedMean;
        break;
      default:
        statisticFunction = calculateMean;
    }
    
    return calculateStatisticByCategory(statisticFunction, days, percentile);
  };

  return {
    statistics,
    isLoading,
    getCategoryStatistics,
  };
}