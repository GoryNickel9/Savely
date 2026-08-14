/**
 * MFA (TOTP) — pure helpers and types only.
 *
 * The Supabase-calling wrappers live in src/hooks/useMfa.ts; this module stays
 * side-effect-free (no Supabase import) so it can be unit-tested in isolation
 * without env vars, matching the convention of other src/lib/*.ts files.
 */

import i18n from '@/i18n';

export type AuthAAL = 'aal1' | 'aal2';

export interface TotpEnrollment {
  /** Factor id to use in subsequent challenge/verify/unenroll calls. */
  factorId: string;
  /** otpauth:// URI to render as a QR code. */
  uri: string;
  /** Base32 secret to display as a manual-entry fallback. */
  secret: string;
}

export interface VerifiedFactor {
  /** The factor id that was verified. */
  factorId: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Pure helpers (unit-tested, no Supabase calls)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Validate a TOTP code: exactly 6 digits. Returns an error message or null.
 * Accepts spaces/dashes (stripped before counting).
 */
export function validateTotpCode(input: string): string | null {
  if (typeof input !== 'string') return i18n.t('Codice non valido');
  const cleaned = input.replace(/[\s-]/g, '');
  if (!/^\d{6}$/.test(cleaned)) return i18n.t('Il codice deve essere di 6 cifre');
  return null;
}

/**
 * Extract the TOTP secret from an otpauth:// URI, if present.
 * Returns null if the URI is malformed or has no secret.
 */
export function extractSecretFromUri(uri: string): string | null {
  if (typeof uri !== 'string') return null;
  const match = uri.match(/[?&]secret=([^&]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/**
 * Extract the human-readable label from an otpauth:// URI
 * (the path segment after `otpauth://totp/`).
 */
export function extractLabelFromUri(uri: string): string | null {
  if (typeof uri !== 'string') return null;
  const match = uri.match(/^otpauth:\/\/totp\/([^?]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}
