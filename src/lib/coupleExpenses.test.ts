import { describe, expect, it } from 'vitest';
import { validateCoupleCode, canShareExpense, calculateSharedAmount } from './coupleExpenses';

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
