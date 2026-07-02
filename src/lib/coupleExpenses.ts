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
