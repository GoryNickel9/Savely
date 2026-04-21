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

interface TcgCard {
  id: string;
  user_id: string;
  category: 'magic' | 'pokemon' | 'yugioh';
  card_id: string | null;
  current_price: number | null;
}

/**
 * Fetch the CT Zero lowest price (cents) for a CardTrader blueprint.
 * CT Zero sellers: products where user.can_sell_via_hub === true.
 * Returns the price in EUR (price_cents / 100), or null if unavailable.
 */
async function fetchCardTraderCtZeroPrice(blueprintId: string, apiKey: string): Promise<number | null> {
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

    const ctZeroProducts = products.filter((p) => p.user?.can_sell_via_hub === true);
    if (ctZeroProducts.length === 0) return null;

    const lowest = ctZeroProducts.reduce(
      (min, p) => (p.price_cents < min.price_cents ? p : min),
      ctZeroProducts[0],
    );

    const price = lowest.price_cents / 100;
    console.log(`✓ CT Zero price for blueprint ${blueprintId}: €${price}`);
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

    // Fetch all cards that have a card_id (blueprint_id) to look up
    const { data: cards, error: fetchError } = await supabase
      .from('tgc_cards')
      .select('id, user_id, category, card_id, current_price')
      .not('card_id', 'is', null);

    if (fetchError) {
      console.error('Error fetching TCG cards:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch cards', details: fetchError.message }),
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

      const price = await fetchCardTraderCtZeroPrice(card.card_id, apiKey);

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

