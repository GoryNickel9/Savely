import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { Navigate } from 'react-router-dom';
import { getAllUsersWithPermissions, updateUserPermissions } from '@/lib/permissions';
import { useToast } from '@/hooks/use-toast';

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  permissions: Record<string, boolean>;
}

export default function Admin() {
  const { user } = useAuth();
  const { permissions, loading: permissionsLoading } = usePermissions();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await getAllUsersWithPermissions(user.id);
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
  }, [toast, user?.id]);

  useEffect(() => {
    // Carica gli utenti solo quando l'utente è autenticato e ha i permessi admin
    if (user?.id && permissions?.admin) {
      loadUsers();
    }
  }, [loadUsers, user?.id, permissions?.admin]);

  if (permissionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Caricamento...</div>
      </div>
    );
  }

  // Verifica se l'utente ha il permesso admin
  if (!permissions?.admin) {
    return <Navigate to="/" replace />;
  }

  if (!user?.id) {
    return <Navigate to="/auth" replace />;
  }

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadUsers();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const togglePermission = async (userId: string, permission: string, currentValue: boolean) => {
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

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold">Amministrazione</h1>
          <p className="text-muted-foreground">Gestisci i permessi degli utenti</p>
        </div>

        {/* Card principale */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {/* Header della card */}
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold">Gestione Permessi Utenti</h2>
              </div>
              
              <Button
                onClick={handleRefresh}
                variant="outline"
                className="flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="text-sm">Aggiorna</span>
              </Button>
            </div>

            {/* Lista utenti */}
            <div className="divide-y">
              {users.map((userProfile) => (
                <div key={userProfile.id} className="p-6 hover:bg-muted/30 transition-colors">
                  {/* Spazio ridotto tra nome e pulsanti */}
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-medium text-emerald-400">
                        {userProfile.full_name?.charAt(0) || userProfile.user_id.charAt(0)}
                      </span>
                    </div>
                    
                    {/* Nome, ID e pulsanti */}
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{userProfile.full_name || 'Utente senza nome'}</span>
                        {userProfile.user_id === user.id && (
                          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-md">
                            Tu
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">{userProfile.user_id}</div>
                      
                      {/* Pulsanti permessi */}
                      <div className="flex items-center gap-8 pt-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground w-16">Poker</span>
                          <Switch
                            checked={userProfile.permissions.poker || false}
                            onCheckedChange={() => togglePermission(userProfile.user_id, 'poker', userProfile.permissions.poker || false)}
                            disabled={updating === userProfile.user_id}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground w-16">Fumo</span>
                          <Switch
                            checked={userProfile.permissions.fumo || false}
                            onCheckedChange={() => togglePermission(userProfile.user_id, 'fumo', userProfile.permissions.fumo || false)}
                            disabled={updating === userProfile.user_id}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground w-16">Statistiche</span>
                          <Switch
                            checked={userProfile.permissions.statistics_deep_dive || false}
                            onCheckedChange={() => togglePermission(userProfile.user_id, 'statistics_deep_dive', userProfile.permissions.statistics_deep_dive || false)}
                            disabled={updating === userProfile.user_id}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground w-16">FIRE</span>
                          <Switch
                            checked={userProfile.permissions.fire || false}
                            onCheckedChange={() => togglePermission(userProfile.user_id, 'fire', userProfile.permissions.fire || false)}
                            disabled={updating === userProfile.user_id}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground w-16">TCG</span>
                          <Switch
                            checked={userProfile.permissions.tcg || false}
                            onCheckedChange={() => togglePermission(userProfile.user_id, 'tcg', userProfile.permissions.tcg || false)}
                            disabled={updating === userProfile.user_id}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground w-16">Libreria</span>
                          <Switch
                            checked={userProfile.permissions.libreria || false}
                            onCheckedChange={() => togglePermission(userProfile.user_id, 'libreria', userProfile.permissions.libreria || false)}
                            disabled={updating === userProfile.user_id}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground w-24">Spese Coppia</span>
                          <Switch
                            checked={userProfile.permissions.couple_expenses || false}
                            onCheckedChange={() => togglePermission(userProfile.user_id, 'couple_expenses', userProfile.permissions.couple_expenses || false)}
                            disabled={updating === userProfile.user_id}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}