import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useMemo } from 'react';

interface ManualPriceUpdate {
  id: string;
  user_id: string;
  updated_at: string;
  assets_updated: number;
  assets_checked: number;
  created_at: string;
}

export function useManualPriceUpdate() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Check if user can manually update prices (24h cooldown)
  const { data: lastManualUpdate, isLoading: checkingCooldown } = useQuery({
    queryKey: ['manual-price-update', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('manual_price_updates' as any)
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        // If table doesn't exist, return null (user can update)
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return data as unknown as ManualPriceUpdate | null;
    },
    enabled: !!user,
  });

  // Calculate if user can update (24h cooldown)
  const canUpdate = useMemo(() => {
    if (!lastManualUpdate) return true;

    const lastUpdate = new Date(lastManualUpdate.updated_at);
    const now = new Date();
    const hoursSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);

    return hoursSinceUpdate >= 24;
  }, [lastManualUpdate]);

  // Calculate time until next update is available
  const timeUntilNextUpdate = useMemo(() => {
    if (!lastManualUpdate || canUpdate) return null;

    const lastUpdate = new Date(lastManualUpdate.updated_at);
    const nextUpdate = new Date(lastUpdate.getTime() + 24 * 60 * 60 * 1000);
    const now = new Date();
    const diff = nextUpdate.getTime() - now.getTime();

    if (diff <= 0) return null;

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return { hours, minutes };
  }, [lastManualUpdate, canUpdate]);

  const updatePrices = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      if (!canUpdate) throw new Error('Cooldown period not expired');

      const { data, error } = await supabase.functions.invoke('update-prices', {
        body: { user_id: user.id },
      });

      if (error) throw error;

      // Log the manual update
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await supabase.from('manual_price_updates' as any).insert({
        user_id: user.id,
        assets_updated: data?.updated || 0,
        assets_checked: data?.checked || 0,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manual-price-update'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      queryClient.invalidateQueries({ queryKey: ['price-history'] });
      queryClient.invalidateQueries({ queryKey: ['lastPriceUpdate'] });
    },
  });

  return {
    canUpdate,
    isCheckingCooldown: checkingCooldown,
    isUpdating: updatePrices.isPending,
    updatePrices: updatePrices.mutateAsync,
    lastManualUpdate,
    timeUntilNextUpdate,
  };
}
