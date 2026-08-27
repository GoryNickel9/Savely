import { describe, expect, it } from 'vitest';
import { Transaction } from '@/lib/types';
import {
  buildSeries,
  categoryBreakdown,
  computePeriodStats,
  isInRange,
  percentChange,
  previousRange,
  resolvePeriod,
  sumByType,
  balanceUntil,
  DateRange,
  PeriodSelection,
} from './dashboardStats';

const AUG = (day: number) => `2026-08-${String(day).padStart(2, '0')}`;

function tx(partial: Partial<Transaction> & Pick<Transaction, 'date' | 'type' | 'amount'>): Transaction {
  return {
    id: partial.id ?? Math.random().toString(),
    user_id: 'u1',
    category_id: partial.category_id ?? null,
    type: partial.type,
    amount: partial.amount,
    currency: 'EUR',
    description: partial.description ?? null,
    date: partial.date,
    exchange_rate_eur: 1,
    created_at: '',
    updated_at: '',
    deleted_at: null,
    category: partial.category,
  };
}

const rangeAug: DateRange = { from: new Date(2026, 7, 1), to: new Date(2026, 7, 31) };

describe('isInRange', () => {
  it('include gli estremi del periodo', () => {
    const range: DateRange = { from: new Date(2026, 7, 10), to: new Date(2026, 7, 20) };
    expect(isInRange({ date: AUG(10) }, range)).toBe(true);
    expect(isInRange({ date: AUG(20) }, range)).toBe(true);
    expect(isInRange({ date: AUG(9) }, range)).toBe(false);
    expect(isInRange({ date: AUG(21) }, range)).toBe(false);
  });

  it('normalizza gli intervalli invertiti (from > to)', () => {
    const inverted: DateRange = { from: new Date(2026, 7, 20), to: new Date(2026, 7, 10) };
    expect(isInRange({ date: AUG(15) }, inverted)).toBe(true);
  });
});

describe('resolvePeriod', () => {
  it('mese corrente: dal primo del mese a oggi', () => {
    const today = new Date(2026, 7, 27);
    expect(resolvePeriod({ preset: 'mese-corrente' }, today)).toEqual({
      from: new Date(2026, 7, 1),
      to: new Date(2026, 7, 27),
    });
  });

  it('mese precedente: intero mese', () => {
    const today = new Date(2026, 7, 27);
    expect(resolvePeriod({ preset: 'mese-precedente' }, today)).toEqual({
      from: new Date(2026, 6, 1),
      to: new Date(2026, 6, 31),
    });
  });

  it('personalizzato con estremi invertiti si normalizza', () => {
    const selection: PeriodSelection = { preset: 'personalizzato', from: AUG(20), to: AUG(5) };
    expect(resolvePeriod(selection, new Date(2026, 7, 27))).toEqual({
      from: new Date(2026, 7, 5),
      to: new Date(2026, 7, 20),
    });
  });

  it('personalizzato incompleto ripiega sul mese corrente', () => {
    const today = new Date(2026, 7, 27);
    expect(resolvePeriod({ preset: 'personalizzato' }, today)).toEqual({
      from: new Date(2026, 7, 1),
      to: new Date(2026, 7, 27),
    });
  });
});

describe('previousRange', () => {
  it('ha la stessa durata e termina il giorno prima', () => {
    const prev = previousRange({ from: new Date(2026, 7, 1), to: new Date(2026, 7, 27) });
    // 27 giorni inclusi anche nel periodo precedente
    expect(prev.to).toEqual(new Date(2026, 6, 31));
    expect(prev.from).toEqual(new Date(2026, 6, 5));
  });
});

describe('sumByType e balanceUntil', () => {
  const transactions: Transaction[] = [
    tx({ date: AUG(5), type: 'income', amount: 2000 }),
    tx({ date: AUG(10), type: 'expense', amount: 300 }),
    tx({ date: AUG(15), type: 'expense', amount: 100 }),
    tx({ date: '2026-07-20', type: 'income', amount: 500 }), // fuori dal periodo
  ];

  it('somma solo il tipo richiesto dentro il range', () => {
    expect(sumByType(transactions, 'income', rangeAug)).toBe(2000);
    expect(sumByType(transactions, 'expense', rangeAug)).toBe(400);
  });

  it('saldo cumulato fino a fine agosto (incluso luglio)', () => {
    expect(balanceUntil(transactions, new Date(2026, 7, 31))).toBe(2100);
  });

  it('saldo cumulato al 14 agosto esclude la spesa del 15', () => {
    // 500 (luglio) + 2000 − 300
    expect(balanceUntil(transactions, new Date(2026, 7, 14))).toBe(2200);
  });
});

describe('percentChange', () => {
  it('calcola la variazione relativa', () => {
    expect(percentChange(110, 100)).toBeCloseTo(10);
    expect(percentChange(50, 200)).toBeCloseTo(-75);
  });

  it('restituisce null quando il precedente è zero', () => {
    expect(percentChange(100, 0)).toBeNull();
  });
});

describe('computePeriodStats', () => {
  const transactions: Transaction[] = [
    tx({ date: '2026-07-05', type: 'income', amount: 1000 }),
    tx({ date: '2026-07-10', type: 'expense', amount: 400 }),
    tx({ date: AUG(3), type: 'income', amount: 2800 }),
    tx({ date: AUG(8), type: 'expense', amount: 500 }),
    tx({ date: AUG(12), type: 'expense', amount: 700 }),
  ];

  it('aggrega entrate, uscite, risparmio e tasso', () => {
    const stats = computePeriodStats(transactions, { from: new Date(2026, 7, 1), to: new Date(2026, 7, 31) });
    expect(stats.income).toBe(2800);
    expect(stats.expenses).toBe(1200);
    expect(stats.savings).toBe(1600);
    expect(stats.savingsRate).toBeCloseTo((1600 / 2800) * 100);
  });

  it('confronta col periodo precedente di pari durata (luglio)', () => {
    const stats = computePeriodStats(transactions, { from: new Date(2026, 7, 1), to: new Date(2026, 7, 31) });
    // Precedente: 1–31 luglio → entrate 1000, uscite 400, risparmio 600, saldo 600
    expect(stats.deltaPercent.income).toBeCloseTo(180); // (2800−1000)/1000
    expect(stats.deltaPercent.expenses).toBeCloseTo(200); // (1200−400)/400
    expect(stats.deltaPercent.savings).toBeCloseTo((1600 - 600) / 6);
    expect(stats.deltaPercent.balance).toBeCloseTo((2200 - 600) / 6); // saldo 600 → 2200
  });

  it('tasso di risparmio zero senza entrate', () => {
    const onlyExpenses = [tx({ date: AUG(2), type: 'expense', amount: 50 })];
    const stats = computePeriodStats(onlyExpenses, { from: new Date(2026, 7, 1), to: new Date(2026, 7, 28) });
    expect(stats.savingsRate).toBe(0);
    expect(stats.deltaPercent.expenses).toBeNull(); // precedente vuoto → null
  });
});

describe('buildSeries', () => {
  const transactions: Transaction[] = [
    tx({ date: AUG(1), type: 'income', amount: 100 }),
    tx({ date: AUG(2), type: 'expense', amount: 40 }),
    tx({ date: AUG(16), type: 'expense', amount: 60 }),
  ];
  const range: DateRange = { from: new Date(2026, 7, 1), to: new Date(2026, 7, 31) };

  it('bucket giornaliero: un punto per giorno, totali coerenti', () => {
    const series = buildSeries(transactions, range, 'giornaliero');
    expect(series).toHaveLength(31);
    const totalIncome = series.reduce((s, p) => s + p.income, 0);
    const totalExpenses = series.reduce((s, p) => s + p.expenses, 0);
    expect(totalIncome).toBe(100);
    expect(totalExpenses).toBe(100);
    expect(series[0]).toMatchObject({ income: 100, expenses: 0 });
  });

  it('bucket mensile: un solo punto per agosto', () => {
    const series = buildSeries(transactions, range, 'mensile');
    expect(series).toHaveLength(1);
    expect(series[0].date).toBe('2026-08-01');
    expect(series[0].expenses).toBe(100);
  });

  it('bucket settimanale: copre l\'intero mese partendo da lunedì', () => {
    const series = buildSeries([], range, 'settimanale');
    // agosto 2026: settimana parziale dal lun 27 lug, poi lun 3, 10, 17, 24 e 31 ago → 6 settimane
    expect(series).toHaveLength(6);
    expect(series[0].date).toBe('2026-07-27'); // settimana del lunedì precedente al 1° ago
    expect(series[series.length - 1].date).toBe('2026-08-31');
  });
});

describe('categoryBreakdown', () => {
  it('raggruppa le sole uscite per categoria con percentuali ordinate', () => {
    const casa = { id: 'casa', user_id: 'u1', name: 'Casa', icon: '🏠', color: '#3b82f6', type: 'expense' as const, created_at: '', deleted_at: null };
    const spesa = { ...casa, id: 'spesa', name: 'Alimentari', icon: '🛒' };
    const transactions: Transaction[] = [
      tx({ date: AUG(1), type: 'expense', amount: 600, category: casa }),
      tx({ date: AUG(2), type: 'expense', amount: 400, category: casa }),
      tx({ date: AUG(3), type: 'expense', amount: 200, category: spesa }),
      tx({ date: AUG(4), type: 'income', amount: 9000, category: spesa }), // ignorata
    ];
    const slices = categoryBreakdown(transactions, rangeAug);
    expect(slices).toHaveLength(2);
    expect(slices[0]).toMatchObject({ name: 'Casa', total: 1000 });
    expect(slices[0].percent).toBeCloseTo((1000 / 1200) * 100);
    expect(slices[1].name).toBe('Alimentari');
  });

  it('le transazioni senza categoria finiscono in un gruppo proprio', () => {
    const slices = categoryBreakdown([tx({ date: AUG(1), type: 'expense', amount: 30 })], rangeAug);
    expect(slices).toHaveLength(1);
    expect(slices[0].categoryId).toBe('nessuna-categoria');
    expect(slices[0].percent).toBe(100);
  });
});
