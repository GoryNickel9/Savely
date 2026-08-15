import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, KeyRound, Trash2, UserPlus } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { getAllUsersWithPermissions, updateUserPermissions } from '@/lib/permissions';
import { useToast } from '@/hooks/use-toast';

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  permissions: Record<string, boolean>;
}

interface AdminUser {
  user_id: string;
  email: string | null;
  full_name: string | null;
  permissions: Record<string, boolean>;
  created_at: string;
  last_sign_in_at: string | null;
}

export default function Admin() {
  const { user } = useAuth();
  const { permissions } = usePermissions();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  // Tab "Altre Opzioni"
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [optionsLoaded, setOptionsLoaded] = useState(false);
  const [registrationsEnabled, setRegistrationsEnabled] = useState<boolean | null>(null);
  const [updatingRegistrations, setUpdatingRegistrations] = useState(false);
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

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
        title: t('Errore'),
        description: t('Impossibile caricare gli utenti'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast, t, user?.id]);

  useEffect(() => {
    // Carica gli utenti solo quando l'utente è autenticato e ha i permessi admin
    // (permesso garantito a livello di rotta da <PermissionRoute perm="admin">)
    if (user?.id && permissions?.admin) {
      loadUsers();
    }
  }, [loadUsers, user?.id, permissions?.admin]);

  const loadAdminUsers = useCallback(async () => {
    setAdminUsersLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sessione non valida');

      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: 'get-users' }),
      });
      if (!res.ok) throw new Error(`Richiesta fallita (${res.status})`);
      const data = (await res.json()) as { users: AdminUser[] };
      setAdminUsers(data.users || []);
    } catch (error) {
      console.error('Errore nel caricamento degli utenti:', error);
      toast({
        title: t('Errore'),
        description: t('Impossibile caricare gli utenti'),
        variant: 'destructive',
      });
    } finally {
      setAdminUsersLoading(false);
    }
  }, [toast, t]);

  const loadRegistrationsEnabled = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_registrations_enabled');
    if (error) {
      console.error('Errore nel caricamento delle registrazioni:', error);
      return;
    }
    setRegistrationsEnabled(data === true);
  }, []);

  const handleTabChange = (value: string) => {
    // Carica i dati della tab "Altre Opzioni" solo al primo accesso
    if (value === 'options' && !optionsLoaded && user?.id && permissions?.admin) {
      setOptionsLoaded(true);
      loadAdminUsers();
      loadRegistrationsEnabled();
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadUsers();
    if (optionsLoaded) {
      await loadAdminUsers();
    }
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
        title: t('Permesso aggiornato'),
        description: t('Il permesso {{permission}} è stato aggiornato', { permission }),
      });

      // Ricarica gli utenti
      await loadUsers();
    } catch (error) {
      console.error('Errore nell\'aggiornamento del permesso:', error);
      toast({
        title: t('Errore'),
        description: t('Impossibile aggiornare il permesso'),
        variant: 'destructive',
      });
    } finally {
      setUpdating(null);
    }
  };

  const toggleRegistrations = async (enabled: boolean) => {
    setUpdatingRegistrations(true);
    try {
      const { error } = await supabase.rpc('set_registrations_enabled', {
        p_enabled: enabled,
      });
      if (error) throw error;

      setRegistrationsEnabled(enabled);
      toast({
        title: t('Impostazione aggiornata'),
        description: enabled
          ? t('Le nuove registrazioni sono state abilitate')
          : t('Le nuove registrazioni sono state disabilitate'),
      });
    } catch (error) {
      console.error('Errore nell\'aggiornamento delle registrazioni:', error);
      toast({
        title: t('Errore'),
        description: t('Impossibile aggiornare l\'impostazione'),
        variant: 'destructive',
      });
    } finally {
      setUpdatingRegistrations(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget?.email) return;
    setResettingUserId(resetTarget.user_id);
    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetTarget.email }),
      });
      if (!res.ok) throw new Error(`Richiesta fallita (${res.status})`);

      toast({
        title: t('Email inviata'),
        description: t('Email di reset password inviata a {{email}}', { email: resetTarget.email }),
      });
      setResetTarget(null);
    } catch (error) {
      console.error('Errore nell\'invio del reset password:', error);
      toast({
        title: t('Errore'),
        description: t('Impossibile inviare l\'email di reset'),
        variant: 'destructive',
      });
    } finally {
      setResettingUserId(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    setDeletingUserId(deleteTarget.user_id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sessione non valida');

      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: 'delete-user', userId: deleteTarget.user_id }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || `Richiesta fallita (${res.status})`);
      }

      toast({
        title: t('Utente eliminato'),
        description: t("L'utente {{name}} è stato eliminato definitivamente", {
          name: deleteTarget.full_name || deleteTarget.email || deleteTarget.user_id,
        }),
      });
      setDeleteTarget(null);
      await Promise.all([loadUsers(), loadAdminUsers()]);
    } catch (error) {
      console.error('Errore nell\'eliminazione dell\'utente:', error);
      toast({
        title: t('Errore'),
        description: error instanceof Error && error.message
          ? error.message
          : t('Impossibile eliminare l\'utente'),
        variant: 'destructive',
      });
    } finally {
      setDeletingUserId(null);
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
          <h1 className="text-3xl font-display font-bold">{t('Amministrazione')}</h1>
          <p className="text-muted-foreground">{t('Gestisci i permessi degli utenti')}</p>
        </div>

        <Tabs defaultValue="permissions" onValueChange={handleTabChange}>
          <TabsList className="mb-4">
            <TabsTrigger value="permissions">{t('Gestione Permessi Utenti')}</TabsTrigger>
            <TabsTrigger value="options">{t('Altre Opzioni')}</TabsTrigger>
          </TabsList>

          {/* Tab: Gestione Permessi Utenti */}
          <TabsContent value="permissions">
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
                    <h2 className="text-xl font-semibold">{t('Gestione Permessi Utenti')}</h2>
                  </div>

                  <Button
                    onClick={handleRefresh}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span className="text-sm">{t('Aggiorna')}</span>
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
                            <span className="font-medium">{userProfile.full_name || t('Utente senza nome')}</span>
                            {userProfile.user_id === user.id && (
                              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-md">
                                {t('Tu')}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">{userProfile.user_id}</div>

                          {/* Pulsanti permessi */}
                          <div className="flex items-center gap-8 pt-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground w-16">{t('Poker')}</span>
                              <Switch
                                checked={userProfile.permissions.poker || false}
                                onCheckedChange={() => togglePermission(userProfile.user_id, 'poker', userProfile.permissions.poker || false)}
                                disabled={updating === userProfile.user_id}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground w-16">{t('Fumo')}</span>
                              <Switch
                                checked={userProfile.permissions.fumo || false}
                                onCheckedChange={() => togglePermission(userProfile.user_id, 'fumo', userProfile.permissions.fumo || false)}
                                disabled={updating === userProfile.user_id}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground w-16">{t('FIRE')}</span>
                              <Switch
                                checked={userProfile.permissions.fire || false}
                                onCheckedChange={() => togglePermission(userProfile.user_id, 'fire', userProfile.permissions.fire || false)}
                                disabled={updating === userProfile.user_id}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground w-16">{t('TCG')}</span>
                              <Switch
                                checked={userProfile.permissions.tcg || false}
                                onCheckedChange={() => togglePermission(userProfile.user_id, 'tcg', userProfile.permissions.tcg || false)}
                                disabled={updating === userProfile.user_id}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground w-24">{t('Libreria')}</span>
                              <Switch
                                checked={userProfile.permissions.libreria || false}
                                onCheckedChange={() => togglePermission(userProfile.user_id, 'libreria', userProfile.permissions.libreria || false)}
                                disabled={updating === userProfile.user_id}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground w-24">{t('Spese Familiari')}</span>
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
          </TabsContent>

          {/* Tab: Altre Opzioni */}
          <TabsContent value="options" className="space-y-6">
            {/* Toggle registrazioni */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                      <UserPlus className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold">{t('Registrazioni')}</h2>
                      <p className="text-sm text-muted-foreground">
                        {t('Consenti ai nuovi utenti di registrarsi')}
                      </p>
                    </div>
                  </div>
                  {registrationsEnabled !== null && (
                    <Switch
                      checked={registrationsEnabled}
                      onCheckedChange={toggleRegistrations}
                      disabled={updatingRegistrations}
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Gestione utenti: reset password ed eliminazione */}
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex items-center justify-between p-6 border-b">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                    <h2 className="text-xl font-semibold">{t('Gestione Utenti')}</h2>
                  </div>

                  <Button
                    onClick={() => loadAdminUsers()}
                    variant="outline"
                    className="flex items-center gap-2"
                    disabled={adminUsersLoading}
                  >
                    <RefreshCw className={`w-4 h-4 ${adminUsersLoading ? 'animate-spin' : ''}`} />
                    <span className="text-sm">{t('Aggiorna')}</span>
                  </Button>
                </div>

                {adminUsersLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <div className="divide-y">
                    {adminUsers.map((adminUser) => (
                      <div key={adminUser.user_id} className="p-6 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                              <span className="text-sm font-medium text-emerald-400">
                                {adminUser.full_name?.charAt(0) || adminUser.email?.charAt(0) || '?'}
                              </span>
                            </div>
                            <div className="min-w-0 space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-medium truncate">
                                  {adminUser.full_name || t('Utente senza nome')}
                                </span>
                                {adminUser.user_id === user.id && (
                                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-md flex-shrink-0">
                                    {t('Tu')}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {adminUser.email || t('Nessuna email')}
                              </div>
                              <div className="text-xs text-muted-foreground font-mono truncate">
                                {adminUser.user_id}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex items-center gap-2"
                              disabled={!adminUser.email || resettingUserId === adminUser.user_id}
                              onClick={() => setResetTarget(adminUser)}
                            >
                              <KeyRound className="w-4 h-4" />
                              <span className="text-sm hidden sm:inline">{t('Reset password')}</span>
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="flex items-center gap-2"
                              disabled={adminUser.user_id === user.id || deletingUserId === adminUser.user_id}
                              onClick={() => setDeleteTarget(adminUser)}
                            >
                              <Trash2 className="w-4 h-4" />
                              <span className="text-sm hidden sm:inline">{t('Elimina')}</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Dialog conferma reset password */}
        <Dialog open={resetTarget !== null} onOpenChange={(open) => !open && setResetTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('Reset password')}</DialogTitle>
              <DialogDescription>
                {resetTarget && (
                  <>
                    {t('Verrà inviata un\'email di reset password a {{email}}. L\'utente potrà scegliere una nuova password dal link nella email.', { email: resetTarget.email })}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setResetTarget(null)} disabled={resettingUserId !== null}>
                {t('Annulla')}
              </Button>
              <Button onClick={handleResetPassword} disabled={resettingUserId !== null}>
                {resettingUserId !== null ? t('Invio...') : t('Invia email')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* AlertDialog conferma eliminazione utente */}
        <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('Eliminare questo utente?')}</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTarget && (
                  <>
                    {t('Stai per eliminare definitivamente {{name}} ({{email}}). Verranno rimossi in modo permanente il suo account e tutti i dati associati. Questa azione è irreversibile.', {
                      name: deleteTarget.full_name || t('Utente senza nome'),
                      email: deleteTarget.email || deleteTarget.user_id,
                    })}
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletingUserId !== null}>{t('Annulla')}</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={(e) => {
                  e.preventDefault();
                  handleDeleteUser();
                }}
                disabled={deletingUserId !== null}
              >
                {deletingUserId !== null ? t('Eliminazione...') : t('Elimina definitivamente')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}
