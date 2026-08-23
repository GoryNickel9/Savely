import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface SharedExpenseViewRow {
  id: string;
  connection_id: string;
  original_tx_id: string;
  created_by: string;
  couple_category_name: string | null;
  split_percentage: number;
  split_mode: 'equal' | 'custom';
  partner_amount: number | null;
  partner_share_amount: number;
  creator_share_amount: number;
  created_at: string;
  updated_at: string;
  total_amount: number;
  my_share_amount: number;
  currency: string;
  exchange_rate_eur: number;
  description: string | null;
  date: string;
  tx_deleted_at: string | null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useSharedExpenses(connectionId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // ------------------------------------------------------------------
  // Query: reads from the shared_expenses_view (no category_id exposed)
  // ------------------------------------------------------------------
  const { data: sharedExpenses = [], isLoading } = useQuery({
    queryKey: ['shared_expenses', connectionId, user?.id],
    queryFn: async (): Promise<SharedExpenseViewRow[]> => {
       
      const { data, error } = await supabase
        .from('shared_expenses_view')
        .select('*')
        .eq('connection_id', connectionId!);
      if (error) throw error;
      return (data ?? []) as SharedExpenseViewRow[];
    },
    enabled: !!connectionId && !!user,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['shared_expenses'] });
    queryClient.invalidateQueries({ queryKey: ['couple_statistics'] });
  };

  // Shared expenses created by ME (to show "Condivisa" badge on my transactions)
  const mySharedExpenses = useMemo(
    () => sharedExpenses.filter(se => se.created_by === user?.id),
    [sharedExpenses, user?.id]
  );

  // Set of my transaction IDs that have been shared (quick lookup)
  const mySharedTransactionIds = useMemo(
    () => new Set(mySharedExpenses.map(se => se.original_tx_id)),
    [mySharedExpenses]
  );

  // Shared expenses created by PARTNER (to display in my transaction list)
  const partnerSharedExpenses = useMemo(
    () => sharedExpenses.filter(se => se.created_by !== user?.id),
    [sharedExpenses, user?.id]
  );

  // ------------------------------------------------------------------
  // Create: called after creating a transaction to mark it as shared
  // ------------------------------------------------------------------
  const createSharedExpense = useMutation({
    mutationFn: async (params: {
      connection_id: string;
      original_tx_id: string;
      couple_category_name: string | null;
      split_mode?: 'equal' | 'custom';
      partner_amount?: number | null;
    }) => {
       
      const { error } = await supabase.from('shared_expenses').insert({
        connection_id: params.connection_id,
        original_tx_id: params.original_tx_id,
        couple_category_name: params.couple_category_name,
        split_mode: params.split_mode ?? 'equal',
        partner_amount: params.split_mode === 'custom' ? params.partner_amount : null,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // ------------------------------------------------------------------
  // Remove: creator removes the shared link (original transaction kept)
  // ------------------------------------------------------------------
  const removeMySharedExpense = useMutation({
    mutationFn: async (sharedExpenseId: string) => {
       
      const { error } = await supabase
        .from('shared_expenses')
        .delete()
        .eq('id', sharedExpenseId)
        .eq('created_by', user!.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // ------------------------------------------------------------------
  // Remove: partner removes the shared link via SECURITY DEFINER RPC
  // ------------------------------------------------------------------
  const removePartnerSharedExpense = useMutation({
    mutationFn: async (sharedExpenseId: string) => {
      const { error } = await supabase.rpc(
         
        'delete_shared_expense_by_partner',
        { p_id: sharedExpenseId }
      );
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    sharedExpenses,
    mySharedExpenses,
    mySharedTransactionIds,
    partnerSharedExpenses,
    isLoading,
    createSharedExpense,
    removeMySharedExpense,
    removePartnerSharedExpense,
  };
}
