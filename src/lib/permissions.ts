import { supabase } from '@/integrations/supabase/client';
import { UserPermissions } from './types';

/**
 * Recupera i permessi di un utente dal database
 */
export async function getUserPermissions(userId: string): Promise<UserPermissions> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('permissions')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      // Se non ci sono permessi, restituisci i permessi di default
      return getDefaultPermissions();
    }

    const permissions = (data as any).permissions || {};
    return {
      admin: permissions.admin || false,
      poker: permissions.poker || false,
      fumo: permissions.fumo || false,
      statistics_deep_dive: permissions.statistics_deep_dive || false,
    };
  } catch (error) {
    console.error('Errore nel recupero dei permessi:', error);
    return getDefaultPermissions();
  }
}

/**
 * Restituisce i permessi di default per un nuovo utente
 */
export function getDefaultPermissions(): UserPermissions {
  return {
    admin: false,
    poker: false,
    fumo: false,
    statistics_deep_dive: false,
  };
}

/**
 * Aggiorna i permessi di un utente
 */
export async function updateUserPermissions(
  userId: string,
  permissions: Partial<UserPermissions>
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
    const currentPermissions = (currentData as any)?.permissions || {};
    const updatedPermissions = {
      ...currentPermissions,
      ...permissions,
    };

    // Aggiorna i permessi nel database
    const { error } = await supabase
      .from('profiles')
      .update({ permissions: updatedPermissions } as any)
      .eq('user_id', userId);

    return { error: error as Error | null };
  } catch (error) {
    return { error: error as Error };
  }
}

/**
 * Verifica se un utente ha un permesso specifico
 */
export function hasPermission(
  permissions: UserPermissions,
  permission: keyof UserPermissions
): boolean {
  return permissions[permission] === true;
}

/**
 * Verifica se un utente è admin
 */
export function isAdmin(permissions: UserPermissions): boolean {
  return permissions.admin === true;
}

/**
 * Recupera tutti gli utenti con i loro permessi (solo per admin)
 */
export async function getAllUsersWithPermissions() {
  try {
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