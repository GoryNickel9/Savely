import { supabase } from '@/integrations/supabase/client';

/**
 * MFA (TOTP) helpers — thin typed wrappers around Supabase Auth MFA.
 *
 * The actual factor storage lives in Supabase's `auth.mfa_factors` /
 * `auth.mfa_challenges` tables; nothing app-side is persisted. This module
 * only exposes enrollment/verification/unenrollment and pure validation logic.
 *
 * Pure helpers (testable in isolation) are exported at the bottom.
 */

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

/**
 * Start TOTP enrollment. Returns the QR URI + secret to show the user.
 * The caller must then prompt for a 6-digit code and call verifyTotpEnrollment.
 */
export async function enrollTotp(): Promise<TotpEnrollment> {
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
  if (error) throw error;
  const totp = data.totp;
  return {
    factorId: data.id,
    uri: totp.uri,
    secret: totp.secret,
  };
}

/**
 * Create a challenge for the given factor and verify it with the user's code.
 * On success the factor becomes active (AAL raises to aal2).
 */
export async function verifyTotpEnrollment(factorId: string, code: string): Promise<VerifiedFactor> {
  const codeErr = validateTotpCode(code);
  if (codeErr) throw new Error(codeErr);

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeError) throw challengeError;

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: code.trim(),
  });
  if (verifyError) throw verifyError;

  return { factorId };
}

/** List the current user's enrolled TOTP factors (verified only, typically). */
export async function listTotpFactors() {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return data.totp ?? [];
}

/** Remove a factor by id. */
export async function unenrollFactor(factorId: string): Promise<void> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;
}

/**
 * Challenge + verify flow used at login when the user has an active TOTP factor.
 * Returns true on success.
 */
export async function challengeAndVerify(factorId: string, code: string): Promise<boolean> {
  const codeErr = validateTotpCode(code);
  if (codeErr) throw new Error(codeErr);

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeError) throw challengeError;

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: code.trim(),
  });
  if (verifyError) throw verifyError;
  return true;
}

/**
 * Returns the current Authenticator Assurance Level:
 *   'aal1' = password only
 *   'aal2' = password + second factor verified
 * plus the next level the user *can* reach given their enrolled factors.
 */
export async function getAAL(): Promise<{ current: AuthAAL; next: AuthAAL }> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw error;
  return {
    current: (data.currentLevel ?? 'aal1') as AuthAAL,
    next: (data.nextLevel ?? 'aal1') as AuthAAL,
  };
}

export type AuthAAL = 'aal1' | 'aal2';

// ────────────────────────────────────────────────────────────────────────────
// Pure helpers (unit-tested, no Supabase calls)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Validate a TOTP code: exactly 6 digits. Returns an error message or null.
 * Accepts spaces/dashes (stripped before counting).
 */
export function validateTotpCode(input: string): string | null {
  if (typeof input !== 'string') return 'Codice non valido';
  const cleaned = input.replace(/[\s-]/g, '');
  if (!/^\d{6}$/.test(cleaned)) return 'Il codice deve essere di 6 cifre';
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
