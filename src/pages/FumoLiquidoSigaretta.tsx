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
import { Trash2, Edit2, ArrowLeft, Plus } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';

interface LiquidoRecord {
  id: string;
  user_id: string;
  costo: number;
  millilitri: number;
  data_arrivo: string;
  data_finito: string | null;
  giorni_durata: number | null;
  millilitri_al_giorno: number | null;
  euro_al_giorno: number | null;
  costo_mensile: number | null;
  created_at: string;
  updated_at: string;
}

interface YearlyData {
  anno: number;
  costoTotale: number;
  millilitriTotali: number;
  millilitriMediaGiornalieri: number;
  costoMensile: number;
}

export default function FumoLiquidoSigaretta() {
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
  
  const [records, setRecords] = useState<LiquidoRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [newCosto, setNewCosto] = useState('');
  const [newMillilitri, setNewMillilitri] = useState('');
  const [newDataArrivo, setNewDataArrivo] = useState(new Date().toISOString().split('T')[0]);
  const [newDataFinito, setNewDataFinito] = useState('');

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<LiquidoRecord | null>(null);
  const [editCosto, setEditCosto] = useState('');
  const [editMillilitri, setEditMillilitri] = useState('');
  const [editDataArrivo, setEditDataArrivo] = useState('');
  const [editDataFinito, setEditDataFinito] = useState('');

  const loadData = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('liquido_sigaretta' as any)
        .select('*')
        .eq('user_id', user.id)
        .order('data_arrivo', { ascending: false });
      
      if (error) throw error;
      
      setRecords((data as unknown as LiquidoRecord[]) || []);
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

  // Calcola campi derivati
  const calcolareCampi = (arrivo: string, finito: string | null, millilitri: number, costo: number) => {
    if (!finito) {
      return { giorni_durata: null, millilitri_al_giorno: null, euro_al_giorno: null };
    }
    
    const dataArrivo = new Date(arrivo);
    const dataFinito = new Date(finito);
    const giorni = Math.ceil((dataFinito.getTime() - dataArrivo.getTime()) / (1000 * 60 * 60 * 24));
    
    if (giorni > 0) {
      return {
        giorni_durata: giorni,
        millilitri_al_giorno: millilitri / giorni,
        euro_al_giorno: costo / giorni,
        costo_mensile: (costo / giorni) * 30
      };
    }
    
    return { giorni_durata: null, millilitri_al_giorno: null, euro_al_giorno: null, costo_mensile: null };
  };

  // Raggruppa i dati per anno
  const yearlyData: YearlyData[] = records
    .filter(record => record.data_finito) // Solo record completati
    .reduce((acc: YearlyData[], record) => {
      const anno = new Date(record.data_arrivo).getFullYear();
      const existing = acc.find(item => item.anno === anno);
      
      if (existing) {
        existing.costoTotale += record.costo;
        existing.millilitriTotali += record.millilitri;
      } else {
        acc.push({
          anno,
          costoTotale: record.costo,
          millilitriTotali: record.millilitri,
          millilitriMediaGiornalieri: 0,
          costoMensile: 0
        });
      }
      
      return acc;
    }, []);

  // Calcola le medie per ogni anno
  yearlyData.forEach(yearData => {
    const recordsDellanno = records.filter(r => 
      r.data_finito && new Date(r.data_arrivo).getFullYear() === yearData.anno
    );
    
    const totalGiorni = recordsDellanno.reduce((sum, r) => sum + (r.giorni_durata || 0), 0);
    
    yearData.millilitriMediaGiornalieri = totalGiorni > 0 
      ? yearData.millilitriTotali / totalGiorni 
      : 0;
    
    yearData.costoMensile = yearData.costoTotale / 12;
  });

  yearlyData.sort((a, b) => b.anno - a.anno);

  // Aggiungi nuovo record
  const addNewRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCosto || !newMillilitri || !newDataArrivo) return;
    
    try {
      const campi = calcolareCampi(
        newDataArrivo,
        newDataFinito || null,
        parseFloat(newMillilitri),
        parseFloat(newCosto)
      );

      const { error } = await supabase
        .from('liquido_sigaretta' as any)
        .insert({
          user_id: user!.id,
          costo: parseFloat(newCosto),
          millilitri: parseFloat(newMillilitri),
          data_arrivo: newDataArrivo,
          data_finito: newDataFinito || null,
          ...campi,
        });
      
      if (error) throw error;
      
      toast({ title: 'Nuova riga aggiunta' });
      setCreateOpen(false);
      setNewCosto('');
      setNewMillilitri('');
      setNewDataArrivo(new Date().toISOString().split('T')[0]);
      setNewDataFinito('');
      await loadData();
    } catch (error) {
      console.error('Errore:', error);
      toast({ title: 'Errore', variant: 'destructive' });
    }
  };

  // Modifica record
  const updateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord || !editCosto || !editMillilitri || !editDataArrivo) return;
    
    try {
      const campi = calcolareCampi(
        editDataArrivo,
        editDataFinito || null,
        parseFloat(editMillilitri),
        parseFloat(editCosto)
      );

      const { error } = await supabase
        .from('liquido_sigaretta' as any)
        .update({
          costo: parseFloat(editCosto),
          millilitri: parseFloat(editMillilitri),
          data_arrivo: editDataArrivo,
          data_finito: editDataFinito || null,
          ...campi,
        })
        .eq('id', editingRecord.id);
      
      if (error) throw error;
      
      toast({ title: 'Record aggiornato' });
      setEditOpen(false);
      setEditingRecord(null);
      await loadData();
    } catch (error) {
      console.error('Errore:', error);
      toast({ title: 'Errore nell\'aggiornamento', variant: 'destructive' });
    }
  };

  // Elimina record
  const deleteRecord = async (id: string) => {
    try {
      const { error } = await supabase
        .from('liquido_sigaretta' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast({ title: 'Record eliminato' });
      await loadData();
    } catch (error) {
      console.error('Errore:', error);
      toast({ title: 'Errore', variant: 'destructive' });
    }
  };

  const openEditDialog = (record: LiquidoRecord) => {
    setEditingRecord(record);
    setEditCosto(record.costo.toString());
    setEditMillilitri(record.millilitri.toString());
    setEditDataArrivo(record.data_arrivo);
    setEditDataFinito(record.data_finito || '');
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
            <h1 className="text-3xl font-display font-bold">Liquido Sigaretta</h1>
            <p className="text-muted-foreground">Traccia il consumo di liquido per sigaretta elettronica</p>
          </div>
        </div>

        {/* Tabella Consumo Liquido Sigaretta */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Tabella Consumo Liquido Sigaretta</CardTitle>
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
                      <Label>Millilitri</Label>
                      <Input 
                        type="number" 
                        step="0.01" 
                        value={newMillilitri} 
                        onChange={e => setNewMillilitri(e.target.value)} 
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
            {records.length === 0 ? (
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
                      <th className="text-center py-3 px-4 font-medium text-sm">Millilitri</th>
                      <th className="text-center py-3 px-4 font-medium text-sm">Arrivato</th>
                      <th className="text-center py-3 px-4 font-medium text-sm">Finito</th>
                      <th className="text-center py-3 px-4 font-medium text-sm">Giorni Durata</th>
                      <th className="text-center py-3 px-4 font-medium text-sm">Millilitri/d</th>
                      <th className="text-center py-3 px-4 font-medium text-sm">€/d</th>
                      <th className="text-center py-3 px-4 font-medium text-sm">Costo Mensile</th>
                      <th className="text-center py-3 px-4 font-medium text-sm w-24"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record, index) => (
                      <tr 
                        key={record.id} 
                        className={`border-t ${index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}
                      >
                        <td className="py-3 px-4 font-medium">
                          {CURRENCY_SYMBOLS.EUR}{record.costo.toFixed(2)}
                        </td>
                        <td className="text-center py-3 px-4">
                          {record.millilitri}
                        </td>
                        <td className="text-center py-3 px-4">
                          {new Date(record.data_arrivo).toLocaleDateString('it-IT')}
                        </td>
                        <td className="text-center py-3 px-4">
                          {record.data_finito ? new Date(record.data_finito).toLocaleDateString('it-IT') : 'In corso'}
                        </td>
                        <td className="text-center py-3 px-4">
                          {record.giorni_durata || '-'}
                        </td>
                        <td className="text-center py-3 px-4">
                          {record.millilitri_al_giorno?.toFixed(2) || '-'}
                        </td>
                        <td className="text-center py-3 px-4">
                          {record.euro_al_giorno ? `${CURRENCY_SYMBOLS.EUR}${record.euro_al_giorno.toFixed(2)}` : '-'}
                        </td>
                        <td className="text-center py-3 px-4">
                          {record.costo_mensile
                            ? `${CURRENCY_SYMBOLS.EUR}${record.costo_mensile.toFixed(2)}`
                            : record.giorni_durata && record.costo
                              ? `${CURRENCY_SYMBOLS.EUR}${((record.costo / record.giorni_durata) * 30).toFixed(2)}`
                              : '-'}
                        </td>
                        <td className="text-center py-3 px-4">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(record)}
                              className="h-8 w-8"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteRecord(record.id)}
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
            <form onSubmit={updateRecord} className="space-y-4">
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
                <Label>Millilitri</Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  value={editMillilitri} 
                  onChange={e => setEditMillilitri(e.target.value)} 
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

        {/* Tabella per Anno */}
        <Card>
          <CardHeader>
            <CardTitle>Statistiche Annuale</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {yearlyData.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nessun dato annuale disponibile
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-sm">Anno</th>
                      <th className="text-center py-3 px-4 font-medium text-sm">Costo Totale</th>
                      <th className="text-center py-3 px-4 font-medium text-sm">Millilitri Totali</th>
                      <th className="text-center py-3 px-4 font-medium text-sm">Millilitri/d Media</th>
                      <th className="text-center py-3 px-4 font-medium text-sm">Costo Mensile</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearlyData.map((data, index) => (
                      <tr 
                        key={data.anno} 
                        className={`border-t ${index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}
                      >
                        <td className="py-3 px-4 font-medium">
                          {data.anno}
                        </td>
                        <td className="text-center py-3 px-4 font-medium">
                          {CURRENCY_SYMBOLS.EUR}{data.costoTotale.toFixed(2)}
                        </td>
                        <td className="text-center py-3 px-4">
                          {data.millilitriTotali}
                        </td>
                        <td className="text-center py-3 px-4">
                          {data.millilitriMediaGiornalieri.toFixed(2)}
                        </td>
                        <td className="text-center py-3 px-4">
                          {CURRENCY_SYMBOLS.EUR}{data.costoMensile.toFixed(2)}
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