import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Plus, RefreshCw, Clock } from 'lucide-react';

interface HourlyEarning {
  id: string;
  user_id: string;
  date: string;
  hours_played: number;
  profit_loss: number;
  hourly_rate: number;
  created_at: string;
  updated_at: string;
}

export default function PokerHourlyEarnings() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [earnings, setEarnings] = useState<HourlyEarning[]>([]);
  const [newDate, setNewDate] = useState('');
  const [newHours, setNewHours] = useState('');
  const [newProfitLoss, setNewProfitLoss] = useState('');
  
  const [loading, setLoading] = useState(true);

  // Carica i dati
  const loadData = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('poker_hourly_earnings' as any)
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });
      
      if (error) throw error;
      
      setEarnings((data as unknown as HourlyEarning[]) || []);
    } catch (error) {
      console.error('Errore nel caricamento dei dati:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile caricare i dati',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id]);

  // Calcola il guadagno orario medio
  const averageHourlyRate = earnings.length > 0
    ? earnings.reduce((sum, e) => sum + e.hourly_rate, 0) / earnings.length
    : 0;

  // Calcola il totale delle ore giocate
  const totalHours = earnings.reduce((sum, e) => sum + e.hours_played, 0);

  // Calcola il totale del profit/loss
  const totalProfitLoss = earnings.reduce((sum, e) => sum + e.profit_loss, 0);

  // Aggiungi guadagno orario
  const addEarning = async () => {
    if (!newDate || !newHours || !newProfitLoss) return;
    
    const hours = parseFloat(newHours);
    const profitLoss = parseFloat(newProfitLoss);
    const hourlyRate = hours > 0 ? profitLoss / hours : 0;
    
    try {
      const { error } = await supabase
        .from('poker_hourly_earnings' as any)
        .insert({
          user_id: user!.id,
          date: newDate,
          hours_played: hours,
          profit_loss: profitLoss,
          hourly_rate: hourlyRate,
        });
      
      if (error) throw error;
      
      setNewDate('');
      setNewHours('');
      setNewProfitLoss('');
      toast({ title: 'Guadagno orario aggiunto' });
      await loadData();
    } catch (error) {
      console.error('Errore:', error);
      toast({ title: 'Errore', variant: 'destructive' });
    }
  };

  // Elimina guadagno orario
  const deleteEarning = async (id: string) => {
    try {
      const { error } = await supabase
        .from('poker_hourly_earnings' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast({ title: 'Guadagno orario eliminato' });
      await loadData();
    } catch (error) {
      console.error('Errore:', error);
      toast({ title: 'Errore', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Guadagno Orario</h1>
          <p className="text-muted-foreground">Traccia il tuo guadagno orario al poker</p>
        </div>

        {/* Statistiche */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Guadagno Orario Medio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                <p className="text-2xl font-bold">€{averageHourlyRate.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Ore Totali Giocate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{totalHours.toFixed(1)}h</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Profit/Loss Totale
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${totalProfitLoss >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                €{totalProfitLoss.toFixed(2)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Aggiungi Guadagno Orario */}
        <Card>
          <CardHeader>
            <CardTitle>Nuovo Guadagno Orario</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Data</label>
                <Input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Ore Giocate</label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="Es. 4.5"
                  value={newHours}
                  onChange={(e) => setNewHours(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Profit/Loss</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Es. 250.00"
                  value={newProfitLoss}
                  onChange={(e) => setNewProfitLoss(e.target.value)}
                />
              </div>
              <Button onClick={addEarning} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Aggiungi
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lista Guadagni Orari */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Storico Guadagni Orari</CardTitle>
              <Button variant="outline" size="sm" onClick={loadData}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Aggiorna
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {earnings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nessun guadagno orario registrato
              </div>
            ) : (
              <div className="space-y-3">
                {earnings.map((earning) => (
                  <div key={earning.id} className="p-4 bg-secondary/20 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">
                            {new Date(earning.date).toLocaleDateString('it-IT', {
                              day: '2-digit',
                              month: 'long',
                              year: 'numeric'
                            })}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Ore: </span>
                            <span className="font-medium">{earning.hours_played.toFixed(1)}h</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">P/L: </span>
                            <span className={`font-medium ${earning.profit_loss >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                              €{earning.profit_loss.toFixed(2)}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Orario: </span>
                            <span className={`font-medium ${earning.hourly_rate >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                              €{earning.hourly_rate.toFixed(2)}/h
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteEarning(earning.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}