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

/**
 * Interfaccia per il range di date
 */
interface DateRange {
  startDate: Date;
  endDate: Date;
}

/**
 * Calcola un range di date basato sul numero di giorni specificato
 * @param days Numero di giorni da considerare
 * @returns Oggetto con startDate e endDate
 */
function getDateRange(days: number): DateRange {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  return { startDate, endDate };
}

/**
 * Filtra le transazioni in base al range di date specificato
 * @param transactions Array di transazioni
 * @param range Range di date
 * @returns Transazioni filtrate
 */
function filterTransactionsByDate(
  transactions: Transaction[],
  range: DateRange
): Transaction[] {
  return transactions.filter(t => {
    const txDate = new Date(t.date);
    return txDate >= range.startDate && txDate <= range.endDate;
  });
}

/**
 * Raggruppa le transazioni per mese
 * @param transactions Array di transazioni
 * @returns Oggetto con chiavi formato "YYYY-MM" e valori totali
 */
function groupTransactionsByMonth(transactions: Transaction[]): Record<string, number> {
  const monthlyTotals: Record<string, number> = {};
  transactions.forEach(t => {
    const date = new Date(t.date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    monthlyTotals[key] = (monthlyTotals[key] || 0) + Number(t.amount);
  });
  return monthlyTotals;
}

// Get median monthly spending for a category over a specified period
interface GetMedianMonthlySpendingOptions {
  transactions: Transaction[];
  categoryId: string;
  days?: number; // Numero di giorni da considerare
}

/**
 * Calcola la mediana delle spese mensili per una categoria specifica (inclusi i valori zero)
 * @param options Opzioni per il calcolo
 * @returns Mediana delle spese mensili
 */
export function getMedianMonthlySpending(options: GetMedianMonthlySpendingOptions): number {
  const { transactions, categoryId, days } = options;
  
  const range = getDateRange(days || MEDIAN_CALCULATION_DAYS);
  
  const categoryTransactions = transactions.filter(t => {
    const txDate = new Date(t.date);
    return t.category_id === categoryId &&
           t.type === 'expense' &&
           txDate >= range.startDate;
  });
  
  const monthlyTotals = groupTransactionsByMonth(categoryTransactions);
  const totalsArray = Object.values(monthlyTotals);
  return calculateMedian(totalsArray);
}

/**
 * Calcola la mediana globale delle spese mensili (tutte le categorie insieme, inclusi i valori zero)
 * @param transactions Array di transazioni
 * @param days Numero di giorni da considerare (default: MEDIAN_CALCULATION_DAYS)
 * @returns Mediana globale delle spese mensili
 */
export function getGlobalMedianMonthlySpending(
  transactions: Transaction[],
  days: number = MEDIAN_CALCULATION_DAYS
): number {
  const range = getDateRange(days);
  
  const expenses = transactions.filter(t => {
    const txDate = new Date(t.date);
    return t.type === 'expense' && txDate >= range.startDate;
  });
  
  const monthlyTotals = groupTransactionsByMonth(expenses);
  const totalsArray = Object.values(monthlyTotals);
  return calculateMedian(totalsArray);
}
