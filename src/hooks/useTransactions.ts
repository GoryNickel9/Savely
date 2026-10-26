import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Transaction, TransactionType, CurrencyCode } from '@/lib/types';
import { useAuth } from './useAuth';

const PAGE_SIZE = 1000;

export function useTransactions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: transactions = [], isLoading, isError } = useQuery({
    queryKey: ['transactions', user?.id],
    queryFn: async ({ signal }) => {
      const allTransactions: Transaction[] = [];
      const seen = new Set<string>();
      let total: number | null = null;

      do {
        const offset = allTransactions.length;
        const { data, error, count } = await supabase
          .from('transactions')
          .select('*, category:categories(*)', { count: 'exact' })
          .eq('user_id', user!.id)
          .is('deleted_at', null)
          .order('date', { ascending: false })
          .order('id', { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1)
          .abortSignal(signal);

        if (error) throw error;
        if (count === null) throw new Error('Conteggio delle transazioni non disponibile');
        if (total !== null && count !== total) throw new Error('Lo storico è cambiato durante il caricamento. Riprova.');
        total = count;
        if (!data || (!data.length && allTransactions.length < total)) {
          throw new Error('Caricamento dello storico incompleto');
        }
        for (const transaction of data) {
          if (seen.has(transaction.id)) throw new Error('Lo storico è cambiato durante il caricamento. Riprova.');
          seen.add(transaction.id);
        }
        allTransactions.push(...(data as Transaction[]));
      } while (allTransactions.length < total);

      return allTransactions;
    },
    enabled: !!user,
  });

  const createTransaction = useMutation({
    mutationFn: async (transaction: {
      type: TransactionType;
      amount: number;
      currency?: CurrencyCode;
      exchange_rate_eur?: number;
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
      queryClient.invalidateQueries({ queryKey: ['spending-forecast'] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
    },
  });

  const updateTransaction = useMutation({
    mutationFn: async ({ id, ...updates }: {
      id: string;
      type?: TransactionType;
      amount?: number;
      currency?: CurrencyCode;
      exchange_rate_eur?: number;
      category_id?: string;
      description?: string;
      date?: string;
    }) => {
      const { data, error } = await supabase
        .from('transactions')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user!.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['spending-forecast'] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
    },
  });

  const deleteTransaction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id)
        .eq('user_id', user!.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['spending-forecast'] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
    },
  });

  return {
    transactions,
    isLoading,
    isError,
    createTransaction,
    updateTransaction,
    deleteTransaction,
  };
}
