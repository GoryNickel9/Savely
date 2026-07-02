import { describe, it, expect } from 'vitest';
import { generateInsights, type InsightsInput } from './insights';
import type { Transaction, Budget, Category, PortfolioAsset } from './types';
import type { NetWorthSnapshot } from '@/hooks/useNetWorthHistory';
import type { RecurringCandidate } from './recurringDetection';

// Reference date: fixed for deterministic tests.
const REF = new Date('2026-06-15T12:00:00');

// --- Builders (compact factories for domain objects) ------------------------

function tx(over: Partial<Transaction> & Pick<Transaction, 'type' | 'amount' | 'date'>): Transaction {
  return {
    id: `tx-${Math.random().toString(36).slice(2)}`,
    user_id: 'u1',
    category_id: 'cat1',
    currency: 'EUR',
    description: null,
    exchange_rate_eur: 1,
    created_at: over.date,
    updated_at: over.date,
    deleted_at: null,
    ...over,
  } as Transaction;
}

function cat(over: Partial<Category> = {}): Category {
  return {
    id: 'cat1',
    user_id: 'u1',
    name: 'Ristorazione',
    icon: '🍽️',
    color: '#f00',
    type: 'expense',
    created_at: '2024-01-01',
    deleted_at: null,
    ...over,
  } as Category;
}

function budget(over: Partial<Budget> = {}): Budget {
  return {
    id: 'b1',
    user_id: 'u1',
    category_id: 'cat1',
    amount: 200,
    currency: 'EUR',
    month: 1,
    year: 2000,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
    ...over,
  } as Budget;
}

function asset(over: Partial<PortfolioAsset>): PortfolioAsset {
  return {
    id: 'a1',
    user_id: 'u1',
    name: 'AAPL',
    symbol: 'AAPL',
    type: 'stock',
    quantity: 10,
    purchase_price: 100,
    current_price: 100,
    currency: 'EUR',
    purchase_date: '2024-01-01',
    sold_at: null,
    sold_price: null,
    notes: null,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
    ...over,
  } as PortfolioAsset;
}

function snap(date: string, netWorth: number): NetWorthSnapshot {
  return {
    id: `s-${date}`,
    date,
    net_worth: netWorth,
    components: null,
    created_at: date,
  };
}

function baseInput(over: Partial<InsightsInput> = {}): InsightsInput {
  return {
    transactions: [],
    budgets: [],
    categories: [cat()],
    openAssets: [],
    netWorthHistory: [],
    recurringCandidates: [],
    referenceDate: REF,
    ...over,
  };
}

// --- Tests ------------------------------------------------------------------

describe('generateInsights - edge cases', () => {
  it('ritorna lista vuota con input vuoto', () => {
    expect(generateInsights(baseInput())).toEqual([]);
  });

  it('non solleva eccezioni con tutti i campi vuoti', () => {
    expect(() => generateInsights(baseInput({ categories: [] }))).not.toThrow();
  });
});

describe('detectSpendingAnomalies', () => {
  it('rileva spesa molto sopra la mediana mensile', () => {
    // Mediana storica: ~100€/mese per diversi mesi.
    const transactions: Transaction[] = [
      // current month (2026-06): 300€ → 3× la mediana
      tx({ type: 'expense', amount: 300, date: '2026-06-10', category_id: 'cat1' }),
      // storico: 100€ al mese per 4 mesi
      ...['2026-05-10', '2026-04-10', '2026-03-10', '2026-02-10'].map((d) =>
        tx({ type: 'expense', amount: 100, date: d, category_id: 'cat1' })
      ),
    ];
    const insights = generateInsights(baseInput({ transactions }));
    const anomaly = insights.find((i) => i.kind === 'spending_anomaly');
    expect(anomaly).toBeDefined();
    expect(anomaly!.severity).toBe('warning');
    expect(anomaly!.category).toBe('Ristorazione');
    expect(anomaly!.message).toContain('+200%');
  });

  it('ignora spese vicine alla mediana', () => {
    const transactions: Transaction[] = [
      tx({ type: 'expense', amount: 110, date: '2026-06-10', category_id: 'cat1' }),
      ...['2026-05-10', '2026-04-10', '2026-03-10'].map((d) =>
        tx({ type: 'expense', amount: 100, date: d, category_id: 'cat1' })
      ),
    ];
    const insights = generateInsights(baseInput({ transactions }));
    expect(insights.find((i) => i.kind === 'spending_anomaly')).toBeUndefined();
  });

  it('ignora anomalie sotto la soglia minima', () => {
    const transactions: Transaction[] = [
      tx({ type: 'expense', amount: 40, date: '2026-06-10', category_id: 'cat1' }),
      ...['2026-05-10', '2026-04-10', '2026-03-10'].map((d) =>
        tx({ type: 'expense', amount: 10, date: d, category_id: 'cat1' })
      ),
    ];
    const insights = generateInsights(baseInput({ transactions }));
    expect(insights.find((i) => i.kind === 'spending_anomaly')).toBeUndefined();
  });
});

describe('detectBudgetExceeded', () => {
  it('rileva quando la spesa del mese supera il budget', () => {
    const transactions = [
      tx({ type: 'expense', amount: 250, date: '2026-06-10', category_id: 'cat1' }),
    ];
    const budgets = [budget({ amount: 200 })];
    const insights = generateInsights(baseInput({ transactions, budgets }));
    const b = insights.find((i) => i.kind === 'budget_exceeded');
    expect(b).toBeDefined();
    expect(b!.severity).toBe('warning');
    expect(b!.value).toBe(50);
  });

  it('non rileva quando la spesa è sotto il budget', () => {
    const transactions = [
      tx({ type: 'expense', amount: 100, date: '2026-06-10', category_id: 'cat1' }),
    ];
    const budgets = [budget({ amount: 200 })];
    const insights = generateInsights(baseInput({ transactions, budgets }));
    expect(insights.find((i) => i.kind === 'budget_exceeded')).toBeUndefined();
  });

  it('ignora budget di altri mesi', () => {
    const transactions = [
      tx({ type: 'expense', amount: 999, date: '2026-05-10', category_id: 'cat1' }),
    ];
    const budgets = [budget({ amount: 200 })];
    const insights = generateInsights(baseInput({ transactions, budgets }));
    expect(insights.find((i) => i.kind === 'budget_exceeded')).toBeUndefined();
  });
});

describe('detectPortfolioLoss', () => {
  it('rileva posizione con P&L ≤ -15%', () => {
    const openAssets = [asset({ current_price: 80, purchase_price: 100 })];
    const insights = generateInsights(baseInput({ openAssets }));
    const p = insights.find((i) => i.kind === 'portfolio_loss');
    expect(p).toBeDefined();
    expect(p!.severity).toBe('warning');
    expect(p!.title).toContain('AAPL');
  });

  it('non rileva posizione in lieve perdita', () => {
    const openAssets = [asset({ current_price: 90, purchase_price: 100 })]; // -10%
    const insights = generateInsights(baseInput({ openAssets }));
    expect(insights.find((i) => i.kind === 'portfolio_loss')).toBeUndefined();
  });

  it('non rileva posizione in utile', () => {
    const openAssets = [asset({ current_price: 120, purchase_price: 100 })];
    const insights = generateInsights(baseInput({ openAssets }));
    expect(insights.find((i) => i.kind === 'portfolio_loss')).toBeUndefined();
  });

  it('ignora asset senza current_price', () => {
    const openAssets = [asset({ current_price: null })];
    expect(() => generateInsights(baseInput({ openAssets }))).not.toThrow();
  });
});

describe('detectNetWorthMilestone', () => {
  it('rileva nuovo massimo storico', () => {
    const history = [snap('2026-06-01', 1000), snap('2026-06-14', 1500)];
    const insights = generateInsights(baseInput({ netWorthHistory: history }));
    const m = insights.find((i) => i.kind === 'net_worth_milestone');
    expect(m).toBeDefined();
    expect(m!.severity).toBe('positive');
    expect(m!.value).toBe(1500);
  });

  it('non rileva se sotto il massimo precedente', () => {
    const history = [snap('2026-06-01', 2000), snap('2026-06-14', 1000)];
    const insights = generateInsights(baseInput({ netWorthHistory: history }));
    expect(insights.find((i) => i.kind === 'net_worth_milestone')).toBeUndefined();
  });

  it('richiede un gap minimo per evitare rumore', () => {
    const history = [snap('2026-06-01', 1000), snap('2026-06-14', 1000.5)];
    const insights = generateInsights(baseInput({ netWorthHistory: history }));
    expect(insights.find((i) => i.kind === 'net_worth_milestone')).toBeUndefined();
  });

  it('non rileva con meno di 2 snapshot', () => {
    const insights = generateInsights(baseInput({ netWorthHistory: [snap('2026-06-01', 1000)] }));
    expect(insights.find((i) => i.kind === 'net_worth_milestone')).toBeUndefined();
  });
});

describe('detectSavingMonth', () => {
  it('rileva mese con risparmio ben sopra la media', () => {
    const transactions: Transaction[] = [
      // current month: +1000 net
      tx({ type: 'income', amount: 1500, date: '2026-06-05' }),
      tx({ type: 'expense', amount: 500, date: '2026-06-10' }),
      // storico: ~400 net/mese per 3 mesi
      tx({ type: 'income', amount: 900, date: '2026-05-05' }),
      tx({ type: 'expense', amount: 500, date: '2026-05-10' }),
      tx({ type: 'income', amount: 900, date: '2026-04-05' }),
      tx({ type: 'expense', amount: 500, date: '2026-04-10' }),
      tx({ type: 'income', amount: 900, date: '2026-03-05' }),
      tx({ type: 'expense', amount: 500, date: '2026-03-10' }),
    ];
    const insights = generateInsights(baseInput({ transactions }));
    const s = insights.find((i) => i.kind === 'saving_month');
    expect(s).toBeDefined();
    expect(s!.severity).toBe('positive');
  });

  it('non rileva mese nella media', () => {
    const transactions: Transaction[] = [
      tx({ type: 'income', amount: 900, date: '2026-06-05' }),
      tx({ type: 'expense', amount: 500, date: '2026-06-10' }),
      ...['2026-05', '2026-04', '2026-03'].flatMap((m) => [
        tx({ type: 'income', amount: 900, date: `${m}-05` }),
        tx({ type: 'expense', amount: 500, date: `${m}-10` }),
      ]),
    ];
    const insights = generateInsights(baseInput({ transactions }));
    expect(insights.find((i) => i.kind === 'saving_month')).toBeUndefined();
  });
});

describe('detectCategoryTrend', () => {
  it('rileva crescita significativa negli ultimi 3 mesi', () => {
    const transactions: Transaction[] = [
      // 3 mesi recenti: 300/mese
      ...['2026-05-10', '2026-04-10', '2026-03-10'].map((d) =>
        tx({ type: 'expense', amount: 300, date: d, category_id: 'cat1' })
      ),
      // mesi precedenti (entro 12): 100/mese
      ...['2026-02-10', '2026-01-10', '2025-12-10', '2025-11-10'].map((d) =>
        tx({ type: 'expense', amount: 100, date: d, category_id: 'cat1' })
      ),
    ];
    const insights = generateInsights(baseInput({ transactions }));
    const t = insights.find((i) => i.kind === 'category_trend');
    expect(t).toBeDefined();
    expect(t!.severity).toBe('info');
  });

  it('non rileva trend stabile', () => {
    const transactions: Transaction[] = ['2026-05-10', '2026-04-10', '2026-03-10', '2026-02-10', '2026-01-10'].map(
      (d) => tx({ type: 'expense', amount: 100, date: d, category_id: 'cat1' })
    );
    const insights = generateInsights(baseInput({ transactions }));
    expect(insights.find((i) => i.kind === 'category_trend')).toBeUndefined();
  });
});

describe('detectNewRecurring', () => {
  it('mostra le top candidates per confidence/occorrenze', () => {
    const recurringCandidates: RecurringCandidate[] = [
      {
        description: 'Netflix',
        normalizedKey: 'netflix',
        medianAmount: 12.99,
        frequency: 'monthly',
        lastDate: '2026-06-01',
        suggestedNextDueDate: '2026-07-01',
        occurrenceCount: 5,
        confidence: 'high',
      },
    ];
    const insights = generateInsights(baseInput({ recurringCandidates }));
    const r = insights.find((i) => i.kind === 'new_recurring_detected');
    expect(r).toBeDefined();
    expect(r!.severity).toBe('info');
    expect(r!.title).toContain('Netflix');
  });

  it('ritorna vuoto se nessuna candidate', () => {
    const insights = generateInsights(baseInput({ recurringCandidates: [] }));
    expect(insights.find((i) => i.kind === 'new_recurring_detected')).toBeUndefined();
  });
});

describe('detectRecurringPriceChange', () => {
  it('rileva rincaro abbonamento', () => {
    const recurringCandidates: RecurringCandidate[] = [
      {
        description: 'Netflix',
        normalizedKey: 'netflix',
        medianAmount: 12.99,
        frequency: 'monthly',
        lastDate: '2026-06-01',
        suggestedNextDueDate: '2026-07-01',
        occurrenceCount: 4,
        confidence: 'high',
      },
    ];
    const transactions = [
      tx({ type: 'expense', amount: 17.99, date: '2026-06-01', description: 'Netflix' }),
      tx({ type: 'expense', amount: 12.99, date: '2026-05-01', description: 'Netflix' }),
    ];
    const insights = generateInsights(baseInput({ transactions, recurringCandidates }));
    const p = insights.find((i) => i.kind === 'recurring_price_change');
    expect(p).toBeDefined();
    expect(p!.severity).toBe('warning'); // rincaro → warning
  });

  it('rileva ribasso come info', () => {
    const recurringCandidates: RecurringCandidate[] = [
      {
        description: 'Spotify',
        normalizedKey: 'spotify',
        medianAmount: 10.99,
        frequency: 'monthly',
        lastDate: '2026-06-01',
        suggestedNextDueDate: '2026-07-01',
        occurrenceCount: 4,
        confidence: 'high',
      },
    ];
    const transactions = [
      tx({ type: 'expense', amount: 8.99, date: '2026-06-01', description: 'Spotify' }),
      tx({ type: 'expense', amount: 10.99, date: '2026-05-01', description: 'Spotify' }),
    ];
    const insights = generateInsights(baseInput({ transactions, recurringCandidates }));
    const p = insights.find((i) => i.kind === 'recurring_price_change');
    expect(p).toBeDefined();
    expect(p!.severity).toBe('info');
  });

  it('non rileva variazioni minime', () => {
    const recurringCandidates: RecurringCandidate[] = [
      {
        description: 'Netflix',
        normalizedKey: 'netflix',
        medianAmount: 12.99,
        frequency: 'monthly',
        lastDate: '2026-06-01',
        suggestedNextDueDate: '2026-07-01',
        occurrenceCount: 4,
        confidence: 'high',
      },
    ];
    const transactions = [
      tx({ type: 'expense', amount: 13.5, date: '2026-06-01', description: 'Netflix' }),
      tx({ type: 'expense', amount: 12.99, date: '2026-05-01', description: 'Netflix' }),
    ];
    const insights = generateInsights(baseInput({ transactions, recurringCandidates }));
    expect(insights.find((i) => i.kind === 'recurring_price_change')).toBeUndefined();
  });
});

describe('ordinamento', () => {
  it('warning viene prima di positive e info', () => {
    const transactions: Transaction[] = [
      // budget exceeded (warning)
      tx({ type: 'expense', amount: 500, date: '2026-06-10', category_id: 'cat1' }),
    ];
    const budgets = [budget({ amount: 100 })];
    const history = [snap('2026-06-01', 1000), snap('2026-06-14', 5000)]; // milestone (positive)
    const insights = generateInsights(baseInput({ transactions, budgets, netWorthHistory: history }));
    const kinds = insights.map((i) => i.severity);
    const warningIdx = kinds.indexOf('warning');
    const positiveIdx = kinds.indexOf('positive');
    expect(warningIdx).toBeGreaterThanOrEqual(0);
    expect(positiveIdx).toBeGreaterThanOrEqual(0);
    expect(warningIdx).toBeLessThan(positiveIdx);
  });
});
