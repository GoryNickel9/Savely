import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface LoginActivityRow {
  id: string;
  event_type: 'sign_in' | 'sign_out' | 'sign_up' | 'recovery' | 'mfa_challenge';
  user_agent: string | null;
  ip: string | null;
  created_at: string;
}

/**
 * Records login/sign-out/etc. events into `login_activity`.
 * Fire-and-forget: failures are swallowed (audit is best-effort from the client).
 */
export function useRecordLoginActivity() {
  const { user } = useAuth();
  return async (eventType: LoginActivityRow['event_type']) => {
    if (!user) return;
    try {
      await supabase.from('login_activity').insert({
        user_id: user.id,
        event_type: eventType,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      });
    } catch {
      // best-effort: ignore
    }
  };
}

/**
 * Lists the last 50 login activity events for the current user.
 */
export function useLoginActivity() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return {
    ...useQuery({
      queryKey: ['login-activity', user?.id] as const,
      queryFn: async () => {
        const { data, error } = await supabase
          .from('login_activity')
          .select('id, event_type, user_agent, ip, created_at')
          .order('created_at', { ascending: false })
          .limit(50);
        if (error) throw error;
        return (data ?? []) as LoginActivityRow[];
      },
      enabled: !!user,
    }),
    invalidate: () => qc.invalidateQueries({ queryKey: ['login-activity'] }),
  };
}
