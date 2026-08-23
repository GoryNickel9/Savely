import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { getUserPermissions, clearPermissionsCache, parsePermissions } from '@/lib/permissions';
import { Permissions } from '@/lib/types';

const PERMISSIONS_STORAGE_KEY = 'savely_permissions';

export function usePermissions() {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<Permissions | null>(() => {
    // Cache iniziale dal localStorage: parsePermissions valida che ogni campo
    // sia effettivamente booleano (valori manipolati/non validi → false).
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(PERMISSIONS_STORAGE_KEY);
      if (stored) {
        try {
          return parsePermissions(JSON.parse(stored));
        } catch {
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