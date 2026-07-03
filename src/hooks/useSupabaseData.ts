import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { USER_TABLES } from '@/lib/constants';

/**
 * Whitelist delle tabelle valide per prevenire SQL injection.
 *
 * Unica fonte di verita: `USER_TABLES` in `@/lib/constants`. Le tabelle devono
 * inoltre essere presenti nei tipi generati di Supabase.
 */
const VALID_TABLES = USER_TABLES;

const EMPTY_FILTER: { column: string; value: unknown }[] = [];

interface UseSupabaseDataOptions {
  tableName: string;
  orderBy?: string;
  ascending?: boolean;
  filter?: { column: string; value: unknown }[];
}

interface UseSupabaseDataReturn<T> {
  data: T[];
  loading: boolean;
  reload: () => Promise<void>;
}

export function useSupabaseData<T extends Record<string, unknown>>(
  options: UseSupabaseDataOptions
): UseSupabaseDataReturn<T> {
  const { tableName, orderBy, ascending = false, filter = EMPTY_FILTER } = options;
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const isLoadingRef = useRef(false);

  const loadData = useCallback(async () => {
    // Evita chiamate multiple concorrenti
    if (isLoadingRef.current) {
      console.log(`[useSupabaseData] Caricamento già in corso per ${tableName}, skip`);
      return;
    }
    
    if (!user?.id) {
      console.log(`[useSupabaseData] Nessun user ID per ${tableName}, skip`);
      return;
    }
    
    // Valida il nome della tabella
    if (!VALID_TABLES.includes(tableName as (typeof VALID_TABLES)[number])) {
      console.error(`[useSupabaseData] Tabella non valida: ${tableName}`);
      toast({
        title: 'Errore',
        description: 'Tabella non valida',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }
    
    console.log(`[useSupabaseData] Inizio caricamento da ${tableName}`);
    isLoadingRef.current = true;
    setLoading(true);
    
    try {
      let query = supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      
      console.log(`[useSupabaseData] Esecuzione query su ${tableName}`);
      const { data: result, error } = await query;
      
      if (error) {
        console.error(`[useSupabaseData] Errore query ${tableName}:`, error);
        throw error;
      }
      
      console.log(`[useSupabaseData] Dati caricati da ${tableName}:`, result?.length || 0, 'record');
      setData((result as unknown as T[]) || []);
    } catch (error) {
      console.error(`[useSupabaseData] Errore nel caricamento dei dati da ${tableName}:`, error);
      toast({
        title: 'Errore',
        description: 'Impossibile caricare i dati',
        variant: 'destructive',
      });
    } finally {
      console.log(`[useSupabaseData] Fine caricamento da ${tableName}, loading set a false`);
      isLoadingRef.current = false;
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, tableName, orderBy, ascending, filter]); // Rimuovo toast dalle dipendenze

  useEffect(() => {
    loadData();
  }, [loadData]);

  return { data, loading, reload: loadData };
}
