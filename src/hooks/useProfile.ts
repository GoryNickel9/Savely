import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { CurrencyCode } from '@/lib/types';
import type { LanguageCode } from '@/i18n';

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  default_currency: CurrencyCode;
  language: LanguageCode;
}

export function useProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, default_currency, language')
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({ default_currency: currency } as any)
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  const updateLanguage = useMutation({
    mutationFn: async (language: LanguageCode) => {
      const { error } = await supabase
        .from('profiles')
        .update({ language })
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  const defaultCurrency: CurrencyCode = profile?.default_currency ?? 'EUR';

  return { profile, isLoading, defaultCurrency, updateDefaultCurrency, updateLanguage };
}
