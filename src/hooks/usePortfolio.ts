import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PortfolioAsset, AssetType, CurrencyCode } from '@/lib/types';
import { useAuth } from './useAuth';
import { useState } from 'react';

export function usePortfolio() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['portfolio', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portfolio_assets')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as PortfolioAsset[];
    },
    enabled: !!user,
  });

  const createAsset = useMutation({
    mutationFn: async (asset: {
      name: string;
      symbol?: string;
      type: AssetType;
      quantity: number;
      purchase_price: number;
      current_price?: number;
      currency?: CurrencyCode;
      purchase_date?: string;
      notes?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');

      const normalizedSymbol = asset.symbol?.trim().toUpperCase();

      // Always create a new row for each purchase
      const { error } = await supabase.from('portfolio_assets').insert({
        ...asset,
        symbol: normalizedSymbol || null,
        user_id: user.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
    },
  });

  const updateAsset = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PortfolioAsset> & { id: string }) => {
      const { error } = await supabase
        .from('portfolio_assets')
        .update(updates)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
    },
  });

  const deleteAsset = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('portfolio_assets')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
    },
  });

  const updatePrices = async () => {
    if (!user) return { updated: 0 };
    
    setIsUpdatingPrices(true);
    try {
      const { data, error } = await supabase.functions.invoke('update-prices', {
        body: { user_id: user.id },
      });
      
      if (error) throw error;
      
      // Refresh the portfolio data
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      
      return data;
    } finally {
      setIsUpdatingPrices(false);
    }
  };

  // Filter open vs closed positions
  // Treat a position as "closed" only when we have BOTH a sold date and a sold price.
  // (Some imports may include a sale date without a sale price; those should remain open.)
  const closedAssets = assets.filter(a => !!a.sold_at && a.sold_price !== null);
  const openAssets = assets.filter(a => !a.sold_at || a.sold_price === null);

  // Calculate totals for OPEN positions only
  const totalValue = openAssets.reduce((sum, asset) => {
    const price = asset.current_price ?? asset.purchase_price;
    return sum + (price * asset.quantity);
  }, 0);

  const totalCost = openAssets.reduce((sum, asset) => {
    return sum + (asset.purchase_price * asset.quantity);
  }, 0);

  const totalGain = totalValue - totalCost;
  const totalGainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

  // Calculate realized P/L from closed positions
  const realizedGain = closedAssets.reduce((sum, asset) => {
    const soldValue = (asset.sold_price ?? asset.purchase_price) * asset.quantity;
    const costBasis = asset.purchase_price * asset.quantity;
    return sum + (soldValue - costBasis);
  }, 0);

  return {
    assets,
    openAssets,
    closedAssets,
    isLoading,
    createAsset,
    updateAsset,
    deleteAsset,
    updatePrices,
    isUpdatingPrices,
    totalValue,
    totalCost,
    totalGain,
    totalGainPercent,
    realizedGain,
  };
}
