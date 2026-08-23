import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Category, TransactionType } from '@/lib/types';
import { useAuth } from './useAuth';

export function useCategories() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: categories = [], isLoading, refetch } = useQuery({
    queryKey: ['categories', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user!.id)
        .is('deleted_at', null)
        .order('name');
      
      if (error) throw error;
      return data as Category[];
    },
    enabled: !!user,
  });

  const createCategory = useMutation({
    mutationFn: async (category: { name: string; icon: string; color: string; type: TransactionType }) => {
      if (!user) throw new Error('Not authenticated');
      const { error, data } = await supabase.from('categories').insert({
        ...category,
        user_id: user.id,
      });
      if (error) {
        console.error('Errore creazione categoria:', error);
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
    },
  });

  const updateCategory = useMutation({
    mutationFn: async ({ id, ...category }: { id: string; name: string; icon: string; color: string; type: TransactionType }) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('categories')
        .update(category)
        .eq('id', id)
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
    },
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Not authenticated');

      // Prima aggiorna le transazioni associate per impostare category_id a NULL
      const { error: transactionsError } = await supabase
        .from('transactions')
        .update({ category_id: null })
        .eq('category_id', id)
        .eq('user_id', user!.id);
      
      if (transactionsError) {
        console.error('Errore aggiornamento transazioni:', transactionsError);
        throw transactionsError;
      }
      
      // Poi fai soft delete della categoria
      const updateData: Partial<Category> = { 
        deleted_at: new Date().toISOString() 
      };
      
      const { error, data } = await supabase
        .from('categories')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', user!.id);
      
      if (error) {
        console.error('Errore soft delete categoria:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
    },
  });

  const incomeCategories = categories.filter(c => c.type === 'income');
  const expenseCategories = categories.filter(c => c.type === 'expense');

  return {
    categories,
    incomeCategories,
    expenseCategories,
    isLoading,
    createCategory,
    updateCategory,
    deleteCategory,
    refetch,
  };
}
