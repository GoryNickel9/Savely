import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface UseSupabaseDataOptions {
  tableName: string;
  orderBy?: string;
  ascending?: boolean;
  filter?: { column: string; value: any }[];
}

interface UseSupabaseDataReturn<T> {
  data: T[];
  loading: boolean;
  reload: () => Promise<void>;
}

export function useSupabaseData<T extends Record<string, any>>(
  options: UseSupabaseDataOptions
): UseSupabaseDataReturn<T> {
  const { tableName, orderBy, ascending = false, filter = [] } = options;
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      let query = supabase
        .from(tableName as any)
        .select('*')
        .eq('user_id', user.id);
      
      if (orderBy) {
        query = query.order(orderBy, { ascending });
      }
      
      if (filter.length > 0) {
        filter.forEach(f => {
          query = query.eq(f.column, f.value);
        });
      }
      
      const { data: result, error } = await query;
      
      if (error) throw error;
      
      setData((result as unknown as T[]) || []);
    } catch (error) {
      console.error(`Errore nel caricamento dei dati da ${tableName}:`, error);
      toast({
        title: 'Errore',
        description: 'Impossibile caricare i dati',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id, tableName, orderBy, ascending, filter, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return { data, loading, reload: loadData };
}
