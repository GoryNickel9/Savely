import { useRef, useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { getUserPermissions, parsePermissions } from '@/lib/permissions';
import { Permissions } from '@/lib/types';

const PERMISSIONS_STORAGE_KEY = 'savely_permissions';

// Il primo fetch dopo un refresh di pagina parte spesso mentre supabase-js
// sta ancora rinnovando l'access token scaduto: un singolo errore non è
// attendibile, quindi si riprova un numero limitato di volte.
export const FETCH_ATTEMPTS = 3;
export const RETRY_DELAY_MS = 1500;

/**
 * Cache in localStorage: i permessi sono legati all'utente che li ha
 * ottenuti, così un cambio di sessione sullo stesso browser (altro account,
 * altro tab) non eredita i moduli del predecessore.
 */
interface StoredPermissions {
  userId: string;
  permissions: Permissions;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function readStoredPermissions(): StoredPermissions | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(PERMISSIONS_STORAGE_KEY);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored) as Partial<StoredPermissions> | null;
    // Senza userId valido (o cache nel formato pre-envelope) l'owner è
    // sconosciuto: la si scarta invece di fidarci.
    if (typeof parsed?.userId !== 'string' || !parsed.permissions) {
      localStorage.removeItem(PERMISSIONS_STORAGE_KEY);
      return null;
    }
    // parsePermissions valida che ogni campo sia effettivamente booleano
    // (valori manipolati/non validi → false).
    return { userId: parsed.userId, permissions: parsePermissions(parsed.permissions) };
  } catch {
    localStorage.removeItem(PERMISSIONS_STORAGE_KEY);
    return null;
  }
}

export function usePermissions() {
  const { user } = useAuth();
  // Envelope letto una sola volta al mount: consente il render immediato con
  // i permessi noti dell'utente; il fetch parte comunque per confermare.
  const [stored] = useState(readStoredPermissions);
  const [permissions, setPermissions] = useState<Permissions | null>(
    stored?.permissions ?? null
  );
  // Proprietario dei permessi correnti in stato (cache iniziale o utente
  // dell'ultimo fetch riuscito): serve a scartarli al cambio utente.
  const permissionsOwnerId = useRef<string | null>(stored?.userId ?? null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setPermissions(null);
      permissionsOwnerId.current = null;
      localStorage.removeItem(PERMISSIONS_STORAGE_KEY);
      setLoading(false);
      return;
    }

    // I permessi in stato non sono affidabili se appartengono a un altro
    // utente (cambio sessione senza reload, cache non sua).
    if (permissionsOwnerId.current !== user.id) {
      permissionsOwnerId.current = null;
      setPermissions(null);
      localStorage.removeItem(PERMISSIONS_STORAGE_KEY);
    }

    setLoading(true);

    let cancelled = false;

    const fetchPermissions = async () => {
      for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt++) {
        try {
          const userPerms = await getUserPermissions(user.id);
          if (cancelled) return;
          permissionsOwnerId.current = user.id;
          setPermissions(userPerms);
          // Salva i permessi nel localStorage, legati all'utente
          const payload: StoredPermissions = { userId: user.id, permissions: userPerms };
          localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify(payload));
          setLoading(false);
          return;
        } catch (error) {
          if (cancelled) return;
          console.error(
            `Errore nel caricamento dei permessi (tentativo ${attempt}/${FETCH_ATTEMPTS}):`,
            error
          );
          if (attempt < FETCH_ATTEMPTS) {
            await sleep(RETRY_DELAY_MS);
            if (cancelled) return;
          }
        }
      }
      // Tutti i tentativi falliti: si conserva l'ultimo valore noto (stato e
      // cache) invece di azzerarlo, così la guardia decide su un dato reale.
      setLoading(false);
    };

    fetchPermissions();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return { permissions, loading };
}
