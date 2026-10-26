import { describe, expect, it } from 'vitest';
import { addDays, subDays } from 'date-fns';
import type { Transaction, Budget } from './types';
import type { RecurringExpense } from '@/hooks/useRecurringExpenses';
import { forecastSpending, transactionEUR } from './spendingForecast';
import { todayLocalISO } from './utils';

const today = new Date(2026, 9, 20);
function tx(date: string, amount = 10, extra: Partial<Transaction> = {}): Transaction {
  return { id: `${date}-${amount}-${extra.description ?? ''}`, user_id: 'u', type: 'expense', amount, currency: 'EUR', exchange_rate_eur: 1,
    category_id: 'food', date, description: null, deleted_at: null, created_at: date, updated_at: date, ...extra };
}
function history(reference = today, amount = 10) {
  return Array.from({ length: 180 }, (_, index) => tx(todayLocalISO(subDays(reference, 180 - index)), amount));
}
function recurring(extra: Partial<RecurringExpense> = {}): RecurringExpense {
  return { id: 'r', user_id: 'u', name: 'Streaming', amount: 15, currency: 'EUR', category_id: 'streaming', frequency: 'monthly', next_due_date: '2026-10-25',
    is_active: true, deleted_at: null, created_at: '2025-01-01', updated_at: '2025-01-01', ...extra };
}
function budget(category_id = 'food', amount = 500): Budget {
  return { id: category_id, user_id: 'u', category_id, amount, currency: 'EUR', month: 1, year: 2000, created_at: '', updated_at: '' };
}

describe('forecastSpending', () => {
  it('prevede i giorni restanti su 180 giorni, senza estrapolare due volte lo speso', () => {
    const result = forecastSpending([...history(), tx('2026-10-20')], [budget()], [], today);
    expect(result.historyDays).toBe(180);
    expect(result.spent).toBe(200);
    expect(result.variable).toBe(110);
    expect(result.total).toBe(310);
    expect(result.budget).toEqual({ limit: 500 });
    expect(result.points.at(-1)?.projected).toBe(310);
    expect(result.points.filter(point => point.actual !== null)).toHaveLength(20);
  });

  it('include giorni a spesa zero e distingue i giorni della settimana', () => {
    const transactions = history().map(item => ({ ...item, amount: new Date(item.date+'T00:00:00').getDay() === 6 ? 70 : 0 }));
    const result = forecastSpending(transactions, [], [], today);
    const remainingSaturdays = Array.from({ length: 11 }, (_, index) => addDays(today, index + 1)).filter(date => date.getDay() === 6).length;
    expect(result.variable).toBe(70 * remainingSaturdays);
  });

  it('aggiunge ricorrenti future, rimuovendo lo stesso flusso dalla base variabile', () => {
    const subscriptions = ['2026-05-25', '2026-06-25', '2026-07-25', '2026-08-25', '2026-09-25'].map(date => tx(date, 15, { description: 'Streaming', category_id: 'streaming' }));
    const result = forecastSpending([...history(), ...subscriptions], [], [recurring()], today);
    expect(result.scheduled).toBe(15);
    expect(result.variable).toBe(110);
  });

  it('non riconta una ricorrente già pagata in anticipo, anche con importo diverso', () => {
    const result = forecastSpending([...history(), tx('2026-10-18', 17, { description: 'Streaming', category_id: 'streaming' })], [], [recurring()], today);
    expect(result.scheduled).toBe(0);
    expect(result.total).toBe(317);
  });

  it('non duplica una ricorrente già inserita come transazione futura', () => {
    const result = forecastSpending([...history(), tx('2026-10-25', 17, { description: 'Streaming', category_id: 'streaming' })], [], [recurring()], today);
    expect(result.scheduled).toBe(17);
    expect(result.variable).toBe(110);
    expect(result.spent).toBe(190);
  });

  it('una spesa variabile programmata sostituisce la previsione per quella categoria e quel giorno', () => {
    const result = forecastSpending([...history(), tx('2026-10-25', 25)], [], [], today);
    expect(result.scheduled).toBe(25);
    expect(result.variable).toBe(100);
    expect(result.total).toBe(315);
  });

  it('non inventa un totale o una fascia con storico insufficiente', () => {
    const result = forecastSpending([tx('2026-10-01')], [], [], today);
    expect(result.available).toBe(false);
    expect(result.total).toBeNull();
    expect(result.points.every(point => point.projected === null)).toBe(true);
  });

  it('non usa transazioni future per apprendere abitudini o disponibilità dello storico', () => {
    expect(forecastSpending([tx('2026-11-01')], [], [], today).historyDays).toBe(0);
    const base = forecastSpending(history(), [], [], today);
    expect(forecastSpending([...history(), tx('2026-12-01', 99999)], [], [], today)).toEqual(base);
  });

  it('converte con il cambio registrato e rifiuta input non finiti', () => {
    expect(transactionEUR(tx('2026-10-01', 100, { currency: 'USD', exchange_rate_eur: 0.9 }))).toBe(90);
    expect(() => forecastSpending([tx('2026-10-01', NaN)], [], [], today)).toThrow();
    expect(() => forecastSpending([tx('2026-02-30')], [], [], today)).toThrow();
    expect(() => transactionEUR(tx('2026-10-01', 100, { currency: 'USD', exchange_rate_eur: 0 }))).toThrow();
  });

  it('somma i budget mensili e confronta tutte le spese, anche senza un budget di categoria', () => {
    const result = forecastSpending([...history(), tx('2026-10-10', 600, { category_id: 'rent' })], [budget('food', 500), budget('transport', 100)], [], today);
    expect(result.total).toBeGreaterThan(600);
    expect(result.budget).toEqual({ limit: 600 });
  });

  it('non ripropone una ricorrente disattivata attraverso il rilevatore automatico', () => {
    const subscriptions = ['2026-05-25', '2026-06-25', '2026-07-25', '2026-08-25', '2026-09-25'].map(date => tx(date, 15, { description: 'Streaming' }));
    expect(forecastSpending([...history(), ...subscriptions], [], [recurring({ is_active: false })], today).scheduled).toBe(0);
  });

  it('rileva una ricorrenza non ancora configurata', () => {
    const subscriptions = ['2026-05-25', '2026-06-25', '2026-07-25', '2026-08-25', '2026-09-25'].map(date => tx(date, 15, { description: 'Streaming', category_id: 'streaming' }));
    expect(forecastSpending([...history(), ...subscriptions], [], [], today).scheduled).toBe(15);
  });

  it('mantiene una ricorrenza dopo un rincaro senza riprevedere un addebito già sostenuto', () => {
    const subscriptions = ['2026-05-10', '2026-06-10', '2026-07-10', '2026-08-10', '2026-09-10'].map(date => tx(date, 12, { description: 'Streaming', category_id: 'streaming' }));
    subscriptions.push(tx('2026-10-10', 15, { description: 'Streaming', category_id: 'streaming' }));
    const result = forecastSpending([...history(), ...subscriptions], [], [], today);
    expect(result.variable).toBe(110);
    expect(result.scheduled).toBe(0);
  });

  it('rispetta intervalli settimanali e il cambio mese sul giorno 31', () => {
    const january = new Date(2026, 0, 20);
    const march = new Date(2026, 2, 20);
    expect(forecastSpending(history(january), [], [recurring({ frequency: 'weekly', week_interval: 2, next_due_date: '2026-01-24' })], january).scheduled).toBe(15);
    expect(forecastSpending(history(march), [], [recurring({ next_due_date: '2026-01-31' })], march).scheduled).toBe(15);
  });

  it('a fine mese la proiezione coincide con lo speso', () => {
    const end = new Date(2026, 9, 31);
    const result = forecastSpending([...history(end), tx('2026-10-31')], [], [], end);
    expect(result.total).toBe(result.spent);
    expect(result.variable).toBe(0);
  });

  it('non somma importi di ricorrenti in valute diverse senza un cambio', () => {
    const result = forecastSpending(history(), [], [recurring({ currency: 'USD' })], today);
    expect(result.available).toBe(false);
    expect(result.total).toBeNull();
    expect(result.unsupportedRecurring).toBe(1);
  });

  it('mantiene somme, monotonia e determinismo per ogni giorno del mese', () => {
    for (let day = 1; day <= 31; day++) {
      const date = new Date(2026, 9, day);
      const input = history(date);
      const result = forecastSpending(input, [], [], date);
      expect(result).toEqual(forecastSpending(input, [], [], date));
      expect(result.total).toBeCloseTo(result.spent + result.scheduled + result.variable, 2);
      const projected = result.points.map(point => point.projected).filter((value): value is number => value !== null);
      expect(projected.every((value, index) => index === 0 || value >= projected[index-1])).toBe(true);
    }
  });
});
