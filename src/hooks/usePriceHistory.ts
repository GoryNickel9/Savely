import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface PriceHistoryPoint {
  asset_id: string;
  price: number;
  recorded_at: string;
}

export function usePriceHistory() {
  const { user } = useAuth();

  const { data: priceHistory = [], isLoading } = useQuery({
    queryKey: ['price-history', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('asset_price_history')
        .select('asset_id, price, recorded_at')
        .order('recorded_at', { ascending: true });

      if (error) throw error;
      return data as PriceHistoryPoint[];
    },
    enabled: !!user,
  });

  // Group history by asset_id
  const historyByAsset = priceHistory.reduce((acc, point) => {
    if (!acc[point.asset_id]) {
      acc[point.asset_id] = [];
    }
    acc[point.asset_id].push(point);
    return acc;
  }, {} as Record<string, PriceHistoryPoint[]>);

  return {
    priceHistory,
    historyByAsset,
    isLoading,
  };
}
