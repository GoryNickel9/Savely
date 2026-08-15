import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * POST /api/admin  { action, ... }
 *
 * Endpoint riservato agli admin (permissions.admin su profiles).
 * Il chiamante si autentica con il proprio token di sessione Supabase
 * nell'header Authorization; la verifica e le operazioni privilegiate
 * usano la service role key (solo lato server, MAI con prefisso VITE_).
 *
 * Azioni:
 *   - get-users          -> elenco utenti auth con email + profilo
 *   - delete-user        -> eliminazione definitiva (userId nel body)
 */

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? 'https://crqnfbahytzenisospcx.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const serviceHeaders: Record<string, string> = {
  'Content-Type': 'application/json',
  apikey: SUPABASE_SERVICE_ROLE_KEY!,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
};

/** Verifica il token del chiamante e che sia admin. Ritorna l'id del chiamante. */
async function requireAdmin(
  req: VercelRequest,
): Promise<{ id: string } | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ') || !SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  const token = authHeader.slice('Bearer '.length);

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return null;
  const caller = (await userRes.json()) as { id?: string };
  if (!caller.id) return null;

  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${encodeURIComponent(caller.id)}&select=permissions`,
    { headers: serviceHeaders },
  );
  if (!profileRes.ok) return null;
  const profiles = (await profileRes.json()) as {
    permissions?: Record<string, boolean>;
  }[];
  return profiles[0]?.permissions?.admin === true ? { id: caller.id } : null;
}

interface AuthUser {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
}

async function listAuthUsers(): Promise<AuthUser[]> {
  const all: AuthUser[] = [];
  const perPage = 1000;
  for (let page = 1; page <= 10; page++) {
    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?per_page=${perPage}&page=${page}`,
      { headers: serviceHeaders },
    );
    if (!res.ok) {
      throw new Error(`admin/users ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as { users?: AuthUser[] };
    all.push(...(data.users ?? []));
    if ((data.users?.length ?? 0) < perPage) break;
  }
  return all;
}

async function getUsers() {
  const [authUsers, profilesRes] = await Promise.all([
    listAuthUsers(),
    fetch(`${SUPABASE_URL}/rest/v1/profiles?select=user_id,full_name,permissions`, {
      headers: serviceHeaders,
    }),
  ]);
  if (!profilesRes.ok) {
    throw new Error(`profiles ${profilesRes.status}: ${await profilesRes.text()}`);
  }
  const profiles = (await profilesRes.json()) as {
    user_id: string;
    full_name: string | null;
    permissions: Record<string, boolean>;
  }[];
  const profilesByUserId = new Map(profiles.map((p) => [p.user_id, p]));

  return authUsers.map((u) => {
    const profile = profilesByUserId.get(u.id);
    return {
      user_id: u.id,
      email: u.email,
      full_name: profile?.full_name ?? null,
      permissions: profile?.permissions ?? {},
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
    };
  });
}

async function deleteUser(userId: string) {
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
    { method: 'DELETE', headers: serviceHeaders },
  );
  // 200 = eliminato; 404 = utente inesistente (già rimosso)
  if (!res.ok && res.status !== 404) {
    throw new Error(`delete user ${res.status}: ${await res.text()}`);
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const caller = await requireAdmin(req);
    if (!caller) {
      res.status(403).json({ error: 'Non autorizzato' });
      return;
    }

    const action = req.body?.action;

    if (action === 'get-users') {
      res.status(200).json({ users: await getUsers() });
      return;
    }

    if (action === 'delete-user') {
      const userId = typeof req.body.userId === 'string' ? req.body.userId : '';
      if (!/^[0-9a-f-]{36}$/i.test(userId)) {
        res.status(400).json({ error: 'userId non valido' });
        return;
      }
      if (userId === caller.id) {
        res.status(400).json({ error: 'Non puoi eliminare il tuo account' });
        return;
      }
      await deleteUser(userId);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(400).json({ error: 'Azione non valida' });
  } catch (err) {
    console.error('admin:', err);
    res.status(500).json({ error: 'Errore interno' });
  }
}
