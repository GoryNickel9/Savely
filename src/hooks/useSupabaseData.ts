import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

/**
 * Whitelist delle tabelle valide per prevenire SQL injection
 * Nota: Le tabelle devono essere presenti nei tipi generati di Supabase
 */
const VALID_TABLES = [
  'transactions',
  'categories',
  'budgets',
  'savings_goals',
  'recurring_expenses',
  'portfolio_assets',
  'asset_price_history',
  'price_update_logs',
  'poker_manual_expenses',
  'poker_next_cut',
] as const;

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
    
    // Valida il nome della tabella
    if (!VALID_TABLES.includes(tableName as any)) {
      console.error(`Tabella non valida: ${tableName}`);
      toast({
        title: 'Errore',
        description: 'Tabella non valida',
        variant: 'destructive',
      });
      return;
    }
    
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
