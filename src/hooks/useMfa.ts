import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  validateTotpCode,
  type TotpEnrollment,
  type VerifiedFactor,
  type AuthAAL,
} from '@/lib/mfa';

/**
 * MFA (TOTP) Supabase wrappers + TanStack Query hooks.
 *
 * Pure validation/parsing helpers live in src/lib/mfa.ts; this module owns the
 * Supabase auth.mfa.* calls and the query/mutation cache.
 */

export interface MfaFactorRow {
  id: string;
  friendly_name?: string;
  factor_type: 'totp';
  created_at: string;
}

/** Start TOTP enrollment. Returns the QR URI + secret to show the user. */
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
 * Returns the current Authenticator Assurance Level ('aal1' = password only,
 * 'aal2' = password + second factor verified) and the next reachable level.
 */
export async function getAAL(): Promise<{ current: AuthAAL; next: AuthAAL }> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw error;
  return {
    current: (data.currentLevel ?? 'aal1') as AuthAAL,
    next: (data.nextLevel ?? 'aal1') as AuthAAL,
  };
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

const factorsKey = ['mfa', 'factors'] as const;

export function useFactors() {
  return useQuery({
    queryKey: factorsKey,
    queryFn: async () => {
      const [factors, aal] = await Promise.all([listTotpFactors(), getAAL()]);
      return {
        factors: factors as MfaFactorRow[],
        aalCurrent: aal.current,
        aalNext: aal.next,
      };
    },
  });
}

export function useEnrollTotp() {
  return useMutation<TotpEnrollment, Error, void>({
    mutationFn: () => enrollTotp(),
  });
}

export function useVerifyEnrollment() {
  const qc = useQueryClient();
  return useMutation<void, Error, { factorId: string; code: string }>({
    mutationFn: async ({ factorId, code }) => {
      await verifyTotpEnrollment(factorId, code);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mfa'] }),
  });
}

export function useUnenrollFactor() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (factorId) => unenrollFactor(factorId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mfa'] }),
  });
}
