/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase generated types do not include the poker_rakeback table */
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Plus, Edit, Save, X, ArrowLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSupabaseData } from '@/hooks/useSupabaseData';
import { useYearlyData } from '@/hooks/useYearlyData';
import { useDialogManager } from '@/hooks/useDialogManager';
import { parseAmount } from '@/lib/utils';
import { DataTable, Column } from '@/components/ui/data-table';

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
  
  const { data: entries, loading, reload } = useSupabaseData<RakebackEntry>({
    tableName: 'poker_rakeback',
    orderBy: 'date',
    ascending: false
  });

  const [newMonth, setNewMonth] = useState('');
  const [newRakeGenerated, setNewRakeGenerated] = useState('');
  const [newRakebackReceived, setNewRakebackReceived] = useState('');
  
  const [editRakeGenerated, setEditRakeGenerated] = useState('');
  const [editRakebackReceived, setEditRakebackReceived] = useState('');
  const { open: editOpen, editingItem, openEdit, close: closeEdit } = useDialogManager<RakebackEntry>();


  // Calcola il totale del rake generato
  const totalRakeGenerated = entries.reduce((sum, e) => sum + e.rake_generated, 0);

  // Calcola il totale del rakeback ricevuto
  const totalRakebackReceived = entries.reduce((sum, e) => sum + e.rakeback_received, 0);

  // Calcola la percentuale media di rakeback
  const averageRakebackPercentage = entries.length > 0 && totalRakeGenerated > 0
    ? (totalRakebackReceived / totalRakeGenerated) * 100
    : 0;

  // Raggruppa i dati per anno
  const additionalFields = useMemo(() => ({
    totalRakeback: (group: RakebackEntry[]) => group.reduce((sum, e) => sum + e.rakeback_received, 0)
  }), []);
  
  const yearlyData = useYearlyData({
    items: entries,
    getDate: (entry) => entry.date,
    getValue: (entry) => entry.rake_generated,
    additionalFields
  }).map(stat => ({
    year: stat.year,
    totalRake: stat.total,
    totalRakeback: stat.totalRakeback as number,
    averagePercentage: stat.total > 0 ? ((stat.totalRakeback as number) / stat.total) * 100 : 0
  }));

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
    
    const rakeGenerated = parseAmount(newRakeGenerated);
    const rakebackReceived = parseAmount(newRakebackReceived);
    
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
      await reload();
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
      await reload();
    } catch (error) {
      console.error('Errore:', error);
      toast({ title: 'Errore', variant: 'destructive' });
    }
  };

  const startEdit = (entry: RakebackEntry) => {
    setEditRakeGenerated(entry.rake_generated.toString());
    setEditRakebackReceived(entry.rakeback_received.toString());
    openEdit(entry);
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
    
    const rakeGenerated = parseAmount(editRakeGenerated);
    const rakebackReceived = parseAmount(editRakebackReceived);
    
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
      closeEdit();
      await reload();
    } catch (error) {
      console.error('Errore:', error);
      toast({ title: 'Errore', variant: 'destructive' });
    }
  };


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
            <p className="text-muted-foreground">Traccia la tua rakeback</p>
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
            <CardTitle>Rakeback per mese nel {currentYear}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {entries.filter(e => new Date(e.date).getFullYear() === currentYear).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nessun rakeback registrato
              </div>
            ) : (
              <DataTable<RakebackEntry>
                columns={[
                  {
                    key: 'date',
                    header: 'Mese',
                    render: (entry) => new Date(entry.date).toLocaleDateString('it-IT', {
                      month: 'long',
                      year: 'numeric'
                    }),
                    className: 'font-medium'
                  },
                  {
                    key: 'rake_generated',
                    header: 'Rake',
                    render: (entry) => `€${entry.rake_generated.toFixed(2)}`,
                    className: 'text-right'
                  },
                  {
                    key: 'rakeback_received',
                    header: 'Rake Back',
                    render: (entry: RakebackEntry) => (
                      <span className={`text-right font-medium ${entry.rakeback_received >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        €{entry.rakeback_received.toFixed(2)}
                      </span>
                    ),
                    className: 'text-right'
                  },
                  {
                    key: 'percentage',
                    header: 'Percentuale',
                    render: (entry: RakebackEntry) => entry.rake_generated > 0 ? ((entry.rakeback_received / entry.rake_generated) * 100).toFixed(1) + '%' : '0%',
                    className: 'text-right'
                  },
                  {
                    key: 'actions',
                    header: '',
                    render: (entry) => (
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
                    ),
                    className: 'text-center'
                  }
                ]}
                data={entries.filter(e => new Date(e.date).getFullYear() === currentYear)}
                loading={loading}
                emptyMessage="Nessun rakeback registrato"
              />
            )}
          </CardContent>
        </Card>

        {/* Tabella Rakeback per Anno */}
        <Card>
          <CardHeader>
            <CardTitle>Rakeback per anno</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {yearlyData.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nessun rakeback registrato
              </div>
            ) : (
              <DataTable<YearlyData>
                columns={[
                  {
                    key: 'year',
                    header: 'Anno',
                    render: (data) => data.year,
                    className: 'font-medium'
                  },
                  {
                    key: 'totalRake',
                    header: 'Rake Totale',
                    render: (data) => `€${data.totalRake.toFixed(2)}`,
                    className: 'text-right'
                  },
                  {
                    key: 'totalRakeback',
                    header: 'Rakeback Totale',
                    render: (data: YearlyData) => (
                      <span className={`text-right font-medium ${data.totalRakeback >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        €{data.totalRakeback.toFixed(2)}
                      </span>
                    ),
                    className: 'text-right'
                  },
                  {
                    key: 'averagePercentage',
                    header: 'Percentuale Media',
                    render: (data: YearlyData) => `${data.averagePercentage.toFixed(1)}%`,
                    className: 'text-right'
                  }
                ]}
                data={yearlyData}
                loading={loading}
                emptyMessage="Nessun rakeback registrato"
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog Modifica Rakeback */}
      <Dialog open={editOpen} onOpenChange={closeEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifica Rakeback</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Mese</label>
                <Input
                  type="text"
                  value={new Date(editingItem.date).toLocaleDateString('it-IT', {
                    month: 'long',
                    year: 'numeric'
                  })}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Rake (€)</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Es. 100.00"
                  value={editRakeGenerated}
                  onChange={(e) => setEditRakeGenerated(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Rake Back (€)</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Es. 30.00"
                  value={editRakebackReceived}
                  onChange={(e) => setEditRakebackReceived(e.target.value)}
                />
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <Button variant="outline" onClick={closeEdit}>
                  <X className="w-4 h-4 mr-2" />
                  Annulla
                </Button>
                <Button onClick={() => saveEdit(editingItem.id)} className="bg-green-500 hover:bg-green-600">
                  <Save className="w-4 h-4 mr-2" />
                  Salva
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}