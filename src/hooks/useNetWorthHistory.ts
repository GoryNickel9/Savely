import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface NetWorthSnapshot {
  id: string;
  date: string;
  net_worth: number;
  components: {
    cashflow: number;
    portfolioPL: number;
    realEstateDiscounted: number;
  } | null;
  created_at: string;
}

/**
 * Loads the daily net-worth history for the current user.
 * Source: net_worth_snapshots (populated by the pg_cron job + backfill).
 */
export function useNetWorthHistory() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['net-worth-history', user?.id] as const,
    queryFn: async (): Promise<NetWorthSnapshot[]> => {
       
      const { data, error } = await supabase
        .from('net_worth_snapshots')
        .select('id, date, net_worth, components, created_at')
        .eq('user_id', user!.id)
        .order('date', { ascending: true });
      if (error) throw error;
      return (data ?? []) as NetWorthSnapshot[];
    },
    enabled: !!user,
  });
}
