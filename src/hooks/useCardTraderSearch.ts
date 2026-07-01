import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CardTraderCard {
  id: string;
  name: string;
  image?: string;
  set: {
    id?: string;
    name: string;
  };
}

export function useCardTraderSearch() {
  const [results, setResults] = useState<CardTraderCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async (name: string) => {
    if (!name.trim()) return;

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const url = `${supabaseUrl}/functions/v1/cardtrader-proxy?action=search&name=${encodeURIComponent(name.trim())}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error ?? 'Errore durante la ricerca');
      }

      const data: CardTraderCard[] = await res.json();
      setResults(data);
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResults([]);
    setError(null);
  };

  return { results, loading, error, search, reset };
}
