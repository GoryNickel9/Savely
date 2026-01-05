import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CURRENCY_SYMBOLS } from '@/lib/types';
import { Plus, Trash2, ArrowLeft, Edit2 } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';

interface THCEntry {
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

export default function FumoTHC() {
  const { user } = useAuth();
  const { permissions, loading: permissionsLoading } = usePermissions();
  const { toast } = useToast();

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

  const [entries, setEntries] = useState<THCEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [newCosto, setNewCosto] = useState('');
  const [newGrammi, setNewGrammi] = useState('');
  const [newDataArrivo, setNewDataArrivo] = useState(new Date().toISOString().split('T')[0]);
  const [newDataFinito, setNewDataFinito] = useState('');
  const [newMarca, setNewMarca] = useState('');
  const [newThcContent, setNewThcContent] = useState('');
  const [newDescrizione, setNewDescrizione] = useState('');

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<THCEntry | null>(null);
  const [editCosto, setEditCosto] = useState('');
  const [editGrammi, setEditGrammi] = useState('');
  const [editDataArrivo, setEditDataArrivo] = useState('');
  const [editDataFinito, setEditDataFinito] = useState('');

  // Calcola campi derivati per un nuovo record
  const calcolareCampiPerInserimento = (arrivo: string, finito: string | null, grammi: number | null, costo: number) => {
    if (!finito || !grammi || grammi === 0) {
      return { giorni_durata: null, grammi_al_giorno: null, euro_al_giorno: null, costo_mensile: null };
    }
    
    const dataArrivo = new Date(arrivo);
    const dataFinito = new Date(finito);
    const giorni = Math.ceil((dataFinito.getTime() - dataArrivo.getTime()) / (1000 * 60 * 60 * 24));
    
    if (giorni > 0) {
      return {
        giorni_durata: giorni,
        grammi_al_giorno: grammi / giorni,
        euro_al_giorno: costo / giorni,
        costo_mensile: (costo / giorni) * 30
      };
    }
    
    return { giorni_durata: null, grammi_al_giorno: null, euro_al_giorno: null, costo_mensile: null };
  };

  // Calcola campi derivati per un record esistente
  const calcolareCampi = (entry: THCEntry): THCEntry => {
    if (!entry.data_finito || !entry.grammi || entry.grammi === 0) {
      return entry;
    }
    
    const dataArrivo = new Date(entry.data_acquisto);
    const dataFinito = new Date(entry.data_finito);
    const giorni = Math.ceil((dataFinito.getTime() - dataArrivo.getTime()) / (1000 * 60 * 60 * 24));
    
    if (giorni > 0) {
      return {
        ...entry,
        giorni_durata: giorni,
        grammi_al_giorno: entry.grammi / giorni,
        euro_al_giorno: entry.costo / giorni,
        costo_mensile: (entry.costo / giorni) * 30
      };
    }
    
    return entry;
  };

  const loadData = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('thc' as any)
        .select('*')
        .eq('user_id', user.id)
        .order('data_acquisto', { ascending: false });
      
      if (error) throw error;
      
      // Calcola campi derivati per i record esistenti
      const entriesWithCalculatedFields = (data as unknown as THCEntry[]).map(entry => calcolareCampi(entry));
      setEntries(entriesWithCalculatedFields || []);
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

  const addNewRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCosto || !newDataArrivo) return;
    
    try {
      const campi = calcolareCampiPerInserimento(
        newDataArrivo,
        newDataFinito || null,
        parseFloat(newGrammi),
        parseFloat(newCosto)
      );

      const { error } = await supabase
        .from('thc' as any)
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
      setCreateOpen(false);
      setNewCosto('');
      setNewGrammi('');
      setNewDataArrivo(new Date().toISOString().split('T')[0]);
      setNewDataFinito('');
      setNewMarca('');
      setNewThcContent('');
      setNewDescrizione('');
      await loadData();
    } catch (error) {
      console.error('Errore:', error);
      toast({ title: 'Errore', variant: 'destructive' });
    }
  };

  const deleteEntry = async (id: string) => {
    try {
      const { error } = await supabase
        .from('thc' as any)
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast({ title: 'THC eliminato!' });
      await loadData();
    } catch (error) {
      console.error('Errore:', error);
      toast({ title: 'Errore', variant: 'destructive' });
    }
  };

  const updateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry || !editCosto || !editDataArrivo) return;
    
    try {
      const campi = calcolareCampiPerInserimento(
        editDataArrivo,
        editDataFinito || null,
        parseFloat(editGrammi),
        parseFloat(editCosto)
      );

      const { error } = await supabase
        .from('thc' as any)
        .update({
          costo: parseFloat(editCosto),
          grammi: editGrammi ? parseFloat(editGrammi) : null,
          data_acquisto: editDataArrivo,
          data_finito: editDataFinito || null,
          ...campi,
        })
        .eq('id', editingEntry.id);
      
      if (error) throw error;
      
      toast({ title: 'Record aggiornato' });
      setEditOpen(false);
      setEditingEntry(null);
      await loadData();
    } catch (error) {
      console.error('Errore:', error);
      toast({ title: 'Errore nell\'aggiornamento', variant: 'destructive' });
    }
  };

  const openEditDialog = (entry: THCEntry) => {
    setEditingEntry(entry);
    setEditCosto(entry.costo.toString());
    setEditGrammi(entry.grammi?.toString() || '');
    setEditDataArrivo(entry.data_acquisto);
    setEditDataFinito(entry.data_finito || '');
    setEditOpen(true);
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
            <h1 className="text-3xl font-display font-bold">THC</h1>
            <p className="text-muted-foreground">Traccia le spese per prodotti THC</p>
          </div>
        </div>

        {/* Tabella THC */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Tabella THC</CardTitle>
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
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
                <Button onClick={() => setCreateOpen(true)} className="bg-green-500 hover:bg-green-600">
                  Aggiungi prima riga
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-sm">Costo</th>
                      <th className="text-center py-3 px-4 font-medium text-sm">Grammi</th>
                      <th className="text-center py-3 px-4 font-medium text-sm">Arrivato</th>
                      <th className="text-center py-3 px-4 font-medium text-sm">Finito</th>
                      <th className="text-center py-3 px-4 font-medium text-sm">Giorni Durata</th>
                      <th className="text-center py-3 px-4 font-medium text-sm">Grammi/d</th>
                      <th className="text-center py-3 px-4 font-medium text-sm">€/d</th>
                      <th className="text-center py-3 px-4 font-medium text-sm">Costo Mensile</th>
                      <th className="text-center py-3 px-4 font-medium text-sm w-24"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry, index) => (
                      <tr
                        key={entry.id}
                        className={`border-t ${index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}
                      >
                        <td className="py-3 px-4 font-medium">
                          {CURRENCY_SYMBOLS.EUR}{entry.costo.toFixed(2)}
                        </td>
                        <td className="text-center py-3 px-4">
                          {entry.grammi}
                        </td>
                        <td className="text-center py-3 px-4">
                          {new Date(entry.data_acquisto).toLocaleDateString('it-IT')}
                        </td>
                        <td className="text-center py-3 px-4">
                          {entry.data_finito ? new Date(entry.data_finito).toLocaleDateString('it-IT') : 'In corso'}
                        </td>
                        <td className="text-center py-3 px-4">
                          {entry.giorni_durata || '-'}
                        </td>
                        <td className="text-center py-3 px-4">
                          {entry.grammi_al_giorno?.toFixed(2) || '-'}
                        </td>
                        <td className="text-center py-3 px-4">
                          {entry.euro_al_giorno ? `${CURRENCY_SYMBOLS.EUR}${entry.euro_al_giorno.toFixed(2)}` : '-'}
                        </td>
                        <td className="text-center py-3 px-4">
                          {entry.costo_mensile
                            ? `${CURRENCY_SYMBOLS.EUR}${entry.costo_mensile.toFixed(2)}`
                            : entry.giorni_durata && entry.costo
                              ? `${CURRENCY_SYMBOLS.EUR}${((entry.costo / entry.giorni_durata) * 30).toFixed(2)}`
                              : '-'}
                        </td>
                        <td className="text-center py-3 px-4">
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
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
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
            <CardTitle>Statistiche Annuale</CardTitle>
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
                {(() => {
                  const yearlyStats = entries.reduce((acc: any[], entry) => {
                    const year = new Date(entry.data_acquisto).getFullYear();
                    const existing = acc.find(item => item.anno === year);
                    
                    if (existing) {
                      existing.costoTotale += Number(entry.costo);
                      existing.grammiTotali += (entry.grammi || 0);
                    } else {
                      acc.push({
                        anno: year,
                        costoTotale: Number(entry.costo),
                        grammiTotali: entry.grammi || 0,
                      });
                    }
                    
                    return acc;
                  }, []);

                  yearlyStats.forEach((stat: any) => {
                    stat.costoAlGrammo = stat.grammiTotali > 0 ? stat.costoTotale / stat.grammiTotali : 0;
                    stat.costoMensile = stat.costoTotale / 12;
                  });

                  yearlyStats.sort((a: any, b: any) => b.anno - a.anno);

                  return yearlyStats.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-muted-foreground">
                        Nessun dato annuale disponibile
                      </td>
                    </tr>
                  ) : (
                    yearlyStats.map((stat: any, index: number) => (
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
                  );
                })()}
              </tbody>
            </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}