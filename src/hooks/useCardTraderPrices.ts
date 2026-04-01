import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Fetch CT Zero price for a blueprint imperatively (e.g. at form submit time).
 * Returns the price in euros, or null if unavailable.
 */
export async function fetchCtZeroPrice(blueprintId: string): Promise<number | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const url = `${supabaseUrl}/functions/v1/cardtrader-proxy?action=prices&id=${encodeURIComponent(blueprintId)}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return null;
    const data: CardTraderPrices = await res.json();
    if (data.ctZeroLowPriceCents == null) return null;
    return data.ctZeroLowPriceCents / 100;
  } catch {
    return null;
  }
}

export interface CardTraderPrices {
  ctZeroLowPrice: string | null;
  ctZeroLowPriceCents: number | null;
  totalListings: number;
}

export function useCardTraderPrices(blueprintId: string | null) {
  return useQuery<CardTraderPrices | null>({
    queryKey: ['cardtrader-prices', blueprintId],
    queryFn: async () => {
      if (!blueprintId) return null;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const url = `${supabaseUrl}/functions/v1/cardtrader-proxy?action=prices&id=${encodeURIComponent(blueprintId)}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error ?? 'Errore nel recupero prezzi');
      }

      return res.json() as Promise<CardTraderPrices>;
    },
    enabled: !!blueprintId,
    staleTime: 1000 * 60 * 60 * 24, // 24h — aggiornamento settimanale lato cron
    retry: 1,
  });
}
