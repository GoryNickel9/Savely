import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { todayLocalISO } from '@/lib/utils';
import { useAuth } from './useAuth';

export function useTransactionBalance(end: Date, previousEnd: Date) {
  const { user } = useAuth();
  const endDate = todayLocalISO(end);
  const previousDate = todayLocalISO(previousEnd);

  return useQuery({
    // Lo stesso prefisso invalida il saldo anche dopo gli import e il CRUD.
    queryKey: ['transactions', user?.id, 'balance', endDate, previousDate],
    enabled: !!user,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .rpc('get_transaction_balance', { p_date: endDate, p_previous_date: previousDate })
        .abortSignal(signal)
        .single();
      if (error) throw error;
      if (data?.balance == null || data.previous_balance == null) {
        throw new Error('Saldo non disponibile');
      }
      const balance = Number(data.balance);
      const previousBalance = Number(data.previous_balance);
      if (!Number.isFinite(balance) || !Number.isFinite(previousBalance)) {
        throw new Error('Saldo non valido');
      }
      return { balance, previousBalance };
    },
  });
}
