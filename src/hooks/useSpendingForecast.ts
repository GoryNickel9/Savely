import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { decodeForecast } from '@/lib/forecastContract';
import { useAuth } from './useAuth';

export function useSpendingForecast(date: string) {
  const { user, session } = useAuth();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  // Login instance prevents showing a cached response after signing in again.
  return useQuery({
    queryKey: ['spending-forecast', user?.id, session?.user.last_sign_in_at, timeZone, date],
    enabled: !!user && !!session,
    staleTime: 30_000,
    retry: false,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session || data.session.user.id !== user?.id) throw new Error('Session changed');
      const response = await fetch('/api/spending-forecast', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
        body: JSON.stringify({ schemaVersion: 1, timeZone }), signal, cache: 'no-store', redirect: 'error',
      });
      if (!response.ok) throw new Error('Forecast unavailable');
      const result = decodeForecast(await response.json(), user.id, timeZone);
      const current = await supabase.auth.getSession();
      if (current.data.session?.user.id !== user.id || current.data.session.user.last_sign_in_at !== data.session.user.last_sign_in_at) throw new Error('Session changed');
      return result;
    },
  });
}
