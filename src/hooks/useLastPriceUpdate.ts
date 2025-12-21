import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface PriceUpdateLog {
  id: string;
  updated_at: string;
  assets_updated: number;
  assets_checked: number;
}

export function useLastPriceUpdate() {
  const { data: lastUpdate, isLoading } = useQuery({
    queryKey: ['lastPriceUpdate'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('price_update_logs')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
      return data as PriceUpdateLog | null;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return { lastUpdate, isLoading };
}
