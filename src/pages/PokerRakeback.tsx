import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Plus, RefreshCw, TrendingUp } from 'lucide-react';

interface RakebackEntry {
  id: string;
  user_id: string;
  date: string;
  rake_generated: number;
  rakeback_received: number;
  rakeback_percentage: number;
  created_at: string;
  updated_at: string;
}

export default function PokerRakeback() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [entries, setEntries] = useState<RakebackEntry[]>([]);
  const [newDate, setNewDate] = useState('');
  const [newRakeGenerated, setNewRakeGenerated] = useState('');
  const [newRakebackReceived, setNewRakebackReceived] = useState('');
  const [newRakebackPercentage, setNewRakebackPercentage] = useState('30');
  
  const [loading, setLoading] = useState(true);

  // Carica i dati
  const loadData = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('poker_rakeback' as any)
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });
      
      if (error) throw error;
      
      setEntries((data as unknown as RakebackEntry[]) || []);
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

  // Calcola il totale del rake generato
  const totalRakeGenerated = entries.reduce((sum, e) => sum + e.rake_generated, 0);

  // Calcola il totale del rakeback ricevuto
  const totalRakebackReceived = entries.reduce((sum, e) => sum + e.rakeback_received, 0);

  // Calcola la percentuale media di rakeback
  const averageRakebackPercentage = entries.length > 0
    ? entries.reduce((sum, e) => sum + e.rakeback_percentage, 0) / entries.length
    : 0;

  // Aggiungi entry rakeback
  const addEntry = async () => {
    if (!newDate || !newRakeGenerated || !newRakebackReceived) return;
    
    const rakeGenerated = parseFloat(newRakeGenerated);
    const rakebackReceived = parseFloat(newRakebackReceived);
    const rakebackPercentage = parseFloat(newRakebackPercentage);
    
    try {
      const { error } = await supabase
        .from('poker_rakeback' as any)
        .insert({
          user_id: user!.id,
          date: newDate,
          rake_generated: rakeGenerated,
          rakeback_received: rakebackReceived,
          rakeback_percentage: rakebackPercentage,
        });
      
      if (error) throw error;
      
      setNewDate('');
      setNewRakeGenerated('');
      setNewRakebackReceived('');
      toast({ title: 'Rakeback aggiunto' });
      await loadData();
    } catch (error) {
      console.error('Errore:', error);
      toast({ title: 'Errore', variant: 'destructive' });
    }
  };

  // Elimina entry rakeback
  const deleteEntry = async (id: string) => {
    try {
      const { error } = await supabase
        .from('poker_rakeback' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast({ title: 'Rakeback eliminato' });
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
          <h1 className="text-3xl font-display font-bold">Rake Back</h1>
          <p className="text-muted-foreground">Traccia il tuo rakeback</p>
        </div>

        {/* Statistiche */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Rake Totale Generato
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                <p className="text-2xl font-bold">€{totalRakeGenerated.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Rakeback Totale Ricevuto
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">€{totalRakebackReceived.toFixed(2)}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Percentuale Media Rakeback
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{averageRakebackPercentage.toFixed(1)}%</p>
            </CardContent>
          </Card>
        </div>

        {/* Aggiungi Rakeback */}
        <Card>
          <CardHeader>
            <CardTitle>Nuovo Rakeback</CardTitle>
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
                <label className="text-sm font-medium mb-2 block">Rake Generato (€)</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Es. 100.00"
                  value={newRakeGenerated}
                  onChange={(e) => setNewRakeGenerated(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Rakeback Ricevuto (€)</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Es. 30.00"
                  value={newRakebackReceived}
                  onChange={(e) => setNewRakebackReceived(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Percentuale Rakeback (%)</label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="Es. 30"
                  value={newRakebackPercentage}
                  onChange={(e) => setNewRakebackPercentage(e.target.value)}
                />
              </div>
              <Button onClick={addEntry} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Aggiungi
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lista Rakeback */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Storico Rakeback</CardTitle>
              <Button variant="outline" size="sm" onClick={loadData}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Aggiorna
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {entries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nessun rakeback registrato
              </div>
            ) : (
              <div className="space-y-3">
                {entries.map((entry) => (
                  <div key={entry.id} className="p-4 bg-secondary/20 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <TrendingUp className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">
                            {new Date(entry.date).toLocaleDateString('it-IT', {
                              day: '2-digit',
                              month: 'long',
                              year: 'numeric'
                            })}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Rake: </span>
                            <span className="font-medium">€{entry.rake_generated.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Rakeback: </span>
                            <span className="font-medium text-green-600">€{entry.rakeback_received.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Percentuale: </span>
                            <span className="font-medium">{entry.rakeback_percentage.toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteEntry(entry.id)}
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