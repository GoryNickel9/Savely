import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Transaction, TransactionType, CurrencyCode } from '@/lib/types';
import { useAuth } from './useAuth';

export function useTransactions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, category:categories(*)')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('date', { ascending: false });
      
      if (error) throw error;
      return data as Transaction[];
    },
    enabled: !!user,
  });

  const createTransaction = useMutation({
    mutationFn: async (transaction: {
      type: TransactionType;
      amount: number;
      currency?: CurrencyCode;
      category_id?: string;
      description?: string;
      date?: string;
    }) => {
      const { data, error } = await supabase
        .from('transactions')
        .insert({
          ...transaction,
          user_id: user!.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
    },
  });

  const updateTransaction = useMutation({
    mutationFn: async ({ id, ...updates }: {
      id: string;
      type?: TransactionType;
      amount?: number;
      currency?: CurrencyCode;
      category_id?: string;
      description?: string;
      date?: string;
    }) => {
      const { data, error } = await supabase
        .from('transactions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
    },
  });

  const deleteTransaction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
    },
  });

  return {
    transactions,
    isLoading,
    createTransaction,
    updateTransaction,
    deleteTransaction,
  };
}
