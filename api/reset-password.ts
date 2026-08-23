import type { VercelRequest, VercelResponse } from './vercel';

/**
 * POST /api/reset-password  { email }
 *
 * Genera il recovery link con la Admin API di Supabase (i token restano
 * gestiti da Supabase Auth) e invia l'email branded via Resend.
 *
 * Env var richieste (solo lato server, MAI con prefisso VITE_):
 *   - SUPABASE_SERVICE_ROLE_KEY  (bypassa RLS: non deve mai finire nel bundle)
 *   - RESEND_API_KEY
 *   - RESEND_FROM (opzionale, default di test Resend)
 */

// URL pubblico per design (la chiave anon vive nel bundle; sicurezza via RLS).
const SUPABASE_URL =
  process.env.SUPABASE_URL ?? 'https://crqnfbahytzenisospcx.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM =
  process.env.RESEND_FROM ?? 'Savely <onboarding@resend.dev>';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// L'header Origin è controllato dal chiamante: lo accettiamo come redirect solo
// se in questa allow-list (defense-in-depth rispetto alla allow-list dei
// redirect URL configurata su Supabase, che resta l'ultimo filtro).
const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS ??
  'https://savely.cc,https://bank.savely.cc,http://localhost:8080'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function resolveRedirectTo(origin: string | undefined): string {
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return `${origin}/reset-password`;
  }
  // Origin assente o non riconosciuto: fallback sul dominio di produzione.
  return `${ALLOWED_ORIGINS[0]}/reset-password`;
}

// Rate limit in-memory per istanza: protegge dall'email bombing naive.
// Le Vercel Function possono girare su più istanze (limite non globale);
// per un limite distribuito usare Vercel WAF o un contatore in KV
// (v. TECH_DEBT_REPORT_2026-08-23.md, TD-004).
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minuti
const rateLimitHits = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (rateLimitHits.get(key) ?? []).filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW_MS,
  );
  if (recent.length >= RATE_LIMIT_MAX) {
    rateLimitHits.set(key, recent);
    return true;
  }
  recent.push(now);
  rateLimitHits.set(key, recent);
  return false;
}

async function generateRecoveryLink(email: string, redirectTo: string): Promise<string> {
  // GoTrue legge redirect_to dalla query string e lo onora solo se il dominio
  // è nella allow-list (Authentication → URL Configuration su Supabase);
  // altrimenti fa fallback al Site URL configurato.
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/generate_link?redirect_to=${encodeURIComponent(redirectTo)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ type: 'recovery', email }),
    },
  );
  if (!res.ok) {
    throw new Error(`generate_link ${res.status}: ${await res.text()}`);
  }
  // action_link è al livello root della risposta (non annidato).
  const data = (await res.json()) as { action_link: string };
  return data.action_link;
}

async function sendEmailWithResend(to: string, subject: string, html: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({ from: RESEND_FROM, to: [to], subject, html }),
  });
  if (!res.ok) {
    throw new Error(`Resend ${res.status}: ${await res.text()}`);
  }
}

function buildResetEmailHtml(link: string): string {
  return `<!doctype html>
<html lang="it">
  <body style="margin:0;padding:24px;background:#0a0a0a;font-family:system-ui,-apple-system,sans-serif;color:#fafafa;">
    <div style="max-width:480px;margin:0 auto;background:#141414;border:1px solid #262626;border-radius:12px;padding:32px;">
      <h1 style="margin:0 0 8px;font-size:24px;">Savely</h1>
      <p style="margin:0 0 24px;color:#a3a3a3;">Hai richiesto il reset della password.</p>
      <a href="${link}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">Reimposta password</a>
      <p style="margin:24px 0 0;color:#737373;font-size:13px;">
        Se non hai richiesto il reset, ignora questa email.
        Il link scade tra un'ora.
      </p>
    </div>
  </body>
</html>`;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const email =
    typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ error: 'Email non valida' });
    return;
  }

  if (!SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY) {
    res.status(500).json({ error: 'Invio email non configurato' });
    return;
  }

  // Rate limit per IP (spray su molti indirizzi) e per email (bombing).
  const ip = String(req.headers['x-forwarded-for'] ?? req.headers['x-real-ip'] ?? '')
    .split(',')[0]
    .trim();
  if (isRateLimited(`ip:${ip || 'unknown'}`) || isRateLimited(`email:${email}`)) {
    res.status(429).json({ error: 'Troppe richieste. Riprova più tardi.' });
    return;
  }

  try {
    const redirectTo = resolveRedirectTo(req.headers.origin);
    const link = await generateRecoveryLink(email, redirectTo);
    await sendEmailWithResend(
      email,
      'Reimposta la tua password - Savely',
      buildResetEmailHtml(link),
    );
    res.status(200).json({ ok: true });
  } catch (err) {
    // Risposta 200 generica per non rivelare quali indirizzi esistono
    // (enumerate attack); il dettaglio resta nei log server.
    console.error('reset-password:', err);
    res.status(200).json({ ok: true });
  }
}
