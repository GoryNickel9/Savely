// @ts-ignore - Deno is available in Supabase Edge Functions
// Uses Jikan v4 API (MyAnimeList) for reliable manga search — no auth required.
// MangaWorld scraping was replaced because the site uses Cloudflare bot protection
// that returns challenge pages to server-side fetches with no HTTP error.

const JIKAN_BASE = 'https://api.jikan.moe/v4';

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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };
}

interface MangaResult {
  id: string;
  title: string;
  titleJp?: string;
  authors?: string;
  coverImage?: string;
  url: string;
  year?: number;
  type?: string;
  status?: string;
}

interface JikanManga {
  mal_id: number;
  url: string;
  images?: {
    jpg?: { image_url?: string; large_image_url?: string };
    webp?: { image_url?: string; large_image_url?: string };
  };
  title: string;
  title_japanese?: string;
  type?: string;
  status?: string;
  published?: { prop?: { from?: { year?: number } } };
  authors?: Array<{ name?: string }>;
}

async function searchViaJikan(query: string, limit = 20): Promise<MangaResult[]> {
  const url = `${JIKAN_BASE}/manga?q=${encodeURIComponent(query)}&limit=${limit}&order_by=popularity&sort=asc`;

  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) throw new Error(`Jikan API error: ${res.status}`);

  const json = await res.json();
  const items: JikanManga[] = json.data ?? [];

  return items.map((item) => {
    const cover =
      item.images?.jpg?.large_image_url ??
      item.images?.jpg?.image_url ??
      item.images?.webp?.image_url ??
      undefined;

    const authors = item.authors
      ?.map((a) => a.name ?? '')
      .filter(Boolean)
      .join(', ') || undefined;

    const year = item.published?.prop?.from?.year ?? undefined;

    return {
      id: String(item.mal_id),
      title: item.title,
      titleJp: item.title_japanese ?? undefined,
      authors,
      coverImage: cover,
      url: item.url,
      year,
      type: item.type ?? undefined,
      status: item.status ?? undefined,
    };
  });
}

// @ts-ignore
Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));

  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  // ── HEALTH CHECK ─────────────────────────────────────────────────────────
  if (action === 'healthcheck') {
    return new Response(
      JSON.stringify({ ok: true, source: 'jikan-v4' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // ── SEARCH ───────────────────────────────────────────────────────────────
  if (action === 'search') {
    const query = searchParams.get('q');
    if (!query?.trim()) {
      return new Response(
        JSON.stringify({ error: "Missing query param 'q'" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    try {
      const results = await searchViaJikan(query.trim());
      return new Response(JSON.stringify(results), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (err: any) {
      console.error('mangaworld-proxy search error:', err);
      return new Response(
        JSON.stringify({ error: err.message ?? 'Internal server error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  return new Response(
    JSON.stringify({ error: 'Invalid action. Use action=search or action=healthcheck' }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
