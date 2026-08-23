import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { SharedExpenseViewRow } from './useSharedExpenses';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface CoupleBudget {
  id: string;
  connection_id: string;
  couple_category_name: string;
  amount: number;
  currency: string;
  month: number;
  year: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useCoupleBudgets(
  connectionId: string | null,
  sharedExpenses: SharedExpenseViewRow[]
) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // ------------------------------------------------------------------
  // Budget rows
  // ------------------------------------------------------------------
  const { data: budgets = [], isLoading } = useQuery({
    queryKey: ['couple_budgets', connectionId],
    queryFn: async (): Promise<CoupleBudget[]> => {
       
      const { data, error } = await supabase
        .from('couple_budgets')
        .select('*')
        .eq('connection_id', connectionId!);
      if (error) throw error;
      return (data ?? []) as CoupleBudget[];
    },
    enabled: !!connectionId && !!user,
  });

  // ------------------------------------------------------------------
  // Available categories: distinct couple_category_name from shared expenses
  // (only non-deleted shared expenses)
  // ------------------------------------------------------------------
  const availableCategories = useMemo(() => {
    const names = sharedExpenses
      .filter(se => se.couple_category_name !== null && se.tx_deleted_at === null)
      .map(se => se.couple_category_name as string);
    return [...new Set(names)].sort();
  }, [sharedExpenses]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['couple_budgets'] });

  // ------------------------------------------------------------------
  // Create
  // ------------------------------------------------------------------
  const createBudget = useMutation({
    mutationFn: async (params: { couple_category_name: string; amount: number }) => {
       
      const { error } = await supabase.from('couple_budgets').insert({
        connection_id:        connectionId!,
        couple_category_name: params.couple_category_name,
        amount:               params.amount,
        month:                1,
        year:                 2000,
        created_by:           user!.id,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // ------------------------------------------------------------------
  // Update
  // ------------------------------------------------------------------
  const updateBudget = useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
       
      const { error } = await supabase
        .from('couple_budgets')
        .update({ amount })
        .eq('id', id)
        .eq('connection_id', connectionId!);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // ------------------------------------------------------------------
  // Delete
  // ------------------------------------------------------------------
  const deleteBudget = useMutation({
    mutationFn: async (id: string) => {
       
      const { error } = await supabase
        .from('couple_budgets')
        .delete()
        .eq('id', id)
        .eq('connection_id', connectionId!);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    budgets,
    availableCategories,
    isLoading,
    createBudget,
    updateBudget,
    deleteBudget,
  };
}
