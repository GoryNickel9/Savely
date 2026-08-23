import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface PokerManualExpense {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  created_at: string;
  updated_at: string;
}

export function usePokerManualExpenses() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['poker-manual-expenses', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('poker_manual_expenses')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as PokerManualExpense[];
    },
    enabled: !!user,
  });

  const addExpense = useMutation({
    mutationFn: async ({ name, amount }: { name: string; amount: number }) => {
      const { data, error } = await supabase
        .from('poker_manual_expenses')
        .insert({
          user_id: user!.id,
          name,
          amount
        })
        .select()
        .single();

      if (error) throw error;
      return data as PokerManualExpense;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['poker-manual-expenses'] });
    },
  });

  const updateExpense = useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      const { data, error } = await supabase
        .from('poker_manual_expenses')
        .update({ amount })
        .eq('id', id)
        .eq('user_id', user!.id)
        .select()
        .single();

      if (error) throw error;
      return data as PokerManualExpense;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['poker-manual-expenses'] });
    },
  });

  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('poker_manual_expenses')
        .delete()
        .eq('id', id)
        .eq('user_id', user!.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['poker-manual-expenses'] });
    },
  });

  return { expenses, loading: isLoading, addExpense, updateExpense, deleteExpense };
}
