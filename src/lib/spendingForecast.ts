import type { Transaction } from './types.js';
export const FORECAST_DAYS = 180;
export const MIN_FORECAST_DAYS = 56;
const cents = (value: number) => Math.round(value * 100) / 100;

/** EUR amounts use the transaction's recorded conversion, never today's FX. */
export function transactionEUR(transaction: Transaction): number {
  const amount = Number(transaction.amount);
  const rate = transaction.currency === 'EUR' ? 1 : Number(transaction.exchange_rate_eur);
  if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(rate) || rate <= 0) {
    throw new Error('Invalid transaction amount or exchange rate');
  }
  const converted = cents(amount * rate);
  if (!Number.isFinite(converted)) throw new Error('Transaction conversion overflow');
  return converted;
}

export function validTransactions(transactions: Transaction[]): Transaction[] {
  return transactions.filter(transaction => {
    if (transaction.deleted_at) return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(transaction.date) || !validCalendarDate(transaction.date)) {
      throw new Error('Invalid transaction date');
    }
    transactionEUR(transaction);
    return true;
  });
}

export interface ForecastPoint {
  day: number;
  actual: number | null;
  projected: number | null;
}

export interface SpendingForecast {
  date: string;
  historyDays: number;
  available: boolean;
  spent: number;
  scheduled: number;
  variable: number;
  total: number | null;
  budget: { limit: number } | null;
  points: ForecastPoint[];
  unsupportedRecurring: number;
  unsupportedBudgets: number;
}


export function validCalendarDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
