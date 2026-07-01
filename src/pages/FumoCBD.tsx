/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase generated types do not include the cbd table */
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CURRENCY_SYMBOLS } from '@/lib/constants';
import { Plus, Trash2, ArrowLeft, Edit2 } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { useSupabaseData } from '@/hooks/useSupabaseData';
import { useYearlyData } from '@/hooks/useYearlyData';
import { useDialogManager } from '@/hooks/useDialogManager';
import { calculateDerivedFields } from '@/lib/fumoCalculations';
import { DataTable, Column } from '@/components/ui/data-table';

interface CBDEntry {
  id: string;
  user_id: string;
  costo: number;
  marca: string | null;
  thc_content: number | null;
  grammi: number | null;
  descrizione: string | null;
  data_acquisto: string;
  data_finito: string | null;
  giorni_durata: number | null;
  grammi_al_giorno: number | null;
  euro_al_giorno: number | null;
  costo_mensile: number | null;
  created_at: string;
  updated_at: string;
}

export default function FumoCBD() {
  const { user } = useAuth();
  const { permissions, loading: permissionsLoading } = usePermissions();
  const { toast } = useToast();

  // All hooks must be called before any conditional return (Rules of Hooks)
  const { data: rawEntries, loading, reload } = useSupabaseData<CBDEntry>({
    tableName: 'cbd',
    orderBy: 'data_acquisto',
    ascending: false
  });

  // Create dialog state
  const [newCosto, setNewCosto] = useState('');
  const [newGrammi, setNewGrammi] = useState('');
  const [newDataArrivo, setNewDataArrivo] = useState(new Date().toISOString().split('T')[0]);
  const [newDataFinito, setNewDataFinito] = useState('');
  const [newMarca, setNewMarca] = useState('');
  const [newThcContent, setNewThcContent] = useState('');
  const [newDescrizione, setNewDescrizione] = useState('');
  const { open: createOpen, openCreate, close: closeCreate } = useDialogManager();

  // Edit dialog state
  const [editCosto, setEditCosto] = useState('');
  const [editGrammi, setEditGrammi] = useState('');
  const [editDataArrivo, setEditDataArrivo] = useState('');
  const [editDataFinito, setEditDataFinito] = useState('');
  const { open: editOpen, editingItem, openEdit, close: closeEdit } = useDialogManager<CBDEntry>();

  // Prepara additionalFields per useYearlyData (fuori dal JSX per evitare loop infinito)
  const additionalFields = useMemo(() => ({
    grammiTotali: (group: CBDEntry[]) => group.reduce((sum, e) => sum + (e.grammi || 0), 0)
  }), []);

  // Derived data (non-hook, must stay after useSupabaseData)
  const entries = rawEntries.map(entry => {
    if (entry.data_finito && entry.grammi && entry.giorni_durata === null) {
      const derived = calculateDerivedFields(
        entry.data_acquisto,
        entry.data_finito,
        entry.grammi,
        entry.costo
      );
      
      return {
        ...entry,
        giorni_durata: derived.giorni_durata,
        grammi_al_giorno: derived.quantita_al_giorno,
        euro_al_giorno: derived.euro_al_giorno,
        costo_mensile: derived.costo_mensile
      };
    }
    return entry;
  });

  // Calcola yearlyStats fuori dal JSX
  const yearlyStats = useYearlyData({
    items: entries,
    getDate: (entry) => entry.data_acquisto,
    getValue: (entry) => Number(entry.costo),
    additionalFields
  }).map(stat => ({
    anno: parseInt(stat.year),
    costoTotale: stat.total,
    grammiTotali: (stat.grammiTotali as number),
    costoAlGrammo: (stat.grammiTotali as number) > 0 ? stat.total / (stat.grammiTotali as number) : 0,
    costoMensile: stat.total / 12
  }));

  // Conditional returns after all hooks
  if (permissionsLoading) {
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

  const addNewRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCosto || !newDataArrivo) return;
    
    try {
      const campi = calculateDerivedFields(
        newDataArrivo,
        newDataFinito || null,
        newGrammi ? parseFloat(newGrammi) : null,
        parseFloat(newCosto)
      );

      const { error } = await supabase
        .from('cbd' as any)
        .insert({
          user_id: user!.id,
          costo: parseFloat(newCosto),
          marca: newMarca || null,
          thc_content: newThcContent ? parseFloat(newThcContent) : null,
          grammi: newGrammi ? parseFloat(newGrammi) : null,
          descrizione: newDescrizione || null,
          data_acquisto: newDataArrivo,
          data_finito: newDataFinito || null,
          ...campi,
        });
      
      if (error) throw error;
      
      toast({ title: 'Nuova riga aggiunta' });
      closeCreate();
      setNewCosto('');
      setNewGrammi('');
      setNewDataArrivo(new Date().toISOString().split('T')[0]);
      setNewDataFinito('');
      setNewMarca('');
      setNewThcContent('');
      setNewDescrizione('');
      await reload();
    } catch (error) {
      console.error('Errore:', error);
      toast({ title: 'Errore', variant: 'destructive' });
    }
  };

  const deleteEntry = async (id: string) => {
    try {
      const { error } = await supabase
        .from('cbd' as any)
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast({ title: 'CBD eliminato!' });
      await reload();
    } catch (error) {
      console.error('Errore:', error);
      toast({ title: 'Errore', variant: 'destructive' });
    }
  };

  const updateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editCosto || !editDataArrivo) return;
    
    try {
      const campi = calculateDerivedFields(
        editDataArrivo,
        editDataFinito || null,
        editGrammi ? parseFloat(editGrammi) : null,
        parseFloat(editCosto)
      );

      const { error } = await supabase
        .from('cbd' as any)
        .update({
          costo: parseFloat(editCosto),
          grammi: editGrammi ? parseFloat(editGrammi) : null,
          data_acquisto: editDataArrivo,
          data_finito: editDataFinito || null,
          ...campi,
        })
        .eq('id', editingItem.id);
      
      if (error) throw error;
      
      toast({ title: 'Record aggiornato' });
      closeEdit();
      await reload();
    } catch (error) {
      console.error('Errore:', error);
      toast({ title: 'Errore nell\'aggiornamento', variant: 'destructive' });
    }
  };

  const openEditDialog = (entry: CBDEntry) => {
    setEditCosto(entry.costo.toString());
    setEditGrammi(entry.grammi?.toString() || '');
    setEditDataArrivo(entry.data_acquisto);
    setEditDataFinito(entry.data_finito || '');
    openEdit(entry);
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
        <div className="flex items-center gap-4">
          <Link to="/fumo">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-display font-bold">CBD</h1>
            <p className="text-muted-foreground">Traccia le spese per prodotti CBD</p>
          </div>
        </div>

        {/* Tabella CBD */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Spesa mensile</CardTitle>
              <Dialog open={createOpen} onOpenChange={(open) => open ? openCreate() : closeCreate()}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Aggiungi riga
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nuova riga</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={addNewRecord} className="space-y-4">
                    <div>
                      <Label>Costo (€)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={newCosto}
                        onChange={e => setNewCosto(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label>Grammi</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={newGrammi}
                        onChange={e => setNewGrammi(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label>Data Arrivo</Label>
                      <Input
                        type="date"
                        value={newDataArrivo}
                        onChange={e => setNewDataArrivo(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label>Data Finito (opzionale)</Label>
                      <Input
                        type="date"
                        value={newDataFinito}
                        onChange={e => setNewDataFinito(e.target.value)}
                      />
                    </div>
                    <Button type="submit" className="w-full">Salva</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {entries.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">Nessun record registrato</p>
                <Button onClick={openCreate} className="bg-green-500 hover:bg-green-600">
                  Aggiungi prima riga
                </Button>
              </div>
            ) : (
              <DataTable<CBDEntry>
                columns={[
                  {
                    key: 'costo',
                    header: 'Costo',
                    render: (entry) => `${CURRENCY_SYMBOLS.EUR}${entry.costo.toFixed(2)}`,
                    className: 'font-medium'
                  },
                  {
                    key: 'grammi',
                    header: 'Grammi',
                    render: (entry) => entry.grammi,
                    className: 'text-center'
                  },
                  {
                    key: 'data_acquisto',
                    header: 'Arrivato',
                    render: (entry) => new Date(entry.data_acquisto).toLocaleDateString('it-IT'),
                    className: 'text-center'
                  },
                  {
                    key: 'data_finito',
                    header: 'Finito',
                    render: (entry) => entry.data_finito ? new Date(entry.data_finito).toLocaleDateString('it-IT') : 'In corso',
                    className: 'text-center'
                  },
                  {
                    key: 'giorni_durata',
                    header: 'Giorni Durata',
                    render: (entry) => entry.giorni_durata || '-',
                    className: 'text-center'
                  },
                  {
                    key: 'grammi_al_giorno',
                    header: 'Grammi/d',
                    render: (entry) => entry.grammi_al_giorno?.toFixed(2) || '-',
                    className: 'text-center'
                  },
                  {
                    key: 'euro_al_giorno',
                    header: '€/d',
                    render: (entry) => entry.euro_al_giorno ? `${CURRENCY_SYMBOLS.EUR}${entry.euro_al_giorno.toFixed(2)}` : '-',
                    className: 'text-center'
                  },
                  {
                    key: 'costo_mensile',
                    header: 'Costo Mensile',
                    render: (entry) => entry.costo_mensile
                      ? `${CURRENCY_SYMBOLS.EUR}${entry.costo_mensile.toFixed(2)}`
                      : entry.giorni_durata && entry.costo
                        ? `${CURRENCY_SYMBOLS.EUR}${((entry.costo / entry.giorni_durata) * 30).toFixed(2)}`
                        : '-',
                    className: 'text-center'
                  },
                  {
                    key: 'actions',
                    header: '',
                    render: (entry) => (
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(entry)}
                          className="h-8 w-8"
                        >
                          <Edit2 className="w-4 h-4" />
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
                data={entries}
                loading={loading}
                emptyMessage={
                  <div className="text-center py-12">
                    <p className="text-muted-foreground mb-4">Nessun record registrato</p>
                    <Button onClick={openCreate} className="bg-green-500 hover:bg-green-600">
                      Aggiungi prima riga
                    </Button>
                  </div>
                }
              />
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={editOpen} onOpenChange={(open) => open ? undefined : closeEdit()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Modifica riga</DialogTitle>
            </DialogHeader>
            <form onSubmit={updateEntry} className="space-y-4">
              <div>
                <Label>Costo (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editCosto}
                  onChange={e => setEditCosto(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label>Grammi</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editGrammi}
                  onChange={e => setEditGrammi(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label>Data Arrivo</Label>
                <Input
                  type="date"
                  value={editDataArrivo}
                  onChange={e => setEditDataArrivo(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label>Data Finito (opzionale)</Label>
                <Input
                  type="date"
                  value={editDataFinito}
                  onChange={e => setEditDataFinito(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full">Aggiorna</Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Statistiche Annuale */}
        <Card>
          <CardHeader>
            <CardTitle>Spese per anno</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-sm">Anno</th>
                  <th className="text-center py-3 px-4 font-medium text-sm">Costo Totale</th>
                  <th className="text-center py-3 px-4 font-medium text-sm">Grammi Totali</th>
                  <th className="text-center py-3 px-4 font-medium text-sm">Costo al Grammo</th>
                  <th className="text-center py-3 px-4 font-medium text-sm">Costo Mensile</th>
                </tr>
              </thead>
              <tbody>
                {yearlyStats.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-muted-foreground">
                      Nessun dato annuale disponibile
                    </td>
                  </tr>
                ) : (
                  yearlyStats.map((stat, index) => (
                    <tr
                      key={stat.anno}
                      className={`border-t ${index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}
                    >
                      <td className="py-3 px-4 font-medium">{stat.anno}</td>
                      <td className="text-center py-3 px-4">
                        {CURRENCY_SYMBOLS.EUR}{stat.costoTotale.toFixed(2)}
                      </td>
                      <td className="text-center py-3 px-4">
                        {stat.grammiTotali.toFixed(2)}g
                      </td>
                      <td className="text-center py-3 px-4">
                        {CURRENCY_SYMBOLS.EUR}{stat.costoAlGrammo.toFixed(2)}
                      </td>
                      <td className="text-center py-3 px-4">
                        {CURRENCY_SYMBOLS.EUR}{stat.costoMensile.toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}