import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Budget } from '@/lib/types';
import { useAuth } from './useAuth';

export function useBudgets() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: budgets = [], isLoading } = useQuery({
    queryKey: ['budgets', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budgets')
        .select('*, category:categories(*)');
      
      if (error) throw error;
      return data as Budget[];
    },
    enabled: !!user,
  });

  const createBudget = useMutation({
    mutationFn: async (budget: {
      category_id: string;
      amount: number;
    }) => {
      // Use fixed month/year since budgets are now based on median, not specific month
      const { data, error } = await supabase
        .from('budgets')
        .insert({
          ...budget,
          user_id: user!.id,
          month: 1,
          year: 2000,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
    },
  });

  const updateBudget = useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      const { error } = await supabase
        .from('budgets')
        .update({ amount })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
    },
  });

  const deleteBudget = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('budgets')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
    },
  });

  return {
    budgets,
    isLoading,
    createBudget,
    updateBudget,
    deleteBudget,
  };
}
