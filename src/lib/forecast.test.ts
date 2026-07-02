import { describe, it, expect } from 'vitest';
import { projectCashFlow, nextDueDate } from './forecast';

describe('nextDueDate', () => {
  it('avanza di 1 mese per cadenza monthly', () => {
    const d = new Date('2026-01-15');
    const next = nextDueDate(d, 'monthly');
    expect(next.toISOString().slice(0, 10)).toBe('2026-02-15');
  });

  it('clampa il giorno a fine mese (31 gen → 28 feb)', () => {
    const d = new Date('2026-01-31');
    const next = nextDueDate(d, 'monthly');
    expect(next.toISOString().slice(0, 10)).toBe('2026-02-28');
  });

  it('avanza di 7 giorni per weekly', () => {
    const d = new Date('2026-01-15');
    const next = nextDueDate(d, 'weekly');
    expect(next.toISOString().slice(0, 10)).toBe('2026-01-22');
  });

  it('rispetta week_interval=2 per biweekly', () => {
    const d = new Date('2026-01-15');
    const next = nextDueDate(d, 'weekly', 2);
    expect(next.toISOString().slice(0, 10)).toBe('2026-01-29');
  });

  it('avanza di 3 mesi per quarterly', () => {
    const d = new Date('2026-01-15');
    const next = nextDueDate(d, 'quarterly');
    expect(next.toISOString().slice(0, 10)).toBe('2026-04-15');
  });

  it('avanza di 1 anno per yearly', () => {
    const d = new Date('2026-01-15');
    const next = nextDueDate(d, 'yearly');
    expect(next.toISOString().slice(0, 10)).toBe('2027-01-15');
  });
});

describe('projectCashFlow', () => {
  it('mantiene il saldo costante se burn è zero e nessuna ricorrenza', () => {
    const start = new Date('2026-01-01');
    const result = projectCashFlow({
      medianMonthlyBurn: 0,
      recurring: [],
      startDate: start,
      months: 1,
      currentBalance: 1000,
    });
    expect(result.endBalance).toBe(1000);
    expect(result.minBalance).toBe(1000);
    expect(result.negativeOn).toBeNull();
  });

  it('proietta un saldo decrescente con burn mensile', () => {
    const start = new Date('2026-01-01');
    const result = projectCashFlow({
      medianMonthlyBurn: 300, // 10/day
      recurring: [],
      startDate: start,
      months: 1,
      currentBalance: 500,
    });
    // After 1 month (~31 days): 500 - (10 * 31) = 190
    expect(result.endBalance).toBeLessThan(500);
    expect(result.endBalance).toBeGreaterThan(150);
    expect(result.negativeOn).toBeNull();
  });

  it('segnala la data di scoperto quando il saldo va negativo', () => {
    const start = new Date('2026-01-01');
    const result = projectCashFlow({
      medianMonthlyBurn: 3000, // 100/day
      recurring: [],
      startDate: start,
      months: 1,
      currentBalance: 500,
    });
    expect(result.negativeOn).not.toBeNull();
    expect(result.minBalance).toBeLessThan(0);
  });

  it('sottrae le ricorrenze nelle date di scadenza proiettate', () => {
    const start = new Date('2026-01-01');
    const result = projectCashFlow({
      medianMonthlyBurn: 0,
      recurring: [{ amount: 200, frequency: 'monthly', next_due_date: '2026-01-15' }],
      startDate: start,
      months: 1,
      currentBalance: 1000,
    });
    // 1000 - 200 = 800 at end (zero burn, one recurring hit on Jan 15)
    expect(result.endBalance).toBe(800);
  });

  it('multiple ricorrenze con scadenze diverse si sommano', () => {
    const start = new Date('2026-01-01');
    const result = projectCashFlow({
      medianMonthlyBurn: 0,
      recurring: [
        { amount: 100, frequency: 'monthly', next_due_date: '2026-01-10' },
        { amount: 50, frequency: 'monthly', next_due_date: '2026-01-20' },
      ],
      startDate: start,
      months: 1,
      currentBalance: 1000,
    });
    expect(result.endBalance).toBe(850);
  });

  it('fast-forwarda le scadenze passate alla prima data futura', () => {
    const start = new Date('2026-06-01');
    const result = projectCashFlow({
      medianMonthlyBurn: 0,
      recurring: [{ amount: 200, frequency: 'monthly', next_due_date: '2025-12-15' }],
      startDate: start,
      months: 1,
      currentBalance: 1000,
    });
    // Scadenza storica → avanzata a 2026-06-15 → -200
    expect(result.endBalance).toBe(800);
  });
});
