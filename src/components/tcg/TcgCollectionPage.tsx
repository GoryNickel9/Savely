import { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router';
import MainLayout from '@/components/layout/MainLayout';
import { useTcgCards } from '@/hooks/useTcgCards';
import { CARD_CONDITION_LABELS, CardCondition, TcgCard, TcgGame } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, Search, Loader2, Pencil, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { parseAmount, todayLocalISO } from '@/lib/utils';
import { useCardTraderSearch, CardTraderCard } from '@/hooks/useCardTraderSearch';
import { fetchCtZeroPrice } from '@/hooks/useCardTraderPrices';
import { useTranslation } from 'react-i18next';

const LANGUAGES = ['EN', 'IT', 'JP', 'DE', 'FR', 'ES', 'PT', 'KOR', 'ZHS'];
const CONDITIONS: CardCondition[] = ['near_mint', 'lightly_played', 'moderately_played', 'heavily_played', 'damaged'];

export interface TcgCollectionPageProps {
  category: TcgGame;
  title: string;
  subtitle: string;
  addCardTitle: string;
  /** Larghezza del dialog di aggiunta (Tailwind). */
  addDialogMaxWidth: string;
  /** Placeholder del campo di ricerca carte. */
  searchPlaceholder: string;
  /** Se true, normalizza set_code in maiuscolo (Magic). */
  normalizeSetCodeToUpper?: boolean;
  /** Se true, la lista carte filtra anche per set_code nel campo di testo (Pokemon). */
  filterByTextOrSet?: boolean;
  /** Se true, mostra collector_number nel dettaglio/edit (Magic/Pokemon). */
  showCollectorNumber?: boolean;
}

/**
 * Pagina di collezione carte TCG (Magic / Pokemon / Yugioh).
 *
 * Unifica il codice precedentemente duplicato tra le tre pagine, che
 * differivano solo per categoria, label e piccole variazioni di filtro.
 * Vedi REF-02 in plans/REVISIONE_CODICE_ROUND2_2026-07-03.md.
 */
export default function TcgCollectionPage({
  category,
  title,
  subtitle,
  addCardTitle,
  addDialogMaxWidth,
  searchPlaceholder,
  normalizeSetCodeToUpper = false,
  filterByTextOrSet = true,
  showCollectorNumber = true,
}: TcgCollectionPageProps) {
  const { t } = useTranslation();
  const { cards, isLoading, totalValue, totalCost, totalGain, totalGainPercent, createCard, updateCard, deleteCard } = useTcgCards(category);

  const { results, loading: searching, error: searchError, search: searchCardTrader, reset: resetResults } = useCardTraderSearch();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<CardTraderCard | null>(null);
  const [condition, setCondition] = useState<CardCondition>('near_mint');
  const [language, setLanguage] = useState('EN');
  const [quantity, setQuantity] = useState('1');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(todayLocalISO());
  const [filterText, setFilterText] = useState('');
  const [setFilter, setSetFilter] = useState('all');
  const [searchSetFilter, setSearchSetFilter] = useState('all');
  const [savingPrice, setSavingPrice] = useState(false);

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<TcgCard | null>(null);
  const [editCondition, setEditCondition] = useState<CardCondition>('near_mint');
  const [editLanguage, setEditLanguage] = useState('EN');
  const [editQuantity, setEditQuantity] = useState('1');
  const [editPurchasePrice, setEditPurchasePrice] = useState('');
  const [editPurchaseDate, setEditPurchaseDate] = useState('');

  const normalizeSet = useCallback(
    (code: string | null | undefined) =>
      normalizeSetCodeToUpper ? code?.toUpperCase() : code,
    [normalizeSetCodeToUpper]
  );

  const uniqueSets = useMemo(() => {
    const sets = new Set<string>();
    cards.forEach(c => { if (c.set_code) sets.add(normalizeSet(c.set_code) as string); });
    return Array.from(sets).sort();
  }, [cards, normalizeSet]);

  const searchResultSets = useMemo(() => {
    const sets = new Set<string>();
    results.forEach(r => sets.add(r.set.name));
    return Array.from(sets).sort((a, b) => a.localeCompare(b));
  }, [results]);

  const filteredSearchResults = useMemo(
    () => searchSetFilter === 'all' ? results : results.filter(r => r.set.name === searchSetFilter),
    [results, searchSetFilter]
  );

  const handleSelect = (card: CardTraderCard) => {
    setSelected(card);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    try {
      setSavingPrice(true);
      const currentPrice = await fetchCtZeroPrice(selected.id, condition);
      setSavingPrice(false);
      await createCard.mutateAsync({
        name: selected.name,
        category,
        card_id: selected.id,
        set_code: selected.set.name,
        collector_number: null,
        condition,
        language,
        quantity: parseInt(quantity),
        purchase_price: parseAmount(purchasePrice),
        purchase_date: purchaseDate,
        current_price: currentPrice ?? undefined,
        image_url: selected.image,
      });
      toast(t('Carta aggiunta!'));
      resetDialog();
    } catch {
      setSavingPrice(false);
      toast.error(t('Errore'));
    }
  };

  const resetDialog = () => {
    setOpen(false);
    setQuery('');
    resetResults();
    setSelected(null);
    setSearchSetFilter('all');
    setCondition('near_mint');
    setLanguage('EN');
    setQuantity('1');
    setPurchasePrice('');
    setPurchaseDate(todayLocalISO());
  };

  const handleEditOpen = (card: TcgCard) => {
    setEditingCard(card);
    setEditCondition(card.condition);
    setEditLanguage(card.language);
    setEditQuantity(String(card.quantity));
    setEditPurchasePrice(String(card.purchase_price));
    setEditPurchaseDate(card.purchase_date);
    setEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCard) return;
    try {
      await updateCard.mutateAsync({
        id: editingCard.id,
        condition: editCondition,
        language: editLanguage,
        quantity: parseInt(editQuantity),
        purchase_price: parseAmount(editPurchasePrice),
        purchase_date: editPurchaseDate,
      });
      toast(t('Carta aggiornata!'));
      setEditOpen(false);
      setEditingCard(null);
    } catch {
      toast.error(t('Errore'));
    }
  };

  const filtered = cards.filter((c) => {
    const normalizedSet = normalizeSet(c.set_code);
    const matchText = !filterText
      || c.name.toLowerCase().includes(filterText.toLowerCase())
      || (filterByTextOrSet && normalizedSet?.toLowerCase().includes(filterText.toLowerCase()));
    const matchSet = setFilter === 'all' || normalizedSet === setFilter;
    return matchText && matchSet;
  });

  const renderSetLine = (setCode: string | null, collectorNumber: string | null) => {
    if (!setCode) return null;
    const ns = normalizeSet(setCode);
    if (!showCollectorNumber) return <p className="text-xs text-muted-foreground">{ns}</p>;
    return (
      <p className="text-xs text-muted-foreground">
        {ns}{collectorNumber != null ? ` #${collectorNumber}` : ''}
      </p>
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <Link to="/tcg" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-1">
              <ArrowLeft className="w-4 h-4" />{t('Collezione TCG')}
            </Link>
            <h1 className="text-3xl font-display font-bold">{t(title)}</h1>
            <p className="text-muted-foreground">{t(subtitle)}</p>
          </div>
          <Dialog open={open} onOpenChange={(o) => { if (!o) resetDialog(); else setOpen(true); }}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />{t('Aggiungi Carta')}</Button>
            </DialogTrigger>
            <DialogContent className={addDialogMaxWidth}>
              <DialogHeader><DialogTitle>{t(addCardTitle)}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                {/* Search */}
                <div>
                  <Label>{t('Cerca carta')}</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={t(searchPlaceholder)}
                      onKeyDown={(e) => e.key === 'Enter' && searchCardTrader(query)}
                    />
                    <Button type="button" variant="outline" onClick={() => searchCardTrader(query)} disabled={searching}>
                      {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {searchError && (
                  <p className="text-sm text-destructive">{t('Errore durante la ricerca')}: {searchError}</p>
                )}

                {/* Results */}
                {results.length > 0 && !selected && (
                  <div className="space-y-2">
                    {searchResultSets.length > 1 && (
                      <div className="flex items-center gap-2">
                        <Label className="text-xs shrink-0">{t('Filtra set:')}</Label>
                        <Select value={searchSetFilter} onValueChange={setSearchSetFilter}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">{t('Tutti i set ({{count}})', { count: results.length })}</SelectItem>
                            {searchResultSets.map(s => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-3 max-h-112 overflow-y-auto pr-1">
                      {filteredSearchResults.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => handleSelect(r)}
                          className="flex flex-col items-center gap-2 p-2 rounded-lg border border-border hover:bg-secondary text-left"
                        >
                          {r.image
                            ? <img src={r.image} alt={r.name} className="w-full aspect-63/88 object-contain rounded" />
                            : <div className="w-full aspect-63/88 bg-muted rounded" />
                          }
                          <div className="w-full min-w-0">
                            <p className="text-xs font-medium truncate">{r.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{r.set.name}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Selected card form */}
                {selected && (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-secondary rounded-lg">
                      {selected.image && (
                        <img src={selected.image} alt={selected.name} className="w-12 h-16 object-cover rounded" />
                      )}
                      <div>
                        <p className="font-medium">{selected.name}</p>
                        <p className="text-sm text-muted-foreground">{selected.set.name}</p>
                        <Button variant="link" size="sm" className="p-0 h-auto text-xs" type="button" onClick={() => setSelected(null)}>
                          {t('Cambia carta')}
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>{t('Condizione')}</Label>
                        <Select value={condition} onValueChange={(v) => setCondition(v as CardCondition)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{CONDITIONS.map((c) => <SelectItem key={c} value={c}>{t(CARD_CONDITION_LABELS[c])}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>{t('Lingua')}</Label>
                        <Select value={language} onValueChange={setLanguage}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{LANGUAGES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label>{t('Quantità')}</Label><Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required /></div>
                      <div><Label>{t('Prezzo Acquisto (€)')}</Label><Input type="number" step="0.01" min="0" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} required /></div>
                    </div>
                    <div><Label>{t('Data Acquisto')}</Label><Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} required /></div>
                    <Button type="submit" className="w-full" disabled={createCard.isPending || savingPrice}>
                      {savingPrice ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('Recupero prezzo...')}</> : t('Salva')}
                    </Button>
                  </form>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass rounded-xl p-5 text-center">
            <p className="text-sm text-muted-foreground">{t('Valore Attuale')}</p>
            <p className="text-xl font-display font-bold">€{totalValue.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="glass rounded-xl p-5 text-center">
            <p className="text-sm text-muted-foreground">{t('Investimento')}</p>
            <p className="text-xl font-display font-bold">€{totalCost.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="glass rounded-xl p-5 text-center">
            <p className="text-sm text-muted-foreground">{t('Profitto / Perdita')}</p>
            <p className={`text-xl font-display font-bold ${totalGain >= 0 ? 'text-success' : 'text-destructive'}`}>
              {totalGain >= 0 ? '+' : ''}€{totalGain.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="glass rounded-xl p-5 text-center">
            <p className="text-sm text-muted-foreground">{t('Rendimento')}</p>
            <p className={`text-xl font-display font-bold ${totalCost === 0 ? 'text-muted-foreground' : totalGainPercent >= 0 ? 'text-success' : 'text-destructive'}`}>
              {totalCost > 0 ? `${totalGainPercent >= 0 ? '+' : ''}${totalGainPercent.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : '—'}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <Input
            placeholder={filterByTextOrSet ? t('Cerca per nome o set...') : t('Cerca per nome...')}
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="max-w-sm"
          />
          {uniqueSets.length > 0 && (
            <Select value={setFilter} onValueChange={setSetFilter}>
              <SelectTrigger className="w-48"><SelectValue placeholder={t('Tutti i set')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('Tutti i set')}</SelectItem>
                {uniqueSets.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Card list: scroll orizzontale su mobile (griglia a 8 colonne, v. DataTable) */}
        <div className="glass rounded-xl divide-y divide-border overflow-x-auto">
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto_auto] gap-4 px-4 py-2 text-xs text-muted-foreground font-medium min-w-[600px]">
            <span className="w-8 block"></span>
            <span>{t('Carta')}</span>
            <span>{t('Cond.')}</span>
            <span>{t('Lingua')}</span>
            <span className="text-right">{t('Qta')}</span>
            <span className="text-right">{t('Acquisto')}</span>
            <span className="text-right">{t('Attuale')}</span>
            <span className="w-18 block"></span>
          </div>
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">{t('Caricamento...')}</p>
          ) : filtered.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">{t('Nessuna carta. Aggiungine una!')}</p>
          ) : (
            filtered.map((card) => {
              const currentPrice = card.current_price ?? card.purchase_price;
              const pl = (currentPrice - card.purchase_price) * card.quantity;
              return (
                <div key={card.id} className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto_auto] gap-4 items-center px-4 py-3 min-w-[600px]">
                  {card.image_url ? (
                    <img src={card.image_url} alt={card.name} className="w-8 h-11 object-cover rounded" />
                  ) : (
                    <div className="w-8 h-11 bg-muted rounded" />
                  )}
                  <div>
                    <p className="font-medium text-sm">{card.name}</p>
                    {renderSetLine(card.set_code, card.collector_number)}
                  </div>
                  <span className="text-xs text-muted-foreground">{t(CARD_CONDITION_LABELS[card.condition]).split(' ')[0]}</span>
                  <span className="text-xs">{card.language}</span>
                  <span className="text-right text-sm">×{card.quantity}</span>
                  <span className="text-right text-sm">€{card.purchase_price.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <div className="text-right">
                    <p className="text-sm">€{currentPrice.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    <p className={`text-xs ${pl >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {pl >= 0 ? '+' : ''}€{pl.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="icon" onClick={() => handleEditOpen(card)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteCard.mutate(card.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Edit dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{t('Modifica carta')}</DialogTitle></DialogHeader>
            {editingCard && (
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-secondary rounded-lg">
                  {editingCard.image_url && <img src={editingCard.image_url} alt={editingCard.name} className="w-12 h-16 object-cover rounded" />}
                  <div>
                    <p className="font-medium">{editingCard.name}</p>
                    {renderSetLine(editingCard.set_code, editingCard.collector_number)}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>{t('Condizione')}</Label>
                    <Select value={editCondition} onValueChange={(v) => setEditCondition(v as CardCondition)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CONDITIONS.map((c) => <SelectItem key={c} value={c}>{t(CARD_CONDITION_LABELS[c])}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>{t('Lingua')}</Label>
                    <Select value={editLanguage} onValueChange={setEditLanguage}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{LANGUAGES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>{t('Quantità')}</Label><Input type="number" min="1" value={editQuantity} onChange={(e) => setEditQuantity(e.target.value)} required /></div>
                  <div><Label>{t('Prezzo Acquisto (€)')}</Label><Input type="number" step="0.01" min="0" value={editPurchasePrice} onChange={(e) => setEditPurchasePrice(e.target.value)} required /></div>
                </div>
                <div><Label>{t('Data Acquisto')}</Label><Input type="date" value={editPurchaseDate} onChange={(e) => setEditPurchaseDate(e.target.value)} required /></div>
                <Button type="submit" className="w-full" disabled={updateCard.isPending}>{t('Salva modifiche')}</Button>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
