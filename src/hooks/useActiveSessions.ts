import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface ActiveSessionRow {
  id: string;
  created_at: string;
  user_agent: string | null;
  ip: string | null;
}

/**
 * Lists active sessions (devices) for the current user by calling the
 * SECURITY DEFINER function get_active_sessions() which reads from
 * login_activity and deduplicates by user_agent (keeps the latest sign_in
 * per device, excludes devices whose latest event is a sign_out).
 */
export function useActiveSessions() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return {
    ...useQuery({
      queryKey: ['active-sessions', user?.id] as const,
      queryFn: async () => {
        const { data, error } = await supabase.rpc('get_active_sessions');
        if (error) throw error;
        return (data ?? []) as ActiveSessionRow[];
      },
      enabled: !!user,
    }),
    invalidate: () => qc.invalidateQueries({ queryKey: ['active-sessions'] }),
  };
}
