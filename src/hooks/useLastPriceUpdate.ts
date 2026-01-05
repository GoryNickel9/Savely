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
      try {
        const { data, error } = await supabase
          .from('price_update_logs')
          .select('*')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle(); // Use maybeSingle to handle no rows gracefully
        
        if (error) throw error;
        return data as PriceUpdateLog | null;
      } catch (error: any) {
        // If table doesn't exist (404), return null instead of throwing
        if (error?.code === 'PGRST116' || error?.status === 404) {
          return null;
        }
        throw error;
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1, // Only retry once to avoid repeated 404 errors
  });

  return { lastUpdate, isLoading };
}
