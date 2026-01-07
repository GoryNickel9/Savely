import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Transaction } from "@/lib/types";
import { calculateMedian } from "@/lib/statistics";
import { MEDIAN_CALCULATION_DAYS } from "@/lib/constants";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Re-export calculateMedian from statistics module for backward compatibility
export { calculateMedian };

// Get median monthly spending for a category over a specified period
interface GetMedianMonthlySpendingOptions {
  transactions: Transaction[];
  categoryId: string;
  days?: number; // Numero di giorni da considerare
  months?: number; // Numero di mesi da considerare (deprecated)
}

export function getMedianMonthlySpending(options: GetMedianMonthlySpendingOptions): number {
  const { transactions, categoryId, days, months } = options;
  
  // Calcola le date di inizio e fine
  const endDate = new Date();
  const startDate = new Date();
  
  if (days !== undefined) {
    startDate.setDate(startDate.getDate() - days);
  } else if (months !== undefined) {
    startDate.setMonth(startDate.getMonth() - months);
  }
  
  // Filtra le transazioni per categoria e periodo
  const categoryTransactions = transactions.filter(t => {
    const txDate = new Date(t.date);
    return t.category_id === categoryId &&
           t.type === 'expense' &&
           txDate >= startDate;
  });
  
  // Raggruppa per mese
  const monthlyTotals: Record<string, number> = {};
  categoryTransactions.forEach(t => {
    const date = new Date(t.date);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    monthlyTotals[key] = (monthlyTotals[key] || 0) + Number(t.amount);
  });
  
  // Calcola la mediana
  const totalsArray = Object.values(monthlyTotals);
  return calculateMedian(totalsArray);
}

/**
 * Calcola la mediana globale delle spese mensili (tutte le categorie insieme)
 * @param transactions Array di transazioni
 * @param days Numero di giorni da considerare (default: MEDIAN_CALCULATION_DAYS)
 * @returns Mediana globale delle spese mensili
 */
export function getGlobalMedianMonthlySpending(
  transactions: Transaction[],
  days: number = MEDIAN_CALCULATION_DAYS
): number {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  // Filtra tutte le spese nel periodo
  const expenses = transactions.filter(t => {
    const txDate = new Date(t.date);
    return t.type === 'expense' && txDate >= startDate;
  });
  
  // Raggruppa tutte le spese per mese
  const monthlyTotals: Record<string, number> = {};
  expenses.forEach(t => {
    const date = new Date(t.date);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    monthlyTotals[key] = (monthlyTotals[key] || 0) + Number(t.amount);
  });
  
  // Calcola la mediana
  const totalsArray = Object.values(monthlyTotals);
  return calculateMedian(totalsArray);
}
