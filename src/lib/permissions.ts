import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { Permissions, UserPermissions } from './types';

/**
 * Cache per i permessi utente
 */
const permissionsCache = new Map<string, { data: Permissions; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minuti

/**
 * Recupera i permessi di un utente dal database
 * @param userId ID dell'utente
 * @returns Permessi dell'utente
 */
export async function getUserPermissions(userId: string): Promise<Permissions> {
  // Verifica cache
  const cached = permissionsCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('permissions')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      // Se non ci sono permessi, restituisci i permessi di default
      const defaultPermissions = getDefaultPermissions();
      permissionsCache.set(userId, { data: defaultPermissions, timestamp: Date.now() });
      return defaultPermissions;
    }

    const permissions = parsePermissions((data as { permissions?: unknown }).permissions);

    // Salva in cache
    permissionsCache.set(userId, { data: permissions, timestamp: Date.now() });
    
    return permissions;
  } catch (error) {
    console.error('Errore nel recupero dei permessi:', error);
    const defaultPermissions = getDefaultPermissions();
    permissionsCache.set(userId, { data: defaultPermissions, timestamp: Date.now() });
    return defaultPermissions;
  }
}

/**
 * Pulisce la cache dei permessi per un utente specifico
 * @param userId ID dell'utente
 */
export function clearPermissionsCache(userId: string): void {
  permissionsCache.delete(userId);
}

/**
 * Pulisce tutta la cache dei permessi
 */
export function clearAllPermissionsCache(): void {
  permissionsCache.clear();
}

/**
 * Restituisce i permessi di default per un nuovo utente
 * @returns Permessi di default
 */
export function getDefaultPermissions(): Permissions {
  return {
    admin: false,
    poker: false,
    fumo: false,
    fire: false,
    tcg: false,
    libreria: false,
    couple_expenses: false,
  };
}

/**
 * Converte un valore JSON arbitrario (campo `permissions` del profilo o
 * localStorage) in Permissions tipizzate, verificando che ogni campo sia
 * effettivamente booleano. Campi mancanti o non booleani assumono false.
 */
export function parsePermissions(value: unknown): Permissions {
  const result = getDefaultPermissions();
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return result;
  }
  const raw = value as Record<string, unknown>;
  for (const key of Object.keys(result) as Array<keyof Permissions>) {
    if (typeof raw[key] === 'boolean') {
      result[key] = raw[key];
    }
  }
  return result;
}

/**
 * Aggiorna i permessi di un utente
 * @param userId ID dell'utente
 * @param permissions Permessi da aggiornare (parziali)
 * @returns Oggetto con eventuale errore
 */
export async function updateUserPermissions(
  userId: string,
  permissions: Partial<Permissions>
): Promise<{ error: Error | null }> {
  try {
    // Prima recupera i permessi attuali
    const { data: currentData, error: fetchError } = await supabase
      .from('profiles')
      .select('permissions')
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      return { error: fetchError as Error };
    }

    // Unisci i permessi esistenti con quelli nuovi
    const currentPermissions = ((currentData as { permissions?: unknown })?.permissions as Permissions) || getDefaultPermissions();
    const updatedPermissions: Permissions = {
      ...currentPermissions,
      ...permissions,
    };

    // Aggiorna i permessi nel database
    const { error } = await supabase
      .from('profiles')
      // Json richiede un'index signature: Permissions è un'interfaccia,
      // il cast a Record la rende strutturalmente compatibile.
      .update({ permissions: updatedPermissions as unknown as Record<string, boolean> })
      .eq('user_id', userId);

    // Pulisci la cache per questo utente
    if (!error) {
      clearPermissionsCache(userId);
    }

    return { error: error as Error | null };
  } catch (error) {
    return { error: error as Error };
  }
}

/**
 * Verifica se un utente ha un permesso specifico
 * @param permissions Permessi dell'utente
 * @param permission Chiave del permesso da verificare
 * @returns true se l'utente ha il permesso
 */
export function hasPermission(
  permissions: Permissions,
  permission: keyof Permissions
): boolean {
  return permissions[permission] === true;
}

/**
 * Verifica se un utente è admin
 * @param permissions Permessi dell'utente
 * @returns true se l'utente è admin
 */
export function isAdmin(permissions: Permissions): boolean {
  return permissions.admin === true;
}

/** Risultato di getAllUsersWithPermissions. */
export interface AllUsersPermissionsResult {
  data: Array<{
    id: string;
    user_id: string;
    full_name: string | null;
    permissions: Json | null;
  }> | null;
  error: Error | null;
}

/**
 * Recupera tutti gli utenti con i loro permessi (solo per admin)
 * @param requestUserId ID dell'utente che effettua la richiesta
 * @returns Oggetto con dati o errore
 */
export async function getAllUsersWithPermissions(
  requestUserId: string
): Promise<AllUsersPermissionsResult> {
  try {
    // Verifica che l'utente sia admin
    const permissions = await getUserPermissions(requestUserId);
    if (!isAdmin(permissions)) {
      return {
        data: null,
        error: new Error('Unauthorized: Admin permissions required')
      };
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, user_id, full_name, permissions')
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error: error as Error };
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

/**
 * @deprecated Usare Permissions invece
 */
export type UserPermissionsDeprecated = UserPermissions;