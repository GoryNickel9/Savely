import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { Navigate } from 'react-router-dom';
import PermissionsManager from '@/components/settings/PermissionsManager';

export default function Admin() {
  const { user } = useAuth();
  const { permissions, loading } = usePermissions();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Caricamento...</div>
      </div>
    );
  }

  // Verifica se l'utente è admin
  if (!permissions?.admin) {
    return <Navigate to="/" replace />;
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Amministrazione</h1>
          <p className="text-muted-foreground">Gestisci i permessi degli utenti</p>
        </div>

        <div className="glass rounded-xl p-6">
          <PermissionsManager currentUserId={user?.id || ''} />
        </div>
      </div>
    </MainLayout>
  );
}