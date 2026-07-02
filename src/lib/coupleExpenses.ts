/**
 * Pure utility functions for the Couple Expenses feature.
 * No Supabase calls here — these functions are safe to unit-test in isolation.
 */

// Charset used by the DB for couple codes (same as generate_couple_code() in SQL).
// 32 chars: uppercase letters without O, I, L; digits without 0, 1.
const COUPLE_CODE_CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const COUPLE_CODE_LENGTH = 8;

/**
 * Validates a couple code entered by the user.
 * Returns an error message string, or null if valid.
 */
export function validateCoupleCode(code: string): string | null {
  const trimmed = code.trim().toUpperCase();

  if (trimmed.length === 0) {
    return 'Il codice non può essere vuoto.';
  }

  if (trimmed.length !== COUPLE_CODE_LENGTH) {
    return `Il codice deve essere di ${COUPLE_CODE_LENGTH} caratteri (attuale: ${trimmed.length}).`;
  }

  for (const ch of trimmed) {
    if (!COUPLE_CODE_CHARSET.includes(ch)) {
      return `Il codice contiene caratteri non validi: "${ch}".`;
    }
  }

  return null;
}

/**
 * Returns true if an expense can be shared with a partner.
 * Conditions:
 *  - feature must be enabled for the user
 *  - must have an active connection
 *  - transaction type must be 'expense' (not 'income')
 */
export function canShareExpense(params: {
  coupleExpensesEnabled: boolean;
  hasActiveConnection: boolean;
  transactionType: 'income' | 'expense';
}): boolean {
  return (
    params.coupleExpensesEnabled &&
    params.hasActiveConnection &&
    params.transactionType === 'expense'
  );
}

/**
 * Calculates each partner's share of a shared expense (50/50 split).
 * Returns a value rounded to 2 decimal places.
 * The remaining cent (for odd amounts) stays with the original creator.
 *
 * Uses integer-cent arithmetic to avoid floating-point rounding errors.
 *
 * Examples:
 *   100.00 → 50.00
 *   1.01   → 0.50 (partner gets floor; creator keeps 0.51)
 *   0.01   → 0.00 (partner's share rounds down to 0)
 */
export function calculateSharedAmount(totalAmount: number): number {
  if (totalAmount < 0) {
    throw new RangeError('totalAmount must be non-negative');
  }
  // Convert to integer cents first to avoid floating-point issues, then floor-divide by 2
  const totalCents = Math.round(totalAmount * 100);
  const partnerCents = Math.floor(totalCents / 2);
  return partnerCents / 100;
}

// ---------------------------------------------------------------------------
// Budget statistics for couple shared expenses
// ---------------------------------------------------------------------------

/** Minimal shape needed for budget statistics (matches SharedExpenseViewRow). */
export interface SharedExpenseForStats {
  couple_category_name: string | null;
  my_share_amount: number;
  date: string; // YYYY-MM-DD
  tx_deleted_at: string | null;
}

/**
 * Filters shared expenses for budget calculations:
 * - Excludes rows where the original transaction was soft-deleted.
 * - Optionally restricts to a specific couple_category_name.
 */
export function filterSharedExpensesForBudget(
  expenses: SharedExpenseForStats[],
  categoryName?: string
): SharedExpenseForStats[] {
  return expenses.filter(se => {
    if (se.tx_deleted_at !== null) return false;
    if (categoryName !== undefined && se.couple_category_name !== categoryName) return false;
    return true;
  });
}

/**
 * Calculates the median of the monthly summed share amounts from shared expenses.
 *
 * Algorithm:
 *  1. Filter via filterSharedExpensesForBudget (removes deleted; optional category).
 *  2. Group remaining entries by (YYYY-MM), summing my_share_amount per group.
 *  3. Return the median of those monthly sums.
 *
 * Returns 0 when there are no qualifying entries.
 */
export function getMedianMonthlySpendingShared(
  expenses: SharedExpenseForStats[],
  categoryName?: string
): number {
  const filtered = filterSharedExpensesForBudget(expenses, categoryName);
  if (filtered.length === 0) return 0;

  // Group by YYYY-MM
  const monthly = new Map<string, number>();
  for (const se of filtered) {
    const key = se.date.slice(0, 7); // "YYYY-MM"
    monthly.set(key, (monthly.get(key) ?? 0) + se.my_share_amount);
  }

  const totals = Array.from(monthly.values()).sort((a, b) => a - b);
  const mid = Math.floor(totals.length / 2);
  const median =
    totals.length % 2 === 0
      ? (totals[mid - 1] + totals[mid]) / 2
      : totals[mid];

  return Math.round(median * 100) / 100;
}
