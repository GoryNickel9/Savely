import { describe, it, expect } from 'vitest';
import { calculateNetWorth, calculateInvestmentPortfolioValue } from './netWorth';
import type { PortfolioAsset } from './types';

function asset(over: Partial<PortfolioAsset>): PortfolioAsset {
  return {
    id: 'a1',
    user_id: 'u1',
    name: 'X',
    symbol: null,
    type: 'stock',
    quantity: 1,
    purchase_price: 100,
    current_price: null,
    currency: 'EUR',
    purchase_date: '2024-01-01',
    sold_at: null,
    sold_price: null,
    notes: null,
    created_at: '',
    updated_at: '',
    ...over,
  };
}

describe('calculateNetWorth', () => {
  it('calcola il net worth solo da cashflow senza asset', () => {
    const result = calculateNetWorth({
      transactions: [
        { type: 'income', amount: 1000 },
        { type: 'expense', amount: 300 },
      ],
      assets: [],
    });
    expect(result.cashflow).toBe(700);
    expect(result.portfolioPL).toBe(0);
    expect(result.realEstateDiscounted).toBe(0);
    expect(result.netWorth).toBe(700);
  });

  it('include il P&L delle posizioni di investimento aperte', () => {
    const result = calculateNetWorth({
      transactions: [],
      assets: [
        asset({ type: 'stock', quantity: 10, purchase_price: 50, current_price: 60 }),
      ],
    });
    // PL = (60-50)*10 = 100
    expect(result.portfolioPL).toBe(100);
    expect(result.netWorth).toBe(100);
  });

  it('esclude cash e other dal P&L', () => {
    const result = calculateNetWorth({
      transactions: [],
      assets: [
        asset({ type: 'cash', quantity: 5, purchase_price: 1000, current_price: 1000 }),
        asset({ type: 'other', quantity: 1, purchase_price: 500, current_price: 800 }),
      ],
    });
    expect(result.portfolioPL).toBe(0);
    expect(result.netWorth).toBe(0);
  });

  it('applica lo sconto del 25% agli immobili', () => {
    const result = calculateNetWorth({
      transactions: [],
      assets: [
        asset({ type: 'real_estate', quantity: 1, purchase_price: 100000, current_price: 120000 }),
      ],
    });
    // Real estate uses current_price (120000) discounted 25% → 90000
    expect(result.realEstateDiscounted).toBe(90000);
    expect(result.netWorth).toBe(90000);
  });

  it('ignora le posizioni chiuse (sold_at)', () => {
    const result = calculateNetWorth({
      transactions: [],
      assets: [
        asset({ type: 'stock', quantity: 10, purchase_price: 50, current_price: 60, sold_at: '2024-06-01', sold_price: 600 }),
      ],
    });
    expect(result.portfolioPL).toBe(0);
  });

  it('combina cashflow + P&L + immobili', () => {
    const result = calculateNetWorth({
      transactions: [
        { type: 'income', amount: 5000 },
        { type: 'expense', amount: 2000 },
      ],
      assets: [
        asset({ type: 'etf', quantity: 2, purchase_price: 100, current_price: 150 }),
        asset({ type: 'real_estate', quantity: 1, purchase_price: 50000, current_price: 60000 }),
      ],
    });
    // cashflow 3000 + PL 100 + immobili 45000 = 48100
    expect(result.netWorth).toBe(48100);
  });

  it('accetta amount come stringa (Decimal DB)', () => {
    const result = calculateNetWorth({
      transactions: [
        { type: 'income', amount: '100.50' },
        { type: 'expense', amount: '30.20' },
      ],
      assets: [],
    });
    expect(result.cashflow).toBe(70.3);
  });
});

describe('calculateInvestmentPortfolioValue', () => {
  it('somma il valore di mercato di stock/etf/crypto/bond', () => {
    const value = calculateInvestmentPortfolioValue([
      asset({ type: 'stock', quantity: 10, current_price: 50 }),
      asset({ type: 'crypto', quantity: 2, current_price: 1000 }),
      asset({ type: 'cash', quantity: 1, current_price: 500 }),
    ]);
    // 500 + 2000 = 2500 (cash escluso)
    expect(value).toBe(2500);
  });
});
