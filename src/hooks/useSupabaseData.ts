import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { UserTableName } from '@/lib/constants';

const EMPTY_FILTER: { column: string; value: unknown }[] = [];

interface UseSupabaseDataOptions {
  tableName: UserTableName;
  orderBy?: string;
  ascending?: boolean;
  filter?: { column: string; value: unknown }[];
}

interface UseSupabaseDataReturn<T> {
  data: T[];
  loading: boolean;
  reload: () => Promise<void>;
}

export function useSupabaseData<T extends object>(
  options: UseSupabaseDataOptions
): UseSupabaseDataReturn<T> {
  const { tableName, orderBy, ascending = false, filter = EMPTY_FILTER } = options;
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const isLoadingRef = useRef(false);

  const loadData = useCallback(async () => {
    // Evita chiamate multiple concorrenti
    if (isLoadingRef.current) {
      return;
    }

    if (!user?.id) {
      return;
    }

    isLoadingRef.current = true;
    setLoading(true);

    try {
      // Il nome tabella è garantito valido dal tipo UserTableName
      // (whitelist compile-time in @/lib/constants, anti-SQL-injection).
      // Cast puntuale: l'unione di 25 tabelle fa esplodere l'inferenza di
      // supabase-js (TS2589); a runtime la query è identica.
      let query = supabase
        .from(tableName as 'transactions')
        .select('*')
        .eq('user_id', user.id);

      if (orderBy) {
        query = query.order(orderBy, { ascending });
      }

      if (filter.length > 0) {
        filter.forEach(f => {
          // Colonna dinamica: `never` è assegnabile a qualunque literal di
          // colonna e evita l'esplosione dell'inferenza (TS2589).
          query = query.eq(f.column as never, f.value as never);
        });
      }

      const { data: result, error } = await query;

      if (error) {
        throw error;
      }

      setData((result as unknown as T[]) || []);
    } catch (error) {
      console.error(`[useSupabaseData] Errore caricamento ${tableName}:`, error);
      toast({
        title: t('Errore'),
        description: t('Impossibile caricare i dati'),
        variant: 'destructive',
      });
    } finally {
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
