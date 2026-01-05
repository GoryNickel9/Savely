import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Shield, User as UserIcon, RefreshCw } from 'lucide-react';
import { UserPermissions } from '@/lib/types';
import { updateUserPermissions, getAllUsersWithPermissions } from '@/lib/permissions';

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  permissions: Record<string, boolean>;
}

interface PermissionsManagerProps {
  currentUserId: string;
}

export default function PermissionsManager({ currentUserId }: PermissionsManagerProps) {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await getAllUsersWithPermissions();
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Errore nel caricamento degli utenti:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile caricare gli utenti',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handlePermissionToggle = async (
    userId: string,
    permission: keyof UserPermissions,
    currentValue: boolean
  ) => {
    setUpdating(userId);
    try {
      const { error } = await updateUserPermissions(userId, {
        [permission]: !currentValue,
      });

      if (error) throw error;

      toast({
        title: 'Permesso aggiornato',
        description: `Il permesso ${permission} è stato aggiornato`,
      });

      // Ricarica gli utenti
      await loadUsers();
    } catch (error) {
      console.error('Errore nell\'aggiornamento del permesso:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile aggiornare il permesso',
        variant: 'destructive',
      });
    } finally {
      setUpdating(null);
    }
  };

  const permissionLabels: { [K in keyof UserPermissions]?: string } = {
    poker: 'Poker',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          <h3 className="font-medium">Gestione Permessi Utenti</h3>
        </div>
        <Button variant="outline" size="sm" onClick={loadUsers}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Aggiorna
        </Button>
      </div>

      <div className="space-y-4">
        {users.map((user) => (
          <div key={user.id} className="glass rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium">
                {user.full_name?.charAt(0).toUpperCase() || user.user_id.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="font-medium">
                  {user.full_name || 'Utente senza nome'}
                  {user.user_id === currentUserId && (
                    <span className="ml-2 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                      Tu
                    </span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">{user.user_id}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
              {(Object.keys(permissionLabels) as Array<keyof UserPermissions>).filter(key => permissionLabels[key]).map((permission) => (
                <div key={permission} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{permissionLabels[permission]}</span>
                  <Switch
                    checked={user.permissions[permission] || false}
                    onCheckedChange={() =>
                      handlePermissionToggle(user.user_id, permission, user.permissions[permission] || false)
                    }
                    disabled={updating === user.user_id}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}