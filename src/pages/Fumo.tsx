import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, Droplets, Leaf, Flame } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { Navigate } from 'react-router-dom';

export default function Fumo() {
  const { permissions, loading } = usePermissions();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Caricamento...</div>
      </div>
    );
  }

  // Verifica se l'utente ha il permesso fumo
  if (!permissions?.fumo) {
    return <Navigate to="/" replace />;
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Fumo</h1>
          <p className="text-muted-foreground">Gestisci le spese per fumo e prodotti correlati</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Liquido Sigaretta */}
          <Link to="/fumo/liquido-sigaretta" className="group">
            <Card className="h-full transition-all duration-200 hover:shadow-lg hover:scale-105 cursor-pointer">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Droplets className="w-5 h-5 text-primary" />
                    Liquido Sigaretta
                  </CardTitle>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Traccia le spese per liquidi e sigarette elettroniche
                </p>
              </CardContent>
            </Card>
          </Link>

          {/* CBD */}
          <Link to="/fumo/cbd" className="group">
            <Card className="h-full transition-all duration-200 hover:shadow-lg hover:scale-105 cursor-pointer">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Leaf className="w-5 h-5 text-primary" />
                    CBD
                  </CardTitle>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Gestisci le spese per prodotti CBD e derivati
                </p>
              </CardContent>
            </Card>
          </Link>

          {/* THC */}
          <Link to="/fumo/thc" className="group">
            <Card className="h-full transition-all duration-200 hover:shadow-lg hover:scale-105 cursor-pointer">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Flame className="w-5 h-5 text-primary" />
                    THC
                  </CardTitle>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Traccia le spese per prodotti THC e derivati
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </MainLayout>
  );
}