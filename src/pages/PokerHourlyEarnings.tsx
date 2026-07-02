/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase generated types do not include poker_hourly_earnings and poker_next_cut tables */
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Plus, Edit, Save, X, ArrowLeft } from 'lucide-react';
import { calculateMedian } from '@/lib/statistics';
import { useSupabaseData } from '@/hooks/useSupabaseData';
import { useYearlyData } from '@/hooks/useYearlyData';
import { parseAmount } from '@/lib/utils';

interface HourlyEarning {
  id: string;
  user_id: string;
  date: string;
  hours_played: number;
  profit_loss: number;
  hourly_rate: number;
  net_won_ev: number;
  hourly_rate_ev: number;
  created_at: string;
  updated_at: string;
}

interface YearlyData {
  year: string;
  totalHours: number;
  totalProfitLoss: number;
  hourlyRate: number;
  totalNetWonEv: number;
  hourlyRateEv: number;
  medianHours: number;
}

export default function PokerHourlyEarnings() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const currentYear = new Date().getFullYear();
  
  const [deal, setDeal] = useState<number | null>(null);
  const [newMonth, setNewMonth] = useState('');
  const [newHours, setNewHours] = useState('');
  const [newProfitLoss, setNewProfitLoss] = useState('');
  const [newNetWonEv, setNewNetWonEv] = useState('');
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editHours, setEditHours] = useState('');
  const [editProfitLoss, setEditProfitLoss] = useState('');
  const [editNetWonEv, setEditNetWonEv] = useState('');
  
  // Usa useSupabaseData per caricare i guadagni orari
  const { data: earnings, loading, reload } = useSupabaseData<HourlyEarning>({
    tableName: 'poker_hourly_earnings',
    orderBy: 'date',
    ascending: false
  });
  
  // Carica il deal dell'utente
  useEffect(() => {
    const loadDeal = async () => {
      if (!user?.id) return;
      
      try {
        const { data: dealData, error: dealError } = await supabase
          .from('poker_next_cut' as any)
          .select('deal')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (!dealError && dealData && 'deal' in dealData) {
          setDeal(dealData.deal as number);
        } else {
          setDeal(0.55);
        }
      } catch (error) {
        console.error('Errore nel caricamento del deal:', error);
        setDeal(0.55);
      }
    };
    
    loadDeal();
  }, [user?.id]);

  // Usa useYearlyData per raggruppare i dati per anno
  const additionalFields = useMemo(() => ({
    totalHours: (group: HourlyEarning[]) => group.reduce((sum, e) => sum + e.hours_played, 0),
    totalProfitLoss: (group: HourlyEarning[]) => group.reduce((sum, e) => sum + e.profit_loss, 0),
    totalNetWonEv: (group: HourlyEarning[]) => group.reduce((sum, e) => sum + e.net_won_ev, 0),
  }), []);
  
  const yearlyDataRaw = useYearlyData({
    items: earnings,
    getDate: (item) => item.date,
    getValue: (item) => item.hours_played,
    additionalFields
  });
  
  // Calcola i campi derivati per ogni anno
  const yearlyData: YearlyData[] = yearlyDataRaw.map((stat): YearlyData => {
    const yearEarnings = earnings.filter(e => new Date(e.date).getFullYear().toString() === stat.year);
    const hoursArray = yearEarnings.map(e => e.hours_played);
    const medianHours = calculateMedian(hoursArray);
    const totalHours = (stat.totalHours as number) || 0;
    const totalProfitLoss = (stat.totalProfitLoss as number) || 0;
    const totalNetWonEv = (stat.totalNetWonEv as number) || 0;
    
    return {
      year: stat.year,
      totalHours,
      totalProfitLoss,
      hourlyRate: totalHours > 0 ? totalProfitLoss / totalHours : 0,
      totalNetWonEv,
      hourlyRateEv: totalHours > 0 ? totalNetWonEv / totalHours : 0,
      medianHours
    };
  });

  // Aggiungi guadagno orario
  const addEarning = async () => {
    if (!newMonth || !newHours || !newProfitLoss) {
      toast({
        title: 'Attenzione',
        description: 'Compila tutti i campi',
        variant: 'destructive',
      });
      return;
    }
    
    const minutes = parseAmount(newHours);
    const hours = minutes / 60;
    const profitLoss = parseAmount(newProfitLoss);
    const netWonEv = newNetWonEv ? parseAmount(newNetWonEv) : 0;
    const hourlyRate = hours > 0 ? profitLoss / hours : 0;
    const hourlyRateEv = hours > 0 ? netWonEv / hours : 0;
    
    // Converti MM/YYYY in data (primo giorno del mese)
    const [year, month] = newMonth.split('-');
    const date = `${year}-${month}-01`;
    
    try {
      // Verifica se esiste già un record per questo mese
      const { data: existingData, error: checkError } = await supabase
        .from('poker_hourly_earnings' as any)
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
          description: 'Esiste già un guadagno orario per questo mese',
          variant: 'destructive',
        });
        return;
      }
      
      const { error } = await supabase
        .from('poker_hourly_earnings' as any)
        .insert({
          user_id: user!.id,
          date: date,
          hours_played: hours,
          profit_loss: profitLoss,
          hourly_rate: hourlyRate,
          net_won_ev: netWonEv,
          hourly_rate_ev: hourlyRateEv,
        });
      
      if (error) throw error;
      
      setNewMonth('');
      setNewHours('');
      setNewProfitLoss('');
      setNewNetWonEv('');
      toast({ title: 'Guadagno orario aggiunto' });
      await reload();
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
      await reload();
    } catch (error) {
      console.error('Errore:', error);
      toast({ title: 'Errore', variant: 'destructive' });
    }
  };

  // Modifica guadagno orario
  const startEdit = (earning: HourlyEarning) => {
    setEditingId(earning.id);
    setEditHours(Math.round(earning.hours_played * 60).toString());
    setEditProfitLoss(earning.profit_loss.toString());
    setEditNetWonEv(earning.net_won_ev.toString());
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditHours('');
    setEditProfitLoss('');
    setEditNetWonEv('');
  };

  const saveEdit = async (id: string) => {
    if (!editHours || !editProfitLoss) {
      toast({
        title: 'Attenzione',
        description: 'Compila tutti i campi obbligatori',
        variant: 'destructive',
      });
      return;
    }
    
    const minutes = parseAmount(editHours);
    const hours = minutes / 60;
    const profitLoss = parseAmount(editProfitLoss);
    const netWonEv = editNetWonEv ? parseAmount(editNetWonEv) : 0;
    const hourlyRate = hours > 0 ? profitLoss / hours : 0;
    const hourlyRateEv = hours > 0 ? netWonEv / hours : 0;
    
    try {
      const { error } = await supabase
        .from('poker_hourly_earnings' as any)
        .update({
          hours_played: hours,
          profit_loss: profitLoss,
          hourly_rate: hourlyRate,
          net_won_ev: netWonEv,
          hourly_rate_ev: hourlyRateEv,
        })
        .eq('id', id);
      
      if (error) throw error;
      
      toast({ title: 'Guadagno orario aggiornato' });
      cancelEdit();
      await reload();
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
            <h1 className="text-3xl font-display font-bold">Guadagno Orario</h1>
            <p className="text-muted-foreground">Traccia il tuo guadagno orario nel poker</p>
          </div>
        </div>

        {/* Aggiungi Guadagno Orario */}
        <Card>
          <CardHeader>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
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
                <label className="text-sm font-medium mb-2 block">Ore giocate (minuti)</label>
                <Input
                  type="number"
                  step="1"
                  placeholder="Es. 270"
                  value={newHours}
                  onChange={(e) => setNewHours(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Net Won</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Es. 250.00"
                  value={newProfitLoss}
                  onChange={(e) => setNewProfitLoss(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Net Won EV</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Es. 300.00"
                  value={newNetWonEv}
                  onChange={(e) => setNewNetWonEv(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={addEarning} className="w-full mt-4 bg-green-500 hover:bg-green-600">
              <Plus className="w-4 h-4 mr-2" />
              Aggiungi
            </Button>
          </CardContent>
        </Card>

        {/* Tabella Guadagni Orari per Mese */}
        <Card>
          <CardHeader>
            <CardTitle>Guadagni orari per mese nel {currentYear}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {earnings.filter(e => new Date(e.date).getFullYear() === currentYear).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nessun guadagno orario registrato
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-sm">Mese</th>
                      <th className="text-right py-3 px-4 font-medium text-sm">Net won</th>
                      <th className="text-right py-3 px-4 font-medium text-sm">Net won ev</th>
                      <th className="text-right py-3 px-4 font-medium text-sm">Ore</th>
                      <th className="text-right py-3 px-4 font-medium text-sm">€/h reale</th>
                      <th className="text-right py-3 px-4 font-medium text-sm">€/h ev</th>
                      <th className="text-center py-3 px-4 font-medium text-sm"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {earnings.filter(e => new Date(e.date).getFullYear() === currentYear).map((earning, index) => (
                      <tr
                        key={earning.id}
                        className={`border-t ${index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}
                      >
                        <td className="py-3 px-4 font-medium">
                          {new Date(earning.date).toLocaleDateString('it-IT', {
                            month: 'long',
                            year: 'numeric'
                          })}
                        </td>
                        {editingId === earning.id ? (
                          <>
                            <td className="py-3 px-4">
                              <Input
                                type="number"
                                step="0.01"
                                value={editProfitLoss}
                                onChange={(e) => setEditProfitLoss(e.target.value)}
                                className="w-24 text-right"
                              />
                            </td>
                            <td className="py-3 px-4">
                              <Input
                                type="number"
                                step="0.01"
                                value={editNetWonEv}
                                onChange={(e) => setEditNetWonEv(e.target.value)}
                                className="w-24 text-right"
                              />
                            </td>
                            <td className="py-3 px-4">
                              <Input
                                type="number"
                                step="1"
                                value={editHours}
                                onChange={(e) => setEditHours(e.target.value)}
                                className="w-24 text-right"
                                placeholder="minuti"
                              />
                            </td>
                            <td className="text-right py-3 px-4 text-muted-foreground">
                              €{((parseAmount(editProfitLoss || '0') / (parseAmount(editHours || '0') / 60) || 0) * (deal || 0.55)).toFixed(2)}
                            </td>
                            <td className="text-right py-3 px-4 text-muted-foreground">
                              €{((parseAmount(editNetWonEv || '0') / (parseAmount(editHours || '0') / 60) || 0) * (deal || 0.55)).toFixed(2)}
                            </td>
                            <td className="text-center py-3 px-4">
                              <div className="flex justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => saveEdit(earning.id)}
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
                            <td className={`text-right py-3 px-4 font-medium ${earning.profit_loss >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              €{earning.profit_loss.toFixed(2)}
                            </td>
                            <td className={`text-right py-3 px-4 font-medium ${earning.net_won_ev >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              €{earning.net_won_ev.toFixed(2)}
                            </td>
                            <td className="text-right py-3 px-4">
                              {Math.floor(earning.hours_played)}h {Math.round((earning.hours_played % 1) * 60).toString().padStart(2, '0')}m
                            </td>
                            <td className={`text-right py-3 px-4 font-medium ${earning.hourly_rate * (deal || 0.55) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              €{(earning.hourly_rate * (deal || 0.55)).toFixed(2)}
                            </td>
                            <td className={`text-right py-3 px-4 font-medium ${earning.hourly_rate_ev * (deal || 0.55) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              €{(earning.hourly_rate_ev * (deal || 0.55)).toFixed(2)}
                            </td>
                            <td className="text-center py-3 px-4">
                              <div className="flex justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => startEdit(earning)}
                                  className="h-8 w-8"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => deleteEarning(earning.id)}
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

        {/* Tabella Guadagni Orari per Anno */}
        <Card>
          <CardHeader>
            <CardTitle>Guadagni orari per anno</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {yearlyData.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nessun guadagno orario registrato
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-sm">Anno</th>
                      <th className="text-right py-3 px-4 font-medium text-sm">Net won</th>
                      <th className="text-right py-3 px-4 font-medium text-sm">Net won ev</th>
                      <th className="text-right py-3 px-4 font-medium text-sm">Ore totali</th>
                      <th className="text-right py-3 px-4 font-medium text-sm">Ore mediana</th>
                      <th className="text-right py-3 px-4 font-medium text-sm">€/h reale</th>
                      <th className="text-right py-3 px-4 font-medium text-sm">€/h ev</th>
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
                        <td className={`text-right py-3 px-4 font-medium ${data.totalProfitLoss >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          €{data.totalProfitLoss.toFixed(2)}
                        </td>
                        <td className={`text-right py-3 px-4 font-medium ${data.totalNetWonEv >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          €{data.totalNetWonEv.toFixed(2)}
                        </td>
                        <td className="text-right py-3 px-4">
                          {Math.floor(data.totalHours)}h {Math.round((data.totalHours % 1) * 60).toString().padStart(2, '0')}m
                        </td>
                        <td className="text-right py-3 px-4">
                          {Math.floor(data.medianHours)}h {Math.round((data.medianHours % 1) * 60).toString().padStart(2, '0')}m
                        </td>
                        <td className={`text-right py-3 px-4 font-medium ${data.hourlyRate * (deal || 0.55) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          €{(data.hourlyRate * (deal || 0.55)).toFixed(2)}
                        </td>
                        <td className={`text-right py-3 px-4 font-medium ${data.hourlyRateEv * (deal || 0.55) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          €{(data.hourlyRateEv * (deal || 0.55)).toFixed(2)}
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