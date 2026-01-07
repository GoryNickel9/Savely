import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Transaction } from "@/lib/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Calculate median of an array
export function calculateMedian(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Get median monthly spending for a category over a specified period
interface GetMedianMonthlySpendingOptions {
  transactions: Transaction[];
  categoryId: string;
  months: number; // Numero di mesi da considerare
}

export function getMedianMonthlySpending(options: GetMedianMonthlySpendingOptions): number {
  const { transactions, categoryId, months } = options;
  
  // Calcola le date di inizio e fine
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  
  // Filtra le transazioni per categoria e periodo
  const categoryTransactions = transactions.filter(t => {
    const txDate = new Date(t.date);
    return t.category_id === categoryId &&
           t.type === 'expense' &&
           txDate >= startDate &&
           txDate <= endDate;
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
