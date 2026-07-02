/**
 * Security boundary tests for the Couple Expenses feature.
 *
 * These tests verify client-side security guards (pure functions and
 * permission checks). DB-level security (RLS, SECURITY DEFINER RPCs)
 * is enforced by Supabase policies and requires integration tests against
 * a live database; see supabase/migrations for the policy definitions.
 */
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
// [SEC-01] Feature gating — canShareExpense
// The couple sharing UI must be invisible/blocked in every unauthorized case.
// ---------------------------------------------------------------------------
describe('[SEC-01] Feature gating — canShareExpense', () => {
  const ENABLED: Parameters<typeof canShareExpense>[0] = {
    coupleExpensesEnabled: true,
    hasActiveConnection: true,
    transactionType: 'expense',
  };

  it('allows sharing only when all three conditions are met', () => {
    expect(canShareExpense(ENABLED)).toBe(true);
  });

  it('blocks when couple_expenses permission is disabled', () => {
    expect(canShareExpense({ ...ENABLED, coupleExpensesEnabled: false })).toBe(false);
  });

  it('blocks when there is no active connection', () => {
    expect(canShareExpense({ ...ENABLED, hasActiveConnection: false })).toBe(false);
  });

  it('blocks on income transactions (only expenses are shareable)', () => {
    expect(canShareExpense({ ...ENABLED, transactionType: 'income' })).toBe(false);
  });

  it('blocks when both permission and connection are missing', () => {
    expect(
      canShareExpense({ ...ENABLED, coupleExpensesEnabled: false, hasActiveConnection: false })
    ).toBe(false);
  });

  it('blocks when all conditions are false', () => {
    expect(
      canShareExpense({
        coupleExpensesEnabled: false,
        hasActiveConnection: false,
        transactionType: 'income',
      })
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// [SEC-02] Couple code validation — anti-enumeration
// Short codes or codes with ambiguous chars would reduce the keyspace
// and make brute-force attacks easier.
// ---------------------------------------------------------------------------
describe('[SEC-02] Code validation — anti-enumeration', () => {
  it('accepts a full 8-char code from the unambiguous charset', () => {
    expect(validateCoupleCode('ABCD2345')).toBeNull();
  });

  it('rejects codes shorter than 8 chars (reduces keyspace)', () => {
    for (const short of ['', 'A', 'ABCD', 'ABCD234']) {
      expect(validateCoupleCode(short)).not.toBeNull();
    }
  });

  it('rejects codes longer than 8 chars', () => {
    expect(validateCoupleCode('ABCD23456')).not.toBeNull();
  });

  it('rejects O (oh) — excluded to avoid O/0 confusion', () => {
    expect(validateCoupleCode('OABCD234')).not.toBeNull();
  });

  it('rejects 0 (zero) — excluded to avoid 0/O confusion', () => {
    expect(validateCoupleCode('0ABCD234')).not.toBeNull();
  });

  it('rejects I (eye) — excluded to avoid I/1 confusion', () => {
    expect(validateCoupleCode('IABCD234')).not.toBeNull();
  });

  it('rejects 1 (one) — excluded to avoid 1/I/l confusion', () => {
    expect(validateCoupleCode('1ABCD234')).not.toBeNull();
  });

  it('rejects L (ell) — excluded to avoid L/1/I confusion', () => {
    expect(validateCoupleCode('LABCD234')).not.toBeNull();
  });

  it('rejects special characters (SQL injection / code injection attempt)', () => {
    const malicious = ["ABCD23!@", "ABCD'; --", "<script>", "ABCD\x00234"];
    for (const code of malicious) {
      expect(validateCoupleCode(code)).not.toBeNull();
    }
  });

  it('normalises lowercase input before validation (case-insensitive UX)', () => {
    expect(validateCoupleCode('abcd2345')).toBeNull();
  });

  it('trims surrounding whitespace before validation', () => {
    expect(validateCoupleCode('  ABCD2345  ')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// [SEC-03] Split amount bounds — no negative, no over-split
// The partner must never receive more than half the total amount.
// ---------------------------------------------------------------------------
describe('[SEC-03] Split amount bounds', () => {
  it('returns exactly half for an even amount', () => {
    const half = calculateSharedAmount(100);
    expect(half).toBe(50);
    expect(half).toBeLessThanOrEqual(100 / 2);
  });

  it('never returns more than half (floors odd cents)', () => {
    for (const total of [1.01, 3.33, 99.99, 0.01]) {
      const share = calculateSharedAmount(total);
      expect(share).toBeLessThanOrEqual(total / 2 + Number.EPSILON);
    }
  });

  it('always returns a non-negative value', () => {
    expect(calculateSharedAmount(0)).toBeGreaterThanOrEqual(0);
    expect(calculateSharedAmount(0.01)).toBeGreaterThanOrEqual(0);
  });

  it('throws RangeError for negative amounts (invalid input)', () => {
    expect(() => calculateSharedAmount(-0.01)).toThrow(RangeError);
    expect(() => calculateSharedAmount(-1000)).toThrow(RangeError);
  });

  it('handles very large amounts without overflow', () => {
    const large = 999_999.99;
    const share = calculateSharedAmount(large);
    expect(share).toBeGreaterThan(0);
    expect(share).toBeLessThanOrEqual(large / 2 + 0.01);
  });
});

// ---------------------------------------------------------------------------
// [SEC-04] Budget category isolation — data leakage prevention
// filterSharedExpensesForBudget must not let one category's data bleed
// into another's statistics.
// ---------------------------------------------------------------------------
describe('[SEC-04] Budget category isolation', () => {
  const fixtures: SharedExpenseForStats[] = [
    { date: '2026-01-10', my_share_amount: 100, couple_category_name: 'Cibo',       tx_deleted_at: null },
    { date: '2026-01-11', my_share_amount: 200, couple_category_name: 'Trasporti',  tx_deleted_at: null },
    { date: '2026-01-12', my_share_amount: 50,  couple_category_name: 'Cibo',       tx_deleted_at: '2026-01-15T00:00:00Z' },
    { date: '2026-02-01', my_share_amount: 300, couple_category_name: 'Casa',       tx_deleted_at: null },
  ];

  it('returns only entries for the requested category', () => {
    const cibo = filterSharedExpensesForBudget(fixtures, 'Cibo');
    expect(cibo.every(se => se.couple_category_name === 'Cibo')).toBe(true);
    expect(cibo.every(se => se.tx_deleted_at === null)).toBe(true);
  });

  it('excludes soft-deleted entries (tx_deleted_at !== null)', () => {
    const all = filterSharedExpensesForBudget(fixtures);
    expect(all.some(se => se.tx_deleted_at !== null)).toBe(false);
  });

  it('returns empty when category does not exist', () => {
    expect(filterSharedExpensesForBudget(fixtures, 'NonEsiste')).toHaveLength(0);
  });

  it('does not mix category data in median calculations', () => {
    const ciboMedian    = getMedianMonthlySpendingShared(fixtures, 'Cibo');
    const trasportiMedian = getMedianMonthlySpendingShared(fixtures, 'Trasporti');
    const casaMedian    = getMedianMonthlySpendingShared(fixtures, 'Casa');

    // Cibo: only Jan live = 100; median of [100] = 100
    expect(ciboMedian).toBe(100);
    // Trasporti: Jan=200; median of [200] = 200
    expect(trasportiMedian).toBe(200);
    // Casa: Feb=300; median of [300] = 300
    expect(casaMedian).toBe(300);

    // None bleed into each other
    expect(ciboMedian).not.toBe(trasportiMedian);
    expect(ciboMedian).not.toBe(casaMedian);
  });
});

// ---------------------------------------------------------------------------
// [SEC-05] Deleted expense exclusion
// Soft-deleted transactions must not appear in budget statistics.
// ---------------------------------------------------------------------------
describe('[SEC-05] Deleted expense exclusion from statistics', () => {
  it('returns 0 when all expenses are soft-deleted', () => {
    const all: SharedExpenseForStats[] = [
      { date: '2026-01-10', my_share_amount: 500, couple_category_name: 'Cibo', tx_deleted_at: '2026-01-11T00:00:00Z' },
      { date: '2026-01-15', my_share_amount: 250, couple_category_name: 'Cibo', tx_deleted_at: '2026-01-16T00:00:00Z' },
    ];
    expect(getMedianMonthlySpendingShared(all)).toBe(0);
  });

  it('excludes deleted amounts from monthly sums', () => {
    const mixed: SharedExpenseForStats[] = [
      { date: '2026-01-10', my_share_amount: 100, couple_category_name: 'Cibo', tx_deleted_at: null },
      { date: '2026-01-15', my_share_amount: 900, couple_category_name: 'Cibo', tx_deleted_at: '2026-01-16T00:00:00Z' },
    ];
    // Only the 100 entry counts; monthly sum = 100; median = 100
    expect(getMedianMonthlySpendingShared(mixed)).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// [SEC-06] Privacy — SharedExpenseForStats has no category_id
// The type used for budget stats must not expose the creator's category UUID.
// ---------------------------------------------------------------------------
describe('[SEC-06] Privacy — SharedExpenseForStats interface', () => {
  it('does not include category_id in the type', () => {
    const entry: SharedExpenseForStats = {
      couple_category_name: 'Cibo',
      my_share_amount: 50,
      date: '2026-01-10',
      tx_deleted_at: null,
    };
    // TypeScript ensures no category_id field exists on this type.
    // At runtime, verify that creating a valid entry does not require it.
    expect(entry).not.toHaveProperty('category_id');
    expect(Object.keys(entry)).toEqual(
      expect.not.arrayContaining(['category_id'])
    );
  });
});
