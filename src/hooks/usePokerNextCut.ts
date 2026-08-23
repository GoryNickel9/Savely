import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface PokerNextCut {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  deal: number;
  profit_loss: number;
  created_at: string;
  updated_at: string;
}

export function usePokerNextCut() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: nextCut, isLoading } = useQuery({
    queryKey: ['poker-next-cut', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('poker_next_cut')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: true })
        .limit(1);

      if (error) throw error;
      
      // Se non esiste un record, creane uno di default
      if (!data || data.length === 0) {
        const { data: newRecord, error: insertError } = await supabase
          .from('poker_next_cut')
          .insert({
            user_id: user!.id,
            name: 'Next Cut',
            amount: 0,
            deal: 0.55,
            profit_loss: 1804.87
          })
          .select()
          .single();

        if (insertError) throw insertError;
        return newRecord as PokerNextCut;
      }
      
      return data[0] as PokerNextCut;
    },
    enabled: !!user,
  });

  const updateDeal = useMutation({
    mutationFn: async (deal: number) => {
      if (!nextCut) throw new Error('No next cut record found');

      const { data, error } = await supabase
        .from('poker_next_cut')
        .update({ deal })
        .eq('id', nextCut.id)
        .select()
        .single();

      if (error) throw error;
      return data as PokerNextCut;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['poker-next-cut'] });
    },
  });

  const updateProfitLoss = useMutation({
    mutationFn: async (profitLoss: number) => {
      if (!nextCut) throw new Error('No next cut record found');

      const { data, error } = await supabase
        .from('poker_next_cut')
        .update({ profit_loss: profitLoss })
        .eq('id', nextCut.id)
        .select()
        .single();

      if (error) throw error;
      return data as PokerNextCut;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['poker-next-cut'] });
    },
  });

  const updateAmount = useMutation({
    mutationFn: async (amount: number) => {
      if (!nextCut) throw new Error('No next cut record found');

      const { data, error } = await supabase
        .from('poker_next_cut')
        .update({ amount })
        .eq('id', nextCut.id)
        .select()
        .single();

      if (error) throw error;
      return data as PokerNextCut;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['poker-next-cut'] });
    },
  });

  return {
    nextCut,
    loading: isLoading,
    updateDeal: updateDeal.mutateAsync,
    updateProfitLoss: updateProfitLoss.mutateAsync,
    updateAmount: updateAmount.mutateAsync
  };
}
