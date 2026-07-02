import { describe, expect, it } from 'vitest';
import {
  validateCoupleCode,
  canShareExpense,
  calculateSharedAmount,
  filterSharedExpensesForBudget,
  getMedianMonthlySpendingShared,
  SharedExpenseForStats,
} from './coupleExpenses';

// ---------------------------------------------------------------------------
// validateCoupleCode
// ---------------------------------------------------------------------------
describe('validateCoupleCode', () => {
  it('accepts a valid 8-char code', () => {
    expect(validateCoupleCode('ABCD2345')).toBeNull();
  });

  it('accepts a code with lowercase (normalised internally)', () => {
    expect(validateCoupleCode('abcd2345')).toBeNull();
  });

  it('accepts a code with surrounding whitespace', () => {
    expect(validateCoupleCode('  ABCD2345  ')).toBeNull();
  });

  it('rejects an empty string', () => {
    expect(validateCoupleCode('')).not.toBeNull();
  });

  it('rejects a code that is too short', () => {
    expect(validateCoupleCode('ABCD234')).not.toBeNull();
  });

  it('rejects a code that is too long', () => {
    expect(validateCoupleCode('ABCD23456')).not.toBeNull();
  });

  it('rejects ambiguous character O (letter oh)', () => {
    expect(validateCoupleCode('OABCD234')).not.toBeNull();
  });

  it('rejects ambiguous character 0 (digit zero)', () => {
    expect(validateCoupleCode('0ABCD234')).not.toBeNull();
  });

  it('rejects ambiguous character I (letter eye)', () => {
    expect(validateCoupleCode('IABCD234')).not.toBeNull();
  });

  it('rejects ambiguous character 1 (digit one)', () => {
    expect(validateCoupleCode('1ABCD234')).not.toBeNull();
  });

  it('rejects ambiguous character L (letter ell)', () => {
    expect(validateCoupleCode('LABCD234')).not.toBeNull();
  });

  it('rejects special characters', () => {
    expect(validateCoupleCode('ABCD23!@')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// canShareExpense
// ---------------------------------------------------------------------------
describe('canShareExpense', () => {
  it('returns true when all conditions are met', () => {
    expect(
      canShareExpense({
        coupleExpensesEnabled: true,
        hasActiveConnection: true,
        transactionType: 'expense',
      })
    ).toBe(true);
  });

  it('returns false when feature is not enabled', () => {
    expect(
      canShareExpense({
        coupleExpensesEnabled: false,
        hasActiveConnection: true,
        transactionType: 'expense',
      })
    ).toBe(false);
  });

  it('returns false when there is no active connection', () => {
    expect(
      canShareExpense({
        coupleExpensesEnabled: true,
        hasActiveConnection: false,
        transactionType: 'expense',
      })
    ).toBe(false);
  });

  it('returns false for income transactions', () => {
    expect(
      canShareExpense({
        coupleExpensesEnabled: true,
        hasActiveConnection: true,
        transactionType: 'income',
      })
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// calculateSharedAmount — 50/50 split, floored to 2 decimal places
// ---------------------------------------------------------------------------
describe('calculateSharedAmount', () => {
  it('splits an even amount exactly', () => {
    expect(calculateSharedAmount(100.0)).toBe(50.0);
  });

  it('splits zero', () => {
    expect(calculateSharedAmount(0)).toBe(0);
  });

  it('floors the partner share for odd cents (1.01 → 0.50)', () => {
    expect(calculateSharedAmount(1.01)).toBe(0.5);
  });

  it('floors the partner share for 0.01 → 0.00', () => {
    expect(calculateSharedAmount(0.01)).toBe(0.0);
  });

  it('handles amounts with more than 2 decimal places gracefully', () => {
    // 10.005 → floor(10.005 * 100) / 200 = floor(1000.5) / 200 = 1000 / 200 = 5.00
    expect(calculateSharedAmount(10.005)).toBe(5.0);
  });

  it('throws for negative amounts', () => {
    expect(() => calculateSharedAmount(-1)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// Helpers for test fixtures
// ---------------------------------------------------------------------------
const se = (
  date: string,
  amount: number,
  category: string | null = 'Cibo',
  deleted: boolean = false
): SharedExpenseForStats => ({
  date,
  my_share_amount: amount,
  couple_category_name: category,
  tx_deleted_at: deleted ? '2026-01-15T10:00:00Z' : null,
});

// ---------------------------------------------------------------------------
// filterSharedExpensesForBudget
// ---------------------------------------------------------------------------
describe('filterSharedExpensesForBudget', () => {
  it('returns all non-deleted expenses when no category filter', () => {
    const input = [se('2026-01-10', 10), se('2026-01-15', 5, null, true)];
    expect(filterSharedExpensesForBudget(input)).toHaveLength(1);
  });

  it('excludes soft-deleted transactions', () => {
    const input = [se('2026-01-10', 10, 'Cibo', true)];
    expect(filterSharedExpensesForBudget(input)).toHaveLength(0);
  });

  it('filters by category name', () => {
    const input = [se('2026-01-10', 10, 'Cibo'), se('2026-01-11', 20, 'Trasporti')];
    expect(filterSharedExpensesForBudget(input, 'Cibo')).toHaveLength(1);
    expect(filterSharedExpensesForBudget(input, 'Trasporti')).toHaveLength(1);
  });

  it('returns empty for non-existent category', () => {
    const input = [se('2026-01-10', 10, 'Cibo')];
    expect(filterSharedExpensesForBudget(input, 'NonEsiste')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getMedianMonthlySpendingShared
// ---------------------------------------------------------------------------
describe('getMedianMonthlySpendingShared', () => {
  it('returns 0 for empty input', () => {
    expect(getMedianMonthlySpendingShared([])).toBe(0);
  });

  it('returns 0 when all expenses are deleted', () => {
    const input = [se('2026-01-10', 10, 'Cibo', true)];
    expect(getMedianMonthlySpendingShared(input)).toBe(0);
  });

  it('returns the single month total for one month of data', () => {
    // Jan 2026: 10 + 20 = 30 → median of [30] = 30
    const input = [se('2026-01-10', 10), se('2026-01-20', 20)];
    expect(getMedianMonthlySpendingShared(input)).toBe(30);
  });

  it('calculates the median of monthly sums (odd number of months)', () => {
    // Jan=10, Feb=20, Mar=30 → sorted [10, 20, 30] → median = 20
    const input = [
      se('2026-01-10', 10),
      se('2026-02-10', 20),
      se('2026-03-10', 30),
    ];
    expect(getMedianMonthlySpendingShared(input)).toBe(20);
  });

  it('calculates the median of monthly sums (even number of months)', () => {
    // Jan=10, Feb=20 → sorted [10, 20] → median = (10+20)/2 = 15
    const input = [se('2026-01-10', 10), se('2026-02-10', 20)];
    expect(getMedianMonthlySpendingShared(input)).toBe(15);
  });

  it('filters by couple_category_name', () => {
    const input = [
      se('2026-01-10', 100, 'Cibo'),
      se('2026-01-10', 50, 'Trasporti'),
      se('2026-02-10', 200, 'Cibo'),
    ];
    // Cibo: Jan=100, Feb=200 → median = 150
    expect(getMedianMonthlySpendingShared(input, 'Cibo')).toBe(150);
    // Trasporti: Jan=50 → median = 50
    expect(getMedianMonthlySpendingShared(input, 'Trasporti')).toBe(50);
  });

  it('excludes soft-deleted expenses', () => {
    // Jan: 10 (live) + 90 (deleted) = only 10 counts
    const input = [se('2026-01-10', 10), se('2026-01-15', 90, 'Cibo', true)];
    expect(getMedianMonthlySpendingShared(input)).toBe(10);
  });

  it('rounds median to 2 decimal places', () => {
    // Jan=10, Feb=11 → median = (10+11)/2 = 10.5 → 10.5
    const input = [se('2026-01-01', 10), se('2026-02-01', 11)];
    expect(getMedianMonthlySpendingShared(input)).toBe(10.5);
  });
});
