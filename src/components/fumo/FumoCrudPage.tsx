import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CURRENCY_SYMBOLS } from '@/lib/constants';
import { Plus, Trash2, ArrowLeft, Edit2 } from 'lucide-react';
import { Link } from 'react-router';
import { useSupabaseData } from '@/hooks/useSupabaseData';
import { parseAmount, todayLocalISO } from '@/lib/utils';
import { useDialogManager } from '@/hooks/useDialogManager';
import { DataTable, Column } from '@/components/ui/data-table';
import type {
  FumoBaseEntry,
  FumoYearColumn,
  FumoYearRow,
} from '@/lib/fumoCrud';
import { computeDerived, computeYearlyStats, readArrivo } from '@/lib/fumoCrud';
import { useTranslation } from 'react-i18next';

/** Tabelle fumo gestite da questa pagina CRUD parametrica. */
type FumoTableName = 'cbd' | 'thc' | 'liquido_sigaretta';
/**
 * Le tre tabelle condividono lo schema base ma cambiano le colonne quantita'
 * e data (grammi|millilitri, data_acquisto|data_arrivo): i payload con chiavi
 * calcolate non sono esprimibili in un singolo tipo Insert/Update generato,
 * quindi usano un cast puntuale verso l'unione dei tipi delle tre tabelle.
 */
type FumoInsert = Database['public']['Tables'][FumoTableName]['Insert'];
type FumoUpdate = Database['public']['Tables'][FumoTableName]['Update'];

export interface FumoCrudConfig<T extends FumoBaseEntry> {
  /** Nome tabella Supabase ('cbd' | 'thc' | 'liquido_sigaretta'). */
  tableName: FumoTableName;
  /** Titolo pagina (es. "CBD"). */
  title: string;
  /** Sottotitolo pagina. */
  subtitle: string;
  /** Etichetta del campo quantita' nel form (es. "Grammi" / "Millilitri"). */
  quantityLabel: string;
  /** Header della colonna quantita' in tabella (es. "Grammi" / "Millilitri"). */
  quantityColumnHeader: string;
  /** Header della colonna "quantita'/giorno" (es. "Grammi/d" / "Millilitri/d"). */
  quantityPerDayColumnHeader: string;
  /** Suffisso per la colonna quantita' in tabella (es. "g"). */
  quantitySuffix?: string;
  /** Messaggio del toast alla delete (es. "CBD eliminato!"). */
  deleteToast: string;
  /** Nome del campo data di arrivo nella tabella DB (data_acquisto | data_arrivo). */
  dateArrivoField: string;
  /** Se true, la DataTable mostra solo i record dell'anno corrente (THC/Liquido). */
  filterByCurrentYear: boolean;
  /** Colonne addizionali della tabella annuale (oltre ad Anno/Costo/Mensile). */
  yearlyExtraColumns: FumoYearColumn<T>[];
}

/**
 * Pagina CRUD parametrica per le tabelle Fumo (CBD / THC / Liquido Sigaretta).
 *
 * Unifica il codice precedentemente triplicato tra FumoCBD / FumoTHC /
 * FumoLiquidoSigaretta, che implementavano lo stesso flusso CRUD su tabelle
 * con schema analogo. Vedi REF-01 in plans/REVISIONE_CODICE_ROUND2_2026-07-03.md.
 *
 * La quantita' (grammi per CBD/THC, millilitri per Liquido) e' sempre obbligatoria
 * nel form, in linea con il comportamento Storico di Liquido; per CBD/THC era
 * formalmente opzionale ma sempre richiesta a runtime, quindi l'unificazione a
 * "obbligatoria" non cambia il comportamento effettivo.
 */
export default function FumoCrudPage<T extends FumoBaseEntry>({
  tableName,
  title,
  subtitle,
  quantityLabel,
  quantityColumnHeader,
  quantityPerDayColumnHeader,
  quantitySuffix = '',
  deleteToast,
  dateArrivoField,
  filterByCurrentYear,
  yearlyExtraColumns,
}: FumoCrudConfig<T>) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: rawEntries, loading, reload } = useSupabaseData<T>({
    tableName,
    orderBy: dateArrivoField,
    ascending: false,
  });

  // Create dialog state
  const [newCosto, setNewCosto] = useState('');
  const [newQuantita, setNewQuantita] = useState('');
  const [newDataArrivo, setNewDataArrivo] = useState(todayLocalISO());
  const [newDataFinito, setNewDataFinito] = useState('');
  const { open: createOpen, openCreate, close: closeCreate } = useDialogManager();

  // Edit dialog state
  const [editCosto, setEditCosto] = useState('');
  const [editQuantita, setEditQuantita] = useState('');
  const [editDataArrivo, setEditDataArrivo] = useState('');
  const [editDataFinito, setEditDataFinito] = useState('');
  const { open: editOpen, editingItem, openEdit, close: closeEdit } = useDialogManager<T>();

  // Campi derivati: ricalcolati lato client quando mancano (data_finito presente).
  const entries = rawEntries.map((entry) => {
    const quantitaField = (entry as Record<string, unknown>).quantita as number | null
      ?? (entry as Record<string, unknown>).grammi as number | null
      ?? null;
    const arrivoDate = readArrivo(entry, dateArrivoField);
    if (entry.data_finito && quantitaField != null && entry.giorni_durata === null) {
      const derived = computeDerived(arrivoDate, entry.data_finito, quantitaField, entry.costo);
      return {
        ...entry,
        giorni_durata: derived.giorni_durata,
        quantita_al_giorno: derived.quantita_al_giorno,
        euro_al_giorno: derived.euro_al_giorno,
        costo_mensile: derived.costo_mensile,
      } as T;
    }
    return entry;
  });

  // Anno corrente e eventuale filtro sui record mostrati in tabella.
  const currentYear = new Date().getFullYear();
  const visibleEntries = filterByCurrentYear
    ? entries.filter((e) => new Date(readArrivo(e, dateArrivoField)).getFullYear() === currentYear)
    : entries;

  // Statistiche annuali (su TUTTI i record, non filtrati).
  const yearlyStats = computeYearlyStats(entries, dateArrivoField);

  const resetCreateForm = () => {
    setNewCosto('');
    setNewQuantita('');
    setNewDataArrivo(todayLocalISO());
    setNewDataFinito('');
  };

  const addNewRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCosto || !newQuantita || !newDataArrivo) return;
    try {
      const campi = computeDerived(
        newDataArrivo,
        newDataFinito || null,
        parseAmount(newQuantita),
        parseAmount(newCosto)
      );
      const { error } = await supabase
        .from(tableName)
        .insert({
          user_id: user!.id,
          costo: parseAmount(newCosto),
          [quantityColumnKey]: parseAmount(newQuantita),
          [dateArrivoField]: newDataArrivo,
          data_finito: newDataFinito || null,
          giorni_durata: campi.giorni_durata,
          [quantitaPerDayKey]: campi.quantita_al_giorno,
          euro_al_giorno: campi.euro_al_giorno,
          costo_mensile: campi.costo_mensile,
        } as unknown as FumoInsert);
      if (error) throw error;
      toast({ title: t('Nuova riga aggiunta') });
      closeCreate();
      resetCreateForm();
      await reload();
    } catch (error) {
      console.error('Errore:', error);
      toast({ title: t('Errore'), variant: 'destructive' });
    }
  };

  const deleteEntry = async (id: string) => {
    try {
      const { error } = await supabase.from(tableName).delete().eq('id', id);
      if (error) throw error;
      toast({ title: t(deleteToast) });
      await reload();
    } catch (error) {
      console.error('Errore:', error);
      toast({ title: t('Errore'), variant: 'destructive' });
    }
  };

  const updateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editCosto || !editQuantita || !editDataArrivo) return;
    try {
      const campi = computeDerived(
        editDataArrivo,
        editDataFinito || null,
        parseAmount(editQuantita),
        parseAmount(editCosto)
      );
      const { error } = await supabase
        .from(tableName)
        .update({
          costo: parseAmount(editCosto),
          [quantityColumnKey]: parseAmount(editQuantita),
          [dateArrivoField]: editDataArrivo,
          data_finito: editDataFinito || null,
          giorni_durata: campi.giorni_durata,
          [quantitaPerDayKey]: campi.quantita_al_giorno,
          euro_al_giorno: campi.euro_al_giorno,
          costo_mensile: campi.costo_mensile,
        } as unknown as FumoUpdate)
        .eq('id', editingItem.id);
      if (error) throw error;
      toast({ title: t('Record aggiornato') });
      closeEdit();
      await reload();
    } catch (error) {
      console.error('Errore:', error);
      toast({ title: t("Errore nell'aggiornamento"), variant: 'destructive' });
    }
  };

  const openEditDialog = (entry: T) => {
    setEditCosto(entry.costo.toString());
    const q = (entry as Record<string, unknown>).quantita as number | null
      ?? (entry as Record<string, unknown>).grammi as number | null
      ?? null;
    setEditQuantita(q != null ? q.toString() : '');
    setEditDataArrivo(readArrivo(entry, dateArrivoField));
    setEditDataFinito(entry.data_finito || '');
    openEdit(entry);
  };

  // Chiavi DB per quantita': grammi (CBD/THC) o millilitri (Liquido).
  const quantityColumnKey = quantityColumnHeader.toLowerCase() === 'grammi' ? 'grammi' : 'millilitri';
  const quantitaPerDayKey = quantityColumnKey === 'grammi' ? 'grammi_al_giorno' : 'millilitri_al_giorno';

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </MainLayout>
    );
  }

  // Colonne DataTable
  const columns: Column<T>[] = [
    {
      key: 'costo',
      header: t('Costo'),
      render: (entry) => `${CURRENCY_SYMBOLS.EUR}${entry.costo.toFixed(2)}`,
      className: 'font-medium',
    },
    {
      key: quantityColumnKey,
      header: t(quantityColumnHeader),
      render: (entry) => {
        const q = (entry as Record<string, unknown>)[quantityColumnKey] as number | null;
        return q != null ? `${q}${quantitySuffix}` : '-';
      },
      className: 'text-center',
    },
    {
      key: dateArrivoField,
      header: t('Arrivato'),
      render: (entry) => new Date(readArrivo(entry, dateArrivoField)).toLocaleDateString('it-IT'),
      className: 'text-center',
    },
    {
      key: 'data_finito',
      header: t('Finito'),
      render: (entry) => entry.data_finito ? new Date(entry.data_finito).toLocaleDateString('it-IT') : t('In corso'),
      className: 'text-center',
    },
    {
      key: 'giorni_durata',
      header: t('Giorni Durata'),
      render: (entry) => entry.giorni_durata || '-',
      className: 'text-center',
    },
    {
      key: quantitaPerDayKey,
      header: t(quantityPerDayColumnHeader),
      render: (entry) => {
        const v = (entry as Record<string, unknown>)[quantitaPerDayKey] as number | null;
        return v != null ? v.toFixed(2) : '-';
      },
      className: 'text-center',
    },
    {
      key: 'euro_al_giorno',
      header: t('€/d'),
      render: (entry) => entry.euro_al_giorno ? `${CURRENCY_SYMBOLS.EUR}${entry.euro_al_giorno.toFixed(2)}` : '-',
      className: 'text-center',
    },
    {
      key: 'costo_mensile',
      header: t('Costo Mensile'),
      render: (entry) => entry.costo_mensile
        ? `${CURRENCY_SYMBOLS.EUR}${entry.costo_mensile.toFixed(2)}`
        : entry.giorni_durata && entry.costo
          ? `${CURRENCY_SYMBOLS.EUR}${((entry.costo / entry.giorni_durata) * 30).toFixed(2)}`
          : '-',
      className: 'text-center',
    },
    {
      key: 'actions',
      header: '',
      render: (entry) => (
        <div className="flex items-center justify-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => openEditDialog(entry)} className="h-8 w-8">
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => deleteEntry(entry.id)} className="h-8 w-8">
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      ),
      className: 'text-center',
    },
  ];

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
            <h1 className="text-3xl font-display font-bold">{t(title)}</h1>
            <p className="text-muted-foreground">{t(subtitle)}</p>
          </div>
        </div>

        {/* Tabella */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {filterByCurrentYear ? t('Spesa mensile per anno {{year}}', { year: currentYear }) : t('Spesa mensile')}
              </CardTitle>
              <Dialog open={createOpen} onOpenChange={(open) => (open ? openCreate() : closeCreate())}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    {t('Aggiungi riga')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('Nuova riga')}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={addNewRecord} className="space-y-4">
                    <div>
                      <Label>{t('Costo (€)')}</Label>
                      <Input type="number" step="0.01" value={newCosto} onChange={(e) => setNewCosto(e.target.value)} required />
                    </div>
                    <div>
                      <Label>{t(quantityLabel)}</Label>
                      <Input type="number" step="0.01" value={newQuantita} onChange={(e) => setNewQuantita(e.target.value)} required />
                    </div>
                    <div>
                      <Label>{t('Data Arrivo')}</Label>
                      <Input type="date" value={newDataArrivo} onChange={(e) => setNewDataArrivo(e.target.value)} required />
                    </div>
                    <div>
                      <Label>{t('Data Finito (opzionale)')}</Label>
                      <Input type="date" value={newDataFinito} onChange={(e) => setNewDataFinito(e.target.value)} />
                    </div>
                    <Button type="submit" className="w-full">{t('Salva')}</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {visibleEntries.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">
                  {filterByCurrentYear ? t("Nessun record registrato per l'anno {{year}}", { year: currentYear }) : t('Nessun record registrato')}
                </p>
                <Button onClick={openCreate} className="bg-green-500 hover:bg-green-600">
                  {t('Aggiungi prima riga')}
                </Button>
              </div>
            ) : (
              <DataTable<T>
                columns={columns}
                data={visibleEntries}
                loading={loading}
                emptyMessage={
                  <div className="text-center py-12">
                    <p className="text-muted-foreground mb-4">
                      {filterByCurrentYear ? t("Nessun record registrato per l'anno {{year}}", { year: currentYear }) : t('Nessun record registrato')}
                    </p>
                    <Button onClick={openCreate} className="bg-green-500 hover:bg-green-600">
                      {t('Aggiungi prima riga')}
                    </Button>
                  </div>
                }
              />
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={editOpen} onOpenChange={(open) => (open ? undefined : closeEdit())}>
          <DialogContent>
            <DialogHeader>
            <DialogTitle>{t('Modifica riga')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={updateEntry} className="space-y-4">
            <div>
              <Label>{t('Costo (€)')}</Label>
              <Input type="number" step="0.01" value={editCosto} onChange={(e) => setEditCosto(e.target.value)} required />
            </div>
            <div>
              <Label>{t(quantityLabel)}</Label>
              <Input type="number" step="0.01" value={editQuantita} onChange={(e) => setEditQuantita(e.target.value)} required />
            </div>
            <div>
              <Label>{t('Data Arrivo')}</Label>
              <Input type="date" value={editDataArrivo} onChange={(e) => setEditDataArrivo(e.target.value)} required />
            </div>
            <div>
              <Label>{t('Data Finito (opzionale)')}</Label>
              <Input type="date" value={editDataFinito} onChange={(e) => setEditDataFinito(e.target.value)} />
            </div>
            <Button type="submit" className="w-full">{t('Aggiorna')}</Button>
          </form>
          </DialogContent>
        </Dialog>

        {/* Statistiche Annuale */}
        <Card>
          <CardHeader>
            <CardTitle>{t('Spese per anno')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-sm">{t('Anno')}</th>
                    <th className="text-center py-3 px-4 font-medium text-sm">{t('Costo Totale')}</th>
                    {yearlyExtraColumns.map((c) => (
                      <th key={c.key} className="text-center py-3 px-4 font-medium text-sm">{t(c.header)}</th>
                    ))}
                    <th className="text-center py-3 px-4 font-medium text-sm">{t('Costo Mensile')}</th>
                  </tr>
                </thead>
                <tbody>
                  {yearlyStats.length === 0 ? (
                    <tr>
                      <td colSpan={3 + yearlyExtraColumns.length} className="text-center py-12 text-muted-foreground">
                        {t('Nessun dato annuale disponibile')}
                      </td>
                    </tr>
                  ) : (
                    yearlyStats.map((stat, index) => (
                      <tr key={stat.anno} className={`border-t ${index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}>
                        <td className="py-3 px-4 font-medium">{stat.anno}</td>
                        <td className="text-center py-3 px-4">
                          {CURRENCY_SYMBOLS.EUR}{stat.costoTotale.toFixed(2)}
                        </td>
                        {yearlyExtraColumns.map((c) => (
                          <td key={c.key} className="text-center py-3 px-4">
                            {c.render(stat, entries)}
                          </td>
                        ))}
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
