import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TcgCard, TcgGame, CardCondition } from '@/lib/types';
import { useAuth } from './useAuth';

export function useTcgCards(game?: TcgGame) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ['tcg-cards', user?.id, game],
    queryFn: async () => {
      let query = (supabase as any)
        .from('tgc_cards')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (game) {
        query = query.eq('category', game);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as TcgCard[];
    },
    enabled: !!user,
  });

  const createCard = useMutation({
    mutationFn: async (card: {
      name: string;
      category: TcgGame;
      card_id?: string;
      set_code?: string;
      collector_number?: string;
      condition: CardCondition;
      language: string;
      quantity: number;
      purchase_price: number;
      purchase_date: string;
      current_price?: number;
      image_url?: string;
      notes?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await (supabase as any).from('tgc_cards').insert({
        ...card,
        user_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tcg-cards'] });
    },
  });

  const updateCard = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TcgCard> & { id: string }) => {
      const { error } = await (supabase as any)
        .from('tgc_cards')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tcg-cards'] });
    },
  });

  const deleteCard = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('tgc_cards')
        .delete()
        .eq('id', id)
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tcg-cards'] });
    },
  });

  // Aggregated stats
  const totalValue = cards.reduce((sum, c) => sum + (c.current_price ?? c.purchase_price) * c.quantity, 0);
  const totalCost = cards.reduce((sum, c) => sum + c.purchase_price * c.quantity, 0);
  const totalGain = totalValue - totalCost;
  const totalGainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;
  const totalPieces = cards.reduce((sum, c) => sum + c.quantity, 0);

  return {
    cards,
    isLoading,
    createCard,
    updateCard,
    deleteCard,
    totalValue,
    totalCost,
    totalGain,
    totalGainPercent,
    totalPieces,
  };
}
