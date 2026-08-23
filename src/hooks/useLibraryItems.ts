import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { LibraryItem, LibraryCategory } from '@/lib/types';
import { useAuth } from './useAuth';

 

export function useLibraryItems(category?: LibraryCategory) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['library-items', user?.id, category],
    queryFn: async () => {
      let query = supabase
        .from('library_items')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as LibraryItem[];
    },
    enabled: !!user,
  });

  const createItem = useMutation({
    mutationFn: async (item: {
      category: LibraryCategory;
      title: string;
      author?: string;
      publisher?: string;
      year?: number;
      cover_image?: string;
      api_id?: string;
      purchase_price?: number;
      reselling_value?: number;
      quantity?: number;
      notes?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('library_items').insert({
        ...item,
        user_id: user.id,
        quantity: item.quantity ?? 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library-items'] });
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<LibraryItem> & { id: string }) => {
      const { error } = await supabase
        .from('library_items')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library-items'] });
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('library_items')
        .delete()
        .eq('id', id)
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library-items'] });
    },
  });

  const totalCost = items.reduce((sum, i) => sum + (i.purchase_price ?? 0) * i.quantity, 0);
  const totalReselling = items.reduce((sum, i) => sum + (i.reselling_value ?? 0) * i.quantity, 0);
  const totalGain = totalReselling - totalCost;
  const totalPieces = items.reduce((sum, i) => sum + i.quantity, 0);

  return {
    items,
    isLoading,
    createItem,
    updateItem,
    deleteItem,
    totalCost,
    totalReselling,
    totalGain,
    totalPieces,
  };
}
