import type { VercelRequest, VercelResponse } from '@vercel/node';

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

async function generateRecoveryLink(email: string, redirectTo: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/generate_link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ type: 'recovery', email, redirect_to: redirectTo }),
  });
  if (!res.ok) {
    throw new Error(`generate_link ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { properties: { action_link: string } };
  return data.properties.action_link;
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

  try {
    const origin = req.headers.origin;
    const redirectTo =
      typeof origin === 'string' ? `${origin}/reset-password` : `${SUPABASE_URL}/reset-password`;
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
