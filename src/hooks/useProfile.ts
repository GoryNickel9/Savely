import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { CurrencyCode } from '@/lib/types';

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  default_currency: CurrencyCode;
}

export function useProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, default_currency')
        .eq('user_id', user!.id)
        .single();
      if (error) throw error;
      return data as Profile;
    },
    enabled: !!user,
  });

  const updateDefaultCurrency = useMutation({
    mutationFn: async (currency: CurrencyCode) => {
      const { error } = await supabase
        .from('profiles')
        .update({ default_currency: currency } as any)
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  const defaultCurrency: CurrencyCode = profile?.default_currency ?? 'EUR';

  return { profile, isLoading, defaultCurrency, updateDefaultCurrency };
}
