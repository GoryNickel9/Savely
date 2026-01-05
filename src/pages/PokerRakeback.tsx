import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Plus, Edit, Save, X, ArrowLeft } from 'lucide-react';

interface RakebackEntry {
  id: string;
  user_id: string;
  date: string;
  rake_generated: number;
  rakeback_received: number;
  created_at: string;
  updated_at: string;
}

interface YearlyData {
  year: string;
  totalRake: number;
  totalRakeback: number;
  averagePercentage: number;
}

export default function PokerRakeback() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const currentYear = new Date().getFullYear();
  
  const [entries, setEntries] = useState<RakebackEntry[]>([]);
  const [newMonth, setNewMonth] = useState('');
  const [newRakeGenerated, setNewRakeGenerated] = useState('');
  const [newRakebackReceived, setNewRakebackReceived] = useState('');
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRakeGenerated, setEditRakeGenerated] = useState('');
  const [editRakebackReceived, setEditRakebackReceived] = useState('');
  
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
  const averageRakebackPercentage = entries.length > 0 && totalRakeGenerated > 0
    ? (totalRakebackReceived / totalRakeGenerated) * 100
    : 0;

  // Raggruppa i dati per anno
  const yearlyData: YearlyData[] = entries.reduce((acc: YearlyData[], entry) => {
    const year = new Date(entry.date).getFullYear().toString();
    const existing = acc.find(item => item.year === year);
    
    if (existing) {
      existing.totalRake += entry.rake_generated;
      existing.totalRakeback += entry.rakeback_received;
      existing.averagePercentage = existing.totalRake > 0
        ? (existing.totalRakeback / existing.totalRake) * 100
        : 0;
    } else {
      acc.push({
        year,
        totalRake: entry.rake_generated,
        totalRakeback: entry.rakeback_received,
        averagePercentage: entry.rake_generated > 0
          ? (entry.rakeback_received / entry.rake_generated) * 100
          : 0
      });
    }
    
    return acc;
  }, []).sort((a, b) => b.year.localeCompare(a.year));

  // Aggiungi entry rakeback
  const addEntry = async () => {
    if (!newMonth || !newRakeGenerated || !newRakebackReceived) {
      toast({
        title: 'Attenzione',
        description: 'Compila tutti i campi',
        variant: 'destructive',
      });
      return;
    }
    
    const rakeGenerated = parseFloat(newRakeGenerated);
    const rakebackReceived = parseFloat(newRakebackReceived);
    
    // Converti MM/YYYY in data (primo giorno del mese)
    const [year, month] = newMonth.split('-');
    const date = `${year}-${month}-01`;
    
    try {
      // Verifica se esiste già un record per questo mese
      const { data: existingData, error: checkError } = await supabase
        .from('poker_rakeback' as any)
        .select('id')
        .eq('user_id', user!.id)
        .eq('date', date)
        .maybeSingle();
      
      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }
      
      if (existingData) {
        toast({
          title: 'Attenzione',
          description: 'Esiste già un rakeback per questo mese',
          variant: 'destructive',
        });
        return;
      }
      
      const { error } = await supabase
        .from('poker_rakeback' as any)
        .insert({
          user_id: user!.id,
          date: date,
          rake_generated: rakeGenerated,
          rakeback_received: rakebackReceived,
        });
      
      if (error) throw error;
      
      setNewMonth('');
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

  // Modifica entry rakeback
  const startEdit = (entry: RakebackEntry) => {
    setEditingId(entry.id);
    setEditRakeGenerated(entry.rake_generated.toString());
    setEditRakebackReceived(entry.rakeback_received.toString());
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditRakeGenerated('');
    setEditRakebackReceived('');
  };

  const saveEdit = async (id: string) => {
    if (!editRakeGenerated || !editRakebackReceived) {
      toast({
        title: 'Attenzione',
        description: 'Compila tutti i campi obbligatori',
        variant: 'destructive',
      });
      return;
    }
    
    const rakeGenerated = parseFloat(editRakeGenerated);
    const rakebackReceived = parseFloat(editRakebackReceived);
    
    try {
      const { error } = await supabase
        .from('poker_rakeback' as any)
        .update({
          rake_generated: rakeGenerated,
          rakeback_received: rakebackReceived,
        })
        .eq('id', id);
      
      if (error) throw error;
      
      toast({ title: 'Rakeback aggiornato' });
      cancelEdit();
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-4">
          <button
            onClick={() => window.history.back()}
            className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-colors border border-slate-700"
          >
            <ArrowLeft className="w-5 h-5 text-slate-300" />
          </button>
          <div>
            <h1 className="text-3xl font-display font-bold">Rake Back</h1>
            <p className="text-muted-foreground">Traccia il tuo rakeback</p>
          </div>
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
              <p className="text-2xl font-bold">€{totalRakeGenerated.toFixed(2)}</p>
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
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="text-sm font-medium mb-2 block">Mese</label>
                <Input
                  type="month"
                  value={newMonth}
                  onChange={(e) => setNewMonth(e.target.value)}
                  placeholder="MM/AAAA"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Rake (€)</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Es. 100.00"
                  value={newRakeGenerated}
                  onChange={(e) => setNewRakeGenerated(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Rake Back (€)</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Es. 30.00"
                  value={newRakebackReceived}
                  onChange={(e) => setNewRakebackReceived(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={addEntry} className="w-full mt-4 bg-green-500 hover:bg-green-600">
              <Plus className="w-4 h-4 mr-2" />
              Aggiungi
            </Button>
          </CardContent>
        </Card>

        {/* Tabella Rakeback per Mese */}
        <Card>
          <CardHeader>
            <CardTitle>Rakeback per Mese ({currentYear})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {entries.filter(e => new Date(e.date).getFullYear() === currentYear).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nessun rakeback registrato
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-sm">Mese</th>
                      <th className="text-right py-3 px-4 font-medium text-sm">Rake</th>
                      <th className="text-right py-3 px-4 font-medium text-sm">Rake Back</th>
                      <th className="text-right py-3 px-4 font-medium text-sm">Percentuale</th>
                      <th className="text-center py-3 px-4 font-medium text-sm"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.filter(e => new Date(e.date).getFullYear() === currentYear).map((entry, index) => (
                      <tr
                        key={entry.id}
                        className={`border-t ${index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}
                      >
                        <td className="py-3 px-4 font-medium">
                          {new Date(entry.date).toLocaleDateString('it-IT', {
                            month: 'long',
                            year: 'numeric'
                          })}
                        </td>
                        {editingId === entry.id ? (
                          <>
                            <td className="py-3 px-4">
                              <Input
                                type="number"
                                step="0.01"
                                value={editRakeGenerated}
                                onChange={(e) => setEditRakeGenerated(e.target.value)}
                                className="w-24 text-right"
                              />
                            </td>
                            <td className="py-3 px-4">
                              <Input
                                type="number"
                                step="0.01"
                                value={editRakebackReceived}
                                onChange={(e) => setEditRakebackReceived(e.target.value)}
                                className="w-24 text-right"
                              />
                            </td>
                            <td className="text-right py-3 px-4 text-muted-foreground">
                              {parseFloat(editRakebackReceived || '0') > 0 && parseFloat(editRakeGenerated || '0') > 0
                                ? ((parseFloat(editRakebackReceived) / parseFloat(editRakeGenerated)) * 100).toFixed(1) + '%'
                                : '0%'}
                            </td>
                            <td className="text-center py-3 px-4">
                              <div className="flex justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => saveEdit(entry.id)}
                                  className="h-8 w-8 text-green-500 hover:text-green-600"
                                >
                                  <Save className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={cancelEdit}
                                  className="h-8 w-8"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="text-right py-3 px-4 font-medium">
                              €{entry.rake_generated.toFixed(2)}
                            </td>
                            <td className={`text-right py-3 px-4 font-medium ${entry.rakeback_received >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              €{entry.rakeback_received.toFixed(2)}
                            </td>
                            <td className="text-right py-3 px-4 font-medium">
                              {entry.rake_generated > 0 ? ((entry.rakeback_received / entry.rake_generated) * 100).toFixed(1) + '%' : '0%'}
                            </td>
                            <td className="text-center py-3 px-4">
                              <div className="flex justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => startEdit(entry)}
                                  className="h-8 w-8"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => deleteEntry(entry.id)}
                                  className="h-8 w-8"
                                >
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabella Rakeback per Anno */}
        <Card>
          <CardHeader>
            <CardTitle>Rakeback per Anno</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {yearlyData.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nessun rakeback registrato
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-sm">Anno</th>
                      <th className="text-right py-3 px-4 font-medium text-sm">Rake Totale</th>
                      <th className="text-right py-3 px-4 font-medium text-sm">Rakeback Totale</th>
                      <th className="text-right py-3 px-4 font-medium text-sm">Percentuale Media</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearlyData.map((data, index) => (
                      <tr
                        key={data.year}
                        className={`border-t ${index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}
                      >
                        <td className="py-3 px-4 font-medium">
                          {data.year}
                        </td>
                        <td className="text-right py-3 px-4 font-medium">
                          €{data.totalRake.toFixed(2)}
                        </td>
                        <td className={`text-right py-3 px-4 font-medium ${data.totalRakeback >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          €{data.totalRakeback.toFixed(2)}
                        </td>
                        <td className="text-right py-3 px-4 font-medium">
                          {data.averagePercentage.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}