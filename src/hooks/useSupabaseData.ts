import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
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

/**
 * Hook generico di caricamento dati utente da una tabella della whitelist
 * UserTableName (TD-009: migrato da useState/useEffect a React Query,
 * API pubblica invariata — { data, loading, reload } — così i consumer
 * non cambiano).
 */
export function useSupabaseData<T extends object>(
  options: UseSupabaseDataOptions
): UseSupabaseDataReturn<T> {
  const { tableName, orderBy, ascending = false, filter = EMPTY_FILTER } = options;
  const { user } = useAuth();
  const { t } = useTranslation();

  const query = useQuery({
    queryKey: ['supabase-data', tableName, user?.id, orderBy ?? null, ascending, filter],
    enabled: !!user?.id,
    // Comportamento allineato alla precedente implementazione manuale:
    // un solo tentativo per fetch e nessun refetch automatico su focus.
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<T[]> => {
      try {
        // Il nome tabella è garantito valido dal tipo UserTableName
        // (whitelist compile-time in @/lib/constants, anti-SQL-injection).
        // Cast puntuale: l'unione di 25 tabelle fa esplodere l'inferenza di
        // supabase-js (TS2589); a runtime la query è identica.
        let queryBuilder = supabase
          .from(tableName as 'transactions')
          .select('*')
          .eq('user_id', user!.id);

        if (orderBy) {
          queryBuilder = queryBuilder.order(orderBy, { ascending });
        }

        for (const f of filter) {
          // Colonna dinamica: `never` è assegnabile a qualunque literal di
          // colonna e evita l'esplosione dell'inferenza (TS2589).
          queryBuilder = queryBuilder.eq(f.column as never, f.value as never);
        }

        const { data: result, error } = await queryBuilder;
        if (error) {
          throw error;
        }
        return (result ?? []) as unknown as T[];
      } catch (error) {
        console.error(`[useSupabaseData] Errore caricamento ${tableName}:`, error);
        toast.error(t('Errore'), { description: t('Impossibile caricare i dati') });
        throw error;
      }
    },
  });

  return {
    data: query.data ?? [],
    loading: query.isLoading,
    reload: async () => {
      await query.refetch();
    },
  };
}
