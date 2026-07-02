import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listTotpFactors,
  unenrollFactor,
  getAAL,
  enrollTotp,
  verifyTotpEnrollment,
  type TotpEnrollment,
} from '@/lib/mfa';

/**
 * MFA hooks (TanStack Query).
 *
 * - `useFactors`: lists the current user's enrolled TOTP factors + current AAL.
 * - `useEnrollTotp`: starts enrollment (returns factorId/uri/secret).
 * - `useVerifyEnrollment`: verifies the 6-digit code, completing enrollment.
 * - `useUnenrollFactor`: removes a factor.
 *
 * Query keys are prefixed `['mfa', ...]`; mutations invalidate `['mfa']`.
 */
const factorsKey = ['mfa', 'factors'] as const;

export interface MfaFactorRow {
  id: string;
  friendly_name?: string;
  factor_type: 'totp';
  created_at: string;
}

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
