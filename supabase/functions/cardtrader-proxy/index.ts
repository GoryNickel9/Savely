// @ts-ignore - Deno is available in Supabase Edge Functions
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CT_API_URL = 'https://api.cardtrader.com/api/v2';

// Module-level cache for expansions (persists across warm invocations)
let expansionsCache: Record<number, { id: number; name: string }> = {};
let isFetchingExpansions = false;

// @ts-ignore
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGIN') || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

function getCorsHeaders(requestOrigin: string | null): Record<string, string> {
  const isLocalhost =
    requestOrigin?.startsWith('http://localhost') ||
    requestOrigin?.startsWith('http://127.0.0.1');
  const isAllowed = requestOrigin != null && ALLOWED_ORIGINS.includes(requestOrigin);
  const origin = isLocalhost || isAllowed ? requestOrigin! : (ALLOWED_ORIGINS[0] ?? '');
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

async function getExpansions(apiKey: string): Promise<Record<number, { id: number; name: string }>> {
  if (Object.keys(expansionsCache).length > 0) return expansionsCache;
  if (isFetchingExpansions) {
    while (isFetchingExpansions) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return expansionsCache;
  }

  isFetchingExpansions = true;
  try {
    const res = await fetch(`${CT_API_URL}/expansions`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.ok) {
      const expansions: any[] = await res.json();
      expansions.forEach((exp) => {
        expansionsCache[exp.id] = { id: exp.id, name: exp.name };
      });
    }
    return expansionsCache;
  } catch (err) {
    console.error('Error fetching expansions:', err);
    return {};
  } finally {
    isFetchingExpansions = false;
  }
}

// @ts-ignore
Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));

  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  // SEC-2: richiede un utente autenticato (evita abuso come proxy aperto)
  // @ts-ignore
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  // @ts-ignore
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const authHeader = req.headers.get('Authorization');
  if (!supabaseUrl || !supabaseAnonKey || !authHeader) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
  try {
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
  } catch (err) {
    console.error('Auth check failed:', err);
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // @ts-ignore
  const apiKey = Deno.env.get('CARDTRADER_API_KEY');
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'CARDTRADER_API_KEY not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  try {
    // ── SEARCH ──────────────────────────────────────────────────────────────
    if (action === 'search') {
      const name = searchParams.get('name');
      if (!name) {
        return new Response(
          JSON.stringify({ error: 'Missing name parameter' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      await getExpansions(apiKey);

      const res = await fetch(
        `${CT_API_URL}/blueprints?name=${encodeURIComponent(name)}`,
        { headers: { Authorization: `Bearer ${apiKey}` } },
      );

      if (!res.ok) {
        const text = await res.text();
        console.error(`CardTrader blueprints error ${res.status}: ${text}`);
        throw new Error(`CardTrader error: ${res.statusText}`);
      }

      const blueprints: any[] = await res.json();

      const cards = blueprints.map((bp) => {
        const expansion = expansionsCache[bp.expansion_id] ?? { name: 'Unknown Set' };
        return {
          id: bp.id.toString(),
          name: bp.name,
          image: bp.image_url ?? (bp.image?.url ? `https://api.cardtrader.com${bp.image.url}` : undefined),
          set: {
            id: expansion.id?.toString(),
            name: expansion.name,
          },
        };
      });

      return new Response(JSON.stringify(cards), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── PRICES ──────────────────────────────────────────────────────────────
    if (action === 'prices') {
      const id = searchParams.get('id');
      const conditionParam = searchParams.get('condition'); // optional: app CardCondition value
      if (!id) {
        return new Response(
          JSON.stringify({ error: 'Missing id parameter' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const res = await fetch(
        `${CT_API_URL}/marketplace/products?blueprint_id=${encodeURIComponent(id)}`,
        { headers: { Authorization: `Bearer ${apiKey}` } },
      );

      if (!res.ok) {
        throw new Error(`CardTrader marketplace error: ${res.statusText}`);
      }

      const data: Record<string, any[]> = await res.json();
      const products: any[] = data[id] ?? [];

      // 1. Restrict to CT Zero sellers (matches CardTrader "Prezzo Min CT")
      const ctZero = products.filter((p: any) => p.user?.can_sell_via_hub === true);
      let candidates = ctZero.length > 0 ? ctZero : products; // fallback to all if no CT Zero

      // 2. Further filter by condition
      if (conditionParam) {
        const conditionMap: Record<string, string> = {
          near_mint: 'Near Mint',
          lightly_played: 'Slightly Played',
          moderately_played: 'Moderately Played',
          heavily_played: 'Heavily Played',
          damaged: 'Poor',
        };
        const ctCondition = conditionMap[conditionParam] ?? 'Near Mint';
        const byCondition = candidates.filter((p) => (p as any).properties_hash?.condition === ctCondition);
        if (byCondition.length > 0) candidates = byCondition;
        // If no exact condition match, fall back to CT Zero (any condition)
      }

      const lowestCtZero =
        candidates.length > 0
          ? candidates.reduce((min, p) => (p.price_cents < min.price_cents ? p : min), candidates[0])
          : null;

      return new Response(
        JSON.stringify({
          ctZeroLowPrice: lowestCtZero ? lowestCtZero.price.formatted : null,
          ctZeroLowPriceCents: lowestCtZero ? lowestCtZero.price_cents : null,
          totalListings: products.length,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use action=search or action=prices' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    console.error('cardtrader-proxy error:', err);
    return new Response(
      JSON.stringify({ error: err.message ?? 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
