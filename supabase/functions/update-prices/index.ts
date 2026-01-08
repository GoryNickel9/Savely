// @ts-ignore - Supabase Edge Functions don't have complete type definitions
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Asset {
  id: string;
  user_id: string;
  symbol: string | null;
  type: string;
  current_price: number;
}

// Exchange suffixes to try for stocks/ETFs (ordered by popularity)
const EXCHANGE_SUFFIXES = [
  '',      // US stocks
  '.DE',   // Xetra (Germany)
  '.MI',   // Milan
  '.PA',   // Paris
  '.AS',   // Amsterdam
  '.L',    // London
  '.SW',   // Swiss
  '.VI',   // Vienna
  '.BR',   // Brussels
  '.HK',   // Hong Kong
  '.T',    // Tokyo
  '.TO',   // Toronto
];

// Fetch stock/ETF prices from Yahoo Finance with multiple exchange fallbacks
async function fetchStockPrice(symbol: string): Promise<number | null> {
  // Remove any existing suffix to get base symbol
  const baseSymbol = symbol.replace(/\.[A-Z]{1,2}$/i, '').toUpperCase();
  
  // If user already specified a suffix, try that first
  const userSuffix = symbol.match(/\.[A-Z]{1,2}$/i)?.[0] || '';
  const suffixesToTry = userSuffix 
    ? [userSuffix, ...EXCHANGE_SUFFIXES.filter(s => s !== userSuffix)]
    : EXCHANGE_SUFFIXES;
  
  for (const suffix of suffixesToTry) {
    const trySymbol = baseSymbol + suffix;
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${trySymbol}?interval=1d&range=1d`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      
      if (!response.ok) {
        continue; // Try next suffix
      }
      
      const data = await response.json();
      const result = data?.chart?.result?.[0];
      
      if (!result) continue;
      
      // Try multiple price sources
      const price = result.meta?.regularMarketPrice 
        || result.indicators?.quote?.[0]?.close?.slice(-1)[0]
        || result.meta?.previousClose;
      
      if (price && price > 0) {
        console.log(`✓ Found price for ${trySymbol}: €${price}`);
        return price;
      }
    } catch (error) {
      console.error(`Error fetching ${trySymbol}:`, error);
    }
    
    // Small delay between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`✗ No price found for ${symbol} on any exchange`);
  return null;
}

// CoinGecko ID mappings for common cryptos
const CRYPTO_ID_MAP: Record<string, string> = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'SOL': 'solana',
  'ADA': 'cardano',
  'DOT': 'polkadot',
  'AVAX': 'avalanche-2',
  'MATIC': 'polygon',
  'LINK': 'chainlink',
  'UNI': 'uniswap',
  'XRP': 'ripple',
  'DOGE': 'dogecoin',
  'LTC': 'litecoin',
  'BNB': 'binancecoin',
  'USDT': 'tether',
  'USDC': 'usd-coin',
  'ATOM': 'cosmos',
  'NEAR': 'near',
  'APT': 'aptos',
  'ARB': 'arbitrum',
  'OP': 'optimism',
  'INJ': 'injective-protocol',
  'SUI': 'sui',
  'SEI': 'sei-network',
  'TIA': 'celestia',
  'PEPE': 'pepe',
  'SHIB': 'shiba-inu',
  'XLM': 'stellar',
  'ALGO': 'algorand',
  'VET': 'vechain',
  'FTM': 'fantom',
  'SAND': 'the-sandbox',
  'MANA': 'decentraland',
  'AXS': 'axie-infinity',
  'AAVE': 'aave',
  'MKR': 'maker',
  'CRV': 'curve-dao-token',
  'LDO': 'lido-dao',
  'RETH': 'rocket-pool-eth',
  'STETH': 'staked-ether',
};

// Fetch crypto prices from CoinGecko
async function fetchCryptoPrice(symbol: string): Promise<number | null> {
  try {
    // Clean up symbol
    const cleanSymbol = symbol.toUpperCase().replace(/[-\/].*/, '').trim();
    const coinId = CRYPTO_ID_MAP[cleanSymbol] || cleanSymbol.toLowerCase();
    
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=eur`;
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      console.log(`CoinGecko error for ${symbol}: ${response.status}`);
      
      // Try searching by symbol if ID lookup failed
      const searchUrl = `https://api.coingecko.com/api/v3/search?query=${cleanSymbol}`;
      const searchResponse = await fetch(searchUrl);
      
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        const coin = searchData.coins?.[0];
        
        if (coin?.id) {
          await new Promise(resolve => setTimeout(resolve, 200));
          const priceUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${coin.id}&vs_currencies=eur`;
          const priceResponse = await fetch(priceUrl);
          
          if (priceResponse.ok) {
            const priceData = await priceResponse.json();
            const price = priceData[coin.id]?.eur;
            if (price) {
              console.log(`✓ Found crypto price for ${symbol} (${coin.id}): €${price}`);
              return price;
            }
          }
        }
      }
      
      return null;
    }
    
    const data = await response.json();
    const price = data[coinId]?.eur;
    
    if (price) {
      console.log(`✓ Found crypto price for ${symbol}: €${price}`);
      return price;
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching crypto price for ${symbol}:`, error);
    return null;
  }
}

// @ts-ignore - Deno is available in Edge Functions
Deno.serve(async (req: any) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: corsHeaders
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user_id from request body (optional)
    let userId: string | null = null;
    try {
      const body = await req.json();
      userId = body.user_id || null;
    } catch {
      // No body provided
    }

    // Fetch assets that need price updates
    let query = supabase
      .from('portfolio_assets')
      .select('id, user_id, symbol, type, current_price')
      .not('symbol', 'is', null)
      .neq('symbol', '');

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: assets, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching assets:', fetchError);
      throw fetchError;
    }

    if (!assets || assets.length === 0) {
      console.log('No assets to update');
      
      // Log the update attempt
      await supabase.from('price_update_logs').insert({
        assets_checked: 0,
        assets_updated: 0,
        errors: [],
      });
      
      return new Response(
        JSON.stringify({ message: 'No assets to update', updated: 0, errors: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${assets.length} assets to update`);

    const updates: { id: string; user_id: string; price: number; symbol: string }[] = [];
    const errors: { symbol: string; error: string }[] = [];

    for (const asset of assets as Asset[]) {
      if (!asset.symbol) continue;

      let newPrice: number | null = null;

      if (asset.type === 'crypto') {
        newPrice = await fetchCryptoPrice(asset.symbol);
      } else if (['stock', 'etf'].includes(asset.type)) {
        newPrice = await fetchStockPrice(asset.symbol);
      }

      if (newPrice !== null && newPrice > 0) {
        updates.push({ id: asset.id, user_id: asset.user_id, price: newPrice, symbol: asset.symbol });
      } else {
        errors.push({ symbol: asset.symbol, error: 'Price not found on any exchange' });
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 250));
    }

    // Batch update prices and save to history
    let updatedCount = 0;
    const today = new Date().toISOString().split('T')[0];

    for (const update of updates) {
      // Update current price
      const { error: updateError } = await supabase
        .from('portfolio_assets')
        .update({ current_price: update.price, updated_at: new Date().toISOString() })
        .eq('id', update.id);

      if (updateError) {
        console.error(`Error updating ${update.symbol}:`, updateError);
        errors.push({ symbol: update.symbol, error: 'Database update failed' });
      } else {
        updatedCount++;
        console.log(`Updated ${update.symbol} to €${update.price}`);

        // Save to price history (upsert to handle one price per day)
        const { error: historyError } = await supabase
          .from('asset_price_history')
          .upsert({
            asset_id: update.id,
            user_id: update.user_id,
            price: update.price,
            recorded_at: today,
          }, {
            onConflict: 'asset_id,recorded_at',
          });

        if (historyError) {
          console.error(`Error saving history for ${update.symbol}:`, historyError);
        } else {
          console.log(`Saved price history for ${update.symbol}`);
        }
      }
    }

    // Log the price update
    const { error: logError } = await supabase.from('price_update_logs').insert({
      assets_checked: assets.length,
      assets_updated: updatedCount,
      errors: errors,
    });

    if (logError) {
      console.error('Error logging price update:', logError);
    }

    console.log(`\n=== SUMMARY ===`);
    console.log(`Checked: ${assets.length}`);
    console.log(`Updated: ${updatedCount}`);
    if (errors.length > 0) {
      console.log(`Errors: ${errors.map(e => e.symbol).join(', ')}`);
    }

    return new Response(
      JSON.stringify({ 
        message: 'Price update complete', 
        checked: assets.length,
        updated: updatedCount,
        errors 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in update-prices function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
