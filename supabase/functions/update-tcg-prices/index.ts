// @ts-ignore - Supabase Edge Functions don't have complete type definitions
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// @ts-ignore - Deno is available in Supabase Edge Functions
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGIN') || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

function getCorsHeaders(req: any): Record<string, string> {
  const requestOrigin: string | null = req.headers.get('origin');
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

const CT_API_URL = 'https://api.cardtrader.com/api/v2';

/**
 * S-3: verifica l'header x-cron-secret contro il valore in cron_config.
 * Le edge function "cron" non sono internal-only: sono HTTP pubblici, quindi
 * richiedono questo shared secret per impedire abuso anonimo.
 * Ritorna true solo se header presente e corrispondente.
 */
async function isCronAuthorized(supabase: any, req: any): Promise<boolean> {
  const provided = req.headers.get('x-cron-secret');
  if (!provided) return false;
  const { data } = await supabase
    .from('cron_config')
    .select('value')
    .eq('key', 'cron_secret')
    .maybeSingle();
  const expected = data?.value;
  // Rifiuta il placeholder: forza l'operatore a impostare un secret reale
  return !!expected
    && expected !== 'CHANGE_ME_GENERATE_A_RANDOM_SECRET'
    && provided === expected;
}

interface TcgCard {
  id: string;
  user_id: string;
  category: 'magic' | 'pokemon' | 'yugioh';
  card_id: string | null;
  current_price: number | null;
  condition: string | null;
}

// Maps app condition values to CardTrader API condition strings
function mapConditionToCardTrader(condition: string): string {
  const map: Record<string, string> = {
    near_mint: 'Near Mint',
    lightly_played: 'Slightly Played',
    moderately_played: 'Moderately Played',
    heavily_played: 'Heavily Played',
    damaged: 'Poor',
  };
  return map[condition] ?? 'Near Mint';
}

/**
 * Fetch the CT Zero lowest price (cents) for a CardTrader blueprint, filtered by condition.
 * CT Zero sellers: products where user.can_sell_via_hub === true.
 * Returns the price in EUR (price_cents / 100), or null if unavailable.
 */
async function fetchCardTraderCtZeroPrice(blueprintId: string, apiKey: string, condition?: string): Promise<number | null> {
  try {
    const res = await fetch(
      `${CT_API_URL}/marketplace/products?blueprint_id=${encodeURIComponent(blueprintId)}`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );

    if (!res.ok) {
      console.log(`✗ CardTrader marketplace error for blueprint ${blueprintId}: ${res.status}`);
      return null;
    }

    const data: Record<string, any[]> = await res.json();
    const products: any[] = data[blueprintId] ?? [];

    if (products.length === 0) return null;

    // 1. Restrict to CT Zero sellers (matches CardTrader "Prezzo Min CT")
    const ctZero = products.filter((p: any) => p.user?.can_sell_via_hub === true);
    let candidates = ctZero.length > 0 ? ctZero : products; // fallback to all if no CT Zero

    // 2. Further filter by condition
    if (condition) {
      const ctCondition = mapConditionToCardTrader(condition);
      const byCondition = candidates.filter((p) => (p as any).properties_hash?.condition === ctCondition);
      if (byCondition.length > 0) candidates = byCondition;
      // If no listings match the exact condition, fall back to CT Zero (any condition)
    }

    const lowest = candidates.reduce(
      (min, p) => (p.price_cents < min.price_cents ? p : min),
      candidates[0],
    );

    const price = lowest.price_cents / 100;
    console.log(`✓ Price for blueprint ${blueprintId} (${condition ?? 'any'}): €${price}`);
    return price;
  } catch (err) {
    console.error(`Error fetching CT Zero price for blueprint ${blueprintId}:`, err);
    return null;
  }
}

// @ts-ignore - Deno is available in Edge Functions
Deno.serve(async (req: any) => {
  const corsHeaders = getCorsHeaders(req);
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    // @ts-ignore
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    // @ts-ignore
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    // @ts-ignore
    const apiKey = Deno.env.get('CARDTRADER_API_KEY');

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'CARDTRADER_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // S-3: richiede il secret cron (endpoint non più richiamabile anonimamente)
    if (!(await isCronAuthorized(supabase, req))) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Fetch all cards that have a card_id (blueprint_id) to look up
    const { data: cards, error: fetchError } = await supabase
      .from('tgc_cards')
      .select('id, user_id, category, card_id, current_price, condition')
      .not('card_id', 'is', null);

    if (fetchError) {
      console.error('Error fetching TCG cards:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Internal error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!cards || cards.length === 0) {
      return new Response(
        JSON.stringify({ updated: 0, skipped: 0, failed: 0, message: 'No cards to update' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (const card of cards as TcgCard[]) {
      if (!card.card_id) {
        skipped++;
        continue;
      }

      const price = await fetchCardTraderCtZeroPrice(card.card_id, apiKey, card.condition ?? undefined);

      if (price !== null) {
        const { error: updateError } = await supabase
          .from('tgc_cards')
          .update({ current_price: price, updated_at: new Date().toISOString() })
          .eq('id', card.id);

        if (updateError) {
          console.error(`Error updating card ${card.id}:`, updateError);
          failed++;
        } else {
          updated++;
        }
      } else {
        failed++;
      }

      // Respect CardTrader rate limits: 200ms between requests
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    console.log(`TCG price update complete: ${updated} updated, ${skipped} skipped, ${failed} failed`);

    return new Response(
      JSON.stringify({ updated, skipped, failed, total: cards.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Unexpected error in update-tcg-prices:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

