import { Transaction } from '@/lib/types';
import {
  parseISO,
  startOfDay,
  startOfWeek,
  startOfMonth,
  subDays,
  addDays,
  addWeeks,
  addMonths,
  differenceInCalendarDays,
} from 'date-fns';

/** Intervallo di date con estremi inclusi. */
export interface DateRange {
  from: Date;
  to: Date;
}

export type Granularity = 'giornaliero' | 'settimanale' | 'mensile';

export type PeriodPreset =
  | 'mese-corrente'
  | 'mese-precedente'
  | 'ultimi-30-giorni'
  | 'anno-corrente'
  | 'personalizzato';

/** Selezione completa del periodo: preset attivo + eventuale intervallo custom. */
export interface PeriodSelection {
  preset: PeriodPreset;
  /** Richiesto quando preset === 'personalizzato'. */
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Converte la data di una transazione in Date locale. Gli ISO "YYYY-MM-DD"
 * (formato restituito da Postgres) vengono interpretati come mezzanotte
 * locali, coerentemente con i range costruiti tramite date-fns: così i
 * confronti non dipendono dal fuso orario della macchina.
 */
function txDate(dateStr: string): Date {
  return DATE_ONLY.test(dateStr) ? parseISO(dateStr) : new Date(dateStr);
}

/** Risolve una selezione in un intervallo di date concreto. */
export function resolvePeriod(selection: PeriodSelection, today: Date = new Date()): DateRange {
  const now = startOfDay(today);
  switch (selection.preset) {
    case 'mese-precedente': {
      const from = startOfMonth(subDays(startOfMonth(now), 1));
      return { from, to: endOfMonthDate(from) };
    }
    case 'ultimi-30-giorni':
      return { from: subDays(now, 29), to: now };
    case 'anno-corrente':
      return { from: firstDayOfYear(now), to: now };
    case 'personalizzato': {
      if (selection.from && selection.to) {
        const from = parseISO(selection.from);
        const to = parseISO(selection.to);
        if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) {
          return from <= to ? { from, to } : { from: to, to: from };
        }
      }
      // Selezione personalizzata incompleta o invalida: si resta sul mese corrente.
      return { from: startOfMonth(now), to: now };
    }
    default:
      return { from: startOfMonth(now), to: now };
  }
}

function endOfMonthDate(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function firstDayOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1);
}

/** Intervallo immediatamente precedente, di pari durata (estremi inclusi). */
export function previousRange(range: DateRange): DateRange {
  const days = differenceInCalendarDays(startOfDay(range.to), startOfDay(range.from));
  return { from: subDays(startOfDay(range.from), days + 1), to: subDays(startOfDay(range.from), 1) };
}

/** True se la transazione cade in [from, to], estremi inclusi (a giorno pieno). */
export function isInRange(transaction: Pick<Transaction, 'date'>, range: DateRange): boolean {
  const d = startOfDay(txDate(transaction.date));
  const from = startOfDay(range.from);
  const to = startOfDay(range.to);
  // Se from > to l'intervallo è invalido: si normalizza scambiandoli.
  const [lo, hi] = from <= to ? [from, to] : [to, from];
  return d >= lo && d <= hi;
}

/** Filtra le transazioni nel range. */
export function filterByRange(transactions: Transaction[], range: DateRange): Transaction[] {
  return transactions.filter((t) => isInRange(t, range));
}

function signedAmount(t: Pick<Transaction, 'type' | 'amount'>): number {
  const amount = Number(t.amount) || 0;
  return t.type === 'income' ? amount : -amount;
}

/** Somma degli importi di un tipo (income/expense) nel range. */
export function sumByType(
  transactions: Transaction[],
  type: Transaction['type'],
  range: DateRange,
): number {
  return filterByRange(transactions, range)
    .filter((t) => t.type === type)
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
}

/** Saldo cumulato: somma firmata di tutte le transazioni fino a `end` incluse. */
export function balanceUntil(transactions: Transaction[], end: Date): number {
  const limit = startOfDay(end);
  return transactions
    .filter((t) => startOfDay(txDate(t.date)) <= limit)
    .reduce((sum, t) => sum + signedAmount(t), 0);
}

/** Variazione percentuale; null se il precedente è zero (confronto non significativo). */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export interface PeriodStats {
  income: number;
  expenses: number;
  savings: number;
  /** Percentuale di risparmio sul totale entrate (0 se nessuna entrata). */
  savingsRate: number;
  /** Saldo cumulato alla fine del periodo. */
  balance: number;
  deltaPercent: {
    income: number | null;
    expenses: number | null;
    savings: number | null;
    balance: number | null;
  };
}

/** Statistiche aggregate del periodo + confronto col periodo precedente di pari durata. */
export function computePeriodStats(transactions: Transaction[], range: DateRange): PeriodStats {
  const income = sumByType(transactions, 'income', range);
  const expenses = sumByType(transactions, 'expense', range);
  const savings = income - expenses;
  const savingsRate = income > 0 ? (savings / income) * 100 : 0;
  const balance = balanceUntil(transactions, range.to);

  const prev = previousRange(range);
  const prevIncome = sumByType(transactions, 'income', prev);
  const prevExpenses = sumByType(transactions, 'expense', prev);
  const prevSavings = prevIncome - prevExpenses;
  const prevBalance = balanceUntil(transactions, prev.to);

  return {
    income,
    expenses,
    savings,
    savingsRate,
    balance,
    deltaPercent: {
      income: percentChange(income, prevIncome),
      expenses: percentChange(expenses, prevExpenses),
      savings: percentChange(savings, prevSavings),
      balance: percentChange(balance, prevBalance),
    },
  };
}

export interface SeriesPoint {
  /** Inizio del bucket, ISO locale (per asse X e label). */
  date: string;
  income: number;
  expenses: number;
}

interface BucketSeed extends SeriesPoint {
  time: number;
}

function bucketKey(d: Date, granularity: Granularity): Date {
  if (granularity === 'settimanale') return startOfWeek(d, { weekStartsOn: 1 });
  if (granularity === 'mensile') return startOfMonth(d);
  return startOfDay(d);
}

/**
 * Serie entrate/uscite suddivisa per giorno/settimana/mese nell'intervallo.
 * I bucket vuoti sono presenti con valori a zero, così il grafico mantiene
 * l'asse temporale continuo anche senza movimenti.
 */
export function buildSeries(
  transactions: Transaction[],
  range: DateRange,
  granularity: Granularity,
): SeriesPoint[] {
  const from = startOfDay(range.from);
  const to = startOfDay(range.to);
  const lo = from <= to ? from : to;
  const hi = from <= to ? to : from;

  const seeds: BucketSeed[] = [];
  if (granularity === 'giornaliero') {
    for (let cur = lo; cur <= hi; cur = addDays(cur, 1)) seeds.push(seed(cur));
  } else if (granularity === 'settimanale') {
    let cur = startOfWeek(lo, { weekStartsOn: 1 });
    while (cur <= hi) {
      seeds.push(seed(cur));
      cur = addWeeks(cur, 1);
    }
  } else {
    let cur = startOfMonth(lo);
    while (cur <= hi) {
      seeds.push(seed(cur));
      cur = addMonths(cur, 1);
    }
  }

  const byKey = new Map<number, BucketSeed>(seeds.map((s) => [s.time, s]));
  for (const t of transactions) {
    if (!isInRange(t, range)) continue;
    const key = bucketKey(txDate(t.date), granularity).getTime();
    const bucket = byKey.get(key);
    if (!bucket) continue;
    if (t.type === 'income') bucket.income += Number(t.amount) || 0;
    else bucket.expenses += Number(t.amount) || 0;
  }
  return seeds.map(({ date, income, expenses }) => ({ date, income, expenses }));
}

function seed(d: Date): BucketSeed {
  const b = startOfDay(d);
  return { time: b.getTime(), date: formatIsoDate(b), income: 0, expenses: 0 };
}

function formatIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface CategorySlice {
  categoryId: string;
  name: string;
  icon: string | null;
  color: string | null;
  total: number;
  /** Quota sul totale uscite del periodo, 0–100. */
  percent: number;
}

/** Ripartizione delle uscite del periodo per categoria, ordinata per importo decrescente. */
export function categoryBreakdown(transactions: Transaction[], range: DateRange): CategorySlice[] {
  const groups = new Map<string, CategorySlice>();
  let grandTotal = 0;

  for (const t of filterByRange(transactions, range)) {
    if (t.type !== 'expense') continue;
    const amount = Number(t.amount) || 0;
    grandTotal += amount;
    const id = t.category?.id ?? 'nessuna-categoria';
    const existing = groups.get(id);
    if (existing) {
      existing.total += amount;
    } else {
      groups.set(id, {
        categoryId: id,
        name: t.category?.name ?? '',
        icon: t.category?.icon ?? null,
        color: t.category?.color ?? null,
        total: amount,
        percent: 0,
      });
    }
  }

  return [...groups.values()]
    .map((g) => ({
      ...g,
      percent: grandTotal > 0 ? (g.total / grandTotal) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}
