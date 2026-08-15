import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { getUserPermissions, clearPermissionsCache } from '@/lib/permissions';
import { Permissions } from '@/lib/types';

const PERMISSIONS_STORAGE_KEY = 'savely_permissions';

/**
 * Type guard per validare che i dati siano un oggetto Permissions valido
 */
const validatePermissions = (data: unknown): data is Permissions => {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const perm = data as Partial<Permissions>;
  
  // Verifica che almeno un campo di permesso esista
  const hasAnyPermission =
    'admin' in perm ||
    'poker' in perm ||
    'fumo' in perm ||
    'fire' in perm ||
    'tcg' in perm ||
    'libreria' in perm;
  
  return hasAnyPermission;
};

export function usePermissions() {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<Permissions | null>(() => {
    // Carica i permessi dal localStorage all'inizializzazione
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(PERMISSIONS_STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          // Valida i dati prima di usarli
          if (validatePermissions(parsed)) {
            return parsed;
          } else {
            console.warn('Dati permessi non validi nel localStorage, verranno ricaricati');
            localStorage.removeItem(PERMISSIONS_STORAGE_KEY);
          }
        } catch (e) {
          console.error('Errore nel parsing dei permessi dal localStorage:', e);
          localStorage.removeItem(PERMISSIONS_STORAGE_KEY);
        }
      }
    }
    return null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setPermissions(null);
      localStorage.removeItem(PERMISSIONS_STORAGE_KEY);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchPermissions = async () => {
      try {
        const userPerms = await getUserPermissions(user.id);
        if (!cancelled) {
          setPermissions(userPerms);
          // Salva i permessi nel localStorage
          localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify(userPerms));
          setLoading(false);
        }
      } catch (error) {
        console.error('Errore nel caricamento dei permessi:', error);
        if (!cancelled) {
          setPermissions(null);
          localStorage.removeItem(PERMISSIONS_STORAGE_KEY);
          if (user?.id) {
            clearPermissionsCache(user.id);
          }
          setLoading(false);
        }
      }
    };

    fetchPermissions();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return { permissions, loading };
}