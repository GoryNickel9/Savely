import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import MainLayout from '@/components/layout/MainLayout';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { useProfile } from '@/hooks/useProfile';
import { usePermissions } from '@/hooks/usePermissions';
import { useCouplePairStatus } from '@/hooks/useCouplePairStatus';
import { useSharedExpenses, SharedExpenseViewRow } from '@/hooks/useSharedExpenses';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { TransactionType, Transaction, CurrencyCode } from '@/lib/types';
import { CategorySelect } from '@/components/CategorySelect';
import { CURRENCY_SYMBOLS } from '@/lib/constants';
import { parseAmount, todayLocalISO } from '@/lib/utils';
import { Plus, Trash2, Pencil, Search, Calendar, HeartHandshake } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, subYears, isWithinInterval, parseISO } from 'date-fns';

type FilterPeriod = 'this_month' | 'last_month' | 'last_semester' | 'last_year' | 'this_year' | 'custom';

export default function Transactions() {
  const { t } = useTranslation();
  const { transactions, createTransaction, updateTransaction, deleteTransaction } = useTransactions();
  const { incomeCategories, expenseCategories, categories: allCategories } = useCategories();
  const { defaultCurrency } = useProfile();
  const { permissions } = usePermissions();
  const { connection } = useCouplePairStatus();
  const { mySharedTransactionIds, mySharedExpenses, partnerSharedExpenses, createSharedExpense, removeMySharedExpense, removePartnerSharedExpense } = useSharedExpenses(connection?.id ?? null);
  const { toast } = useToast();

  // Dialog states
  const [open, setOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);

  // Form states
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>(defaultCurrency);
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayLocalISO());
  const [isFetchingRate, setIsFetchingRate] = useState(false);

  // Filter states
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('this_month');
  const [filterCategoryId, setFilterCategoryId] = useState<string>('all');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [filterOnlyShared, setFilterOnlyShared] = useState(false);

  // Couple sharing form states
  const [isShared, setIsShared] = useState(false);
  const [splitMode, setSplitMode] = useState<'equal' | 'custom'>('equal');
  const [partnerAmount, setPartnerAmount] = useState('');

  const categories = type === 'income' ? incomeCategories : expenseCategories;

  const resetForm = () => {
    setType('expense');
    setAmount('');
    setCurrency(defaultCurrency);
    setCategoryId('');
    setDescription('');
    setDate(todayLocalISO());
    setEditingTransaction(null);
    setIsShared(false);
    setSplitMode('equal');
    setPartnerAmount('');
  };

  const openCreateDialog = () => {
    resetForm();
    setOpen(true);
  };

  const openEditDialog = (t: Transaction) => {
    setEditingTransaction(t);
    setType(t.type);
    setAmount(String(t.amount));
    setCurrency((t.currency || defaultCurrency) as CurrencyCode);
    setCategoryId(t.category_id || '');
    setDescription(t.description || '');
    setDate(t.date);
    setOpen(true);
  };

  const openDeleteConfirm = (t: Transaction) => {
    setTransactionToDelete(t);
    setDeleteConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!transactionToDelete) return;
    try {
      await deleteTransaction.mutateAsync(transactionToDelete.id);
      toast({ title: t('Transazione eliminata!') });
      setDeleteConfirmOpen(false);
      setTransactionToDelete(null);
    } catch {
      toast({ title: t("Errore durante l'eliminazione"), variant: 'destructive' });
    }
  };

  const fetchExchangeRate = async (from: CurrencyCode): Promise<number> => {
    if (from === 'EUR') return 1;
    try {
      const resp = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=EUR`);
      if (!resp.ok) return 1;
      const data = await resp.json();
      return data.rates?.EUR ?? 1;
    } catch {
      return 1;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseAmount(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast({ title: t('Importo non valido'), description: t('Inserisci un importo maggiore di zero.'), variant: 'destructive' });
      return;
    }
    setIsFetchingRate(true);
    try {
      const exchange_rate_eur = await fetchExchangeRate(currency);
      if (editingTransaction) {
        await updateTransaction.mutateAsync({
          id: editingTransaction.id,
          type,
          amount: parsedAmount,
          currency,
          exchange_rate_eur,
          category_id: categoryId || undefined,
          description: description || undefined,
          date,
        });
        toast({ title: t('Transazione modificata!') });
      } else {
        const newTx = await createTransaction.mutateAsync({
          type,
          amount: parsedAmount,
          currency,
          exchange_rate_eur,
          category_id: categoryId || undefined,
          description: description || undefined,
          date,
        });
        // Mark as shared with partner if toggled
        if (isShared && connection?.id) {
          try {
            const customPartner = splitMode === 'custom' ? parseAmount(partnerAmount) : null;
            if (splitMode === 'custom' && (!Number.isFinite(customPartner) || customPartner <= 0 || customPartner >= parsedAmount)) {
              throw new Error(t('La quota del partner deve essere maggiore di zero e minore del totale.'));
            }
            await createSharedExpense.mutateAsync({
              connection_id: connection.id,
              original_tx_id: newTx.id,
              couple_category_name: categoryId ? allCategories.find(c => c.id === categoryId)?.name || null : null,
              split_mode: splitMode,
              partner_amount: customPartner,
            });
          } catch (err) {
            toast({
              title: t('Spesa salvata, ma condivisione fallita'),
              description: (err as Error).message,
              variant: 'destructive',
            });
          }
        }
        toast({ title: t('Transazione aggiunta!') });
      }
      setOpen(false);
      resetForm();
    } catch {
      toast({ title: t('Errore'), variant: 'destructive' });
    } finally {
      setIsFetchingRate(false);
    }
  };

  const handleCloseDialog = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) resetForm();
  };

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const thisMonthStart = startOfMonth(now);
    const thisMonthEnd = endOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));

    return transactions.filter(t => {
      const tDate = parseISO(t.date);

      // Period filter
      if (filterPeriod === 'this_month') {
        if (!isWithinInterval(tDate, { start: thisMonthStart, end: thisMonthEnd })) return false;
      } else if (filterPeriod === 'last_month') {
        if (!isWithinInterval(tDate, { start: lastMonthStart, end: lastMonthEnd })) return false;
      } else if (filterPeriod === 'last_semester') {
        const lastSemesterStart = startOfMonth(subMonths(now, 5));
        const lastSemesterEnd = endOfMonth(now);
        if (!isWithinInterval(tDate, { start: lastSemesterStart, end: lastSemesterEnd })) return false;
      } else if (filterPeriod === 'last_year') {
        const lastYearStart = startOfMonth(subMonths(now, 11));
        const lastYearEnd = endOfMonth(now);
        if (!isWithinInterval(tDate, { start: lastYearStart, end: lastYearEnd })) return false;
      } else if (filterPeriod === 'this_year') {
        const yearStart = new Date(selectedYear, 0, 1);
        const yearEnd = new Date(selectedYear, 11, 31);
        if (!isWithinInterval(tDate, { start: yearStart, end: yearEnd })) return false;
      } else if (filterPeriod === 'custom') {
        if (filterStartDate && tDate < parseISO(filterStartDate)) return false;
        if (filterEndDate && tDate > parseISO(filterEndDate)) return false;
      }

      // Category search filter
      if (categorySearch.trim()) {
        const search = categorySearch.toLowerCase();
        const categoryName = t.category?.name?.toLowerCase() || '';
        const description = t.description?.toLowerCase() || '';
        if (!categoryName.includes(search) && !description.includes(search)) return false;
      }

      // Category filter
      if (filterCategoryId !== 'all' && t.category_id !== filterCategoryId) return false;

      // Only shared filter
      if (filterOnlyShared && !mySharedTransactionIds.has(t.id)) return false;

      return true;
    });
  }, [transactions, filterPeriod, filterCategoryId, filterStartDate, filterEndDate, categorySearch, selectedYear, filterOnlyShared, mySharedTransactionIds]);

  // Extract unique years from transactions
  const availableYears = useMemo(() => {
    const years = transactions.map(t => new Date(t.date).getFullYear());
    return Array.from(new Set(years)).sort((a, b) => b - a);
  }, [transactions]);

  // Helper: check if a date string is within the current period filter
  const isInPeriod = (dateStr: string): boolean => {
    const now = new Date();
    const d = parseISO(dateStr);
    if (filterPeriod === 'this_month') return isWithinInterval(d, { start: startOfMonth(now), end: endOfMonth(now) });
    if (filterPeriod === 'last_month') return isWithinInterval(d, { start: startOfMonth(subMonths(now, 1)), end: endOfMonth(subMonths(now, 1)) });
    if (filterPeriod === 'last_semester') return isWithinInterval(d, { start: startOfMonth(subMonths(now, 5)), end: endOfMonth(now) });
    if (filterPeriod === 'last_year') return isWithinInterval(d, { start: startOfMonth(subMonths(now, 11)), end: endOfMonth(now) });
    if (filterPeriod === 'this_year') return isWithinInterval(d, { start: startOfYear(new Date(selectedYear, 0, 1)), end: endOfYear(new Date(selectedYear, 0, 1)) });
    if (filterPeriod === 'custom') {
      if (filterStartDate && d < parseISO(filterStartDate)) return false;
      if (filterEndDate && d > parseISO(filterEndDate)) return false;
    }
    return true;
  };

  // Filtered partner shared expenses (apply period + search + onlyShared logic)
  const filteredPartnerShared = useMemo(() => {
    if (!permissions?.couple_expenses || !connection) return [];
    return partnerSharedExpenses.filter(se => {
      if (!isInPeriod(se.date)) return false;
      if (categorySearch.trim()) {
        const search = categorySearch.toLowerCase();
        const desc = se.description?.toLowerCase() || '';
        const cat = se.couple_category_name?.toLowerCase() || '';
        if (!desc.includes(search) && !cat.includes(search)) return false;
      }
      return true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerSharedExpenses, filterPeriod, filterStartDate, filterEndDate, categorySearch, selectedYear, permissions?.couple_expenses, connection]);

  // Unified display items (own transactions + partner shared), sorted by date desc
  type OwnItem = { kind: 'own'; tx: Transaction; sharedId?: string; creatorShare?: number; totalAmount?: number };
  type PartnerItem = { kind: 'partner'; se: SharedExpenseViewRow };
  type DisplayItem = OwnItem | PartnerItem;

  const displayItems = useMemo((): DisplayItem[] => {
    const ownItems: OwnItem[] = filteredTransactions.map(tx => {
      const se = mySharedExpenses.find(se => se.original_tx_id === tx.id);
      return {
        kind: 'own',
        tx,
        sharedId: se?.id,
        creatorShare: se?.creator_share_amount,
        totalAmount: se?.total_amount,
      };
    });
    const partnerItems: PartnerItem[] = filteredPartnerShared.map(se => ({
      kind: 'partner',
      se,
    }));
    const all: DisplayItem[] = [...ownItems, ...partnerItems];
    return all.sort((a, b) => {
      const dA = a.kind === 'own' ? a.tx.date : a.se.date;
      const dB = b.kind === 'own' ? b.tx.date : b.se.date;
      return dB.localeCompare(dA);
    });
  }, [filteredTransactions, filteredPartnerShared, mySharedExpenses]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">{t('Transazioni')}</h1>
            <p className="text-muted-foreground">{t('Gestisci entrate e uscite')}</p>
          </div>
          <Dialog open={open} onOpenChange={handleCloseDialog}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}><Plus className="w-4 h-4 mr-2" />{t('Nuova')}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingTransaction ? t('Modifica Transazione') : t('Nuova Transazione')}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant={type === 'expense' ? 'default' : 'outline'} onClick={() => setType('expense')}>{t('Uscita')}</Button>
                  <Button type="button" variant={type === 'income' ? 'default' : 'outline'} onClick={() => setType('income')}>{t('Entrata')}</Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>{t('Importo')}</Label>
                    <Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required />
                  </div>
                  <div>
                    <Label>{t('Valuta')}</Label>
                    <Select value={currency} onValueChange={v => setCurrency(v as CurrencyCode)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(CURRENCY_SYMBOLS) as CurrencyCode[]).map(code => (
                          <SelectItem key={code} value={code}>{code} ({CURRENCY_SYMBOLS[code]})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {currency !== 'EUR' && (
                      <p className="text-xs text-muted-foreground mt-1">{t('Il cambio EUR viene salvato al momento del salvataggio')}</p>
                    )}
                  </div>
                </div>
                <div><Label>{t('Categoria')}</Label>
                  <CategorySelect
                    categories={allCategories}
                    value={categoryId}
                    onValueChange={setCategoryId}
                    placeholder={t('Seleziona')}
                    filterType={type}
                  />
                </div>
                <div><Label>{t('Descrizione')}</Label><Input value={description} onChange={e => setDescription(e.target.value)} /></div>
                <div><Label>{t('Data')}</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>

                {/* Couple sharing toggle — only when creating an expense with active connection */}
                {!editingTransaction && permissions?.couple_expenses && connection && type === 'expense' && (
                  <div className="space-y-3 p-3 rounded-lg border border-border bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <HeartHandshake className="w-4 h-4 text-rose-400" />
                        <Label className="cursor-pointer">{t('Condividi con il partner')}</Label>
                      </div>
                      <Switch checked={isShared} onCheckedChange={setIsShared} />
                    </div>
                    {isShared && (
                      <>
                        <div>
                          <Label className="text-xs text-muted-foreground">{t('Divisione')}</Label>
                          <Select value={splitMode} onValueChange={(v) => setSplitMode(v as 'equal' | 'custom')}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="equal">{t('50 / 50 (predefinito)')}</SelectItem>
                              <SelectItem value="custom">{t('Importi personalizzati')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {splitMode === 'custom' && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs text-muted-foreground">{t('Quota tua (€)')}</Label>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0,00"
                                value={(() => {
                                  const total = parseAmount(amount);
                                  const partner = parseAmount(partnerAmount);
                                  if (!Number.isFinite(total) || !Number.isFinite(partner)) return '';
                                  return String(Math.round((total - partner) * 100) / 100);
                                })()}
                                disabled
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">{t('Quota partner (€)')}</Label>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0,00"
                                value={partnerAmount}
                                onChange={(e) => setPartnerAmount(e.target.value)}
                              />
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={isFetchingRate}>
                  {(() => {
                    if (isFetchingRate) return t('Recupero cambio...');
                    return editingTransaction ? t('Aggiorna') : t('Salva');
                  })()}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="glass rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Search className="w-4 h-4" />
            <span className="font-medium">{t('Filtri')}</span>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Period filter */}
            <div>
              <Label className="text-xs text-muted-foreground">{t('Periodo')}</Label>
              <Select value={filterPeriod} onValueChange={(v) => setFilterPeriod(v as FilterPeriod)}>
                <SelectTrigger>
                  <Calendar className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="this_month">{t('Questo mese')}</SelectItem>
                  <SelectItem value="last_month">{t('Scorso mese')}</SelectItem>
                  <SelectItem value="last_semester">{t('Ultimo semestre')}</SelectItem>
                  <SelectItem value="last_year">{t('Ultimi 12 mesi')}</SelectItem>
                  <SelectItem value="this_year">{t('Anno')}</SelectItem>
                  <SelectItem value="custom">{t('Personalizzato')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Category search */}
            <div>
              <Label className="text-xs text-muted-foreground">{t('Cerca categoria o note')}</Label>
              <Input
                placeholder={t('Cerca...')}
                value={categorySearch}
                onChange={e => setCategorySearch(e.target.value)}
                className="h-10"
              />
            </div>

            {/* Category filter */}
            <div>
              <Label className="text-xs text-muted-foreground">{t('Categoria')}</Label>
              <CategorySelect
                categories={allCategories}
                value={filterCategoryId}
                onValueChange={setFilterCategoryId}
                placeholder={t('Tutte')}
                showAllOption={true}
                allOptionLabel={t('Tutte le categorie')}
                allOptionValue="all"
              />
            </div>

            {/* Custom date range */}
            {filterPeriod === 'custom' && (
              <>
                <div>
                  <Label className="text-xs text-muted-foreground">{t('Da')}</Label>
                  <Input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">{t('A')}</Label>
                  <Input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} />
                </div>
              </>
            )}

            {/* Year selection */}
            {filterPeriod === 'this_year' && (
              <div>
                <Label className="text-xs text-muted-foreground">{t('Anno')}</Label>
                <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map(year => (
                      <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Only-shared toggle (visible only with couple_expenses + active connection) */}
          {permissions?.couple_expenses && connection && (
            <div className="flex items-center gap-2 pt-1">
              <Switch
                id="filter-shared"
                checked={filterOnlyShared}
                onCheckedChange={setFilterOnlyShared}
              />
              <Label htmlFor="filter-shared" className="cursor-pointer text-sm flex items-center gap-1">
                <HeartHandshake className="w-4 h-4 text-rose-400" />
                {t('Solo condivise')}
              </Label>
            </div>
          )}
        </div>

        {/* Transactions list — unified: own + partner shared */}
        <div className="glass rounded-xl divide-y divide-border">
          {displayItems.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">{t('Nessuna transazione trovata')}</p>
          ) : displayItems.map(item => {
            /* ---- Own transaction ---- */
            if (item.kind === 'own') {
              const tx = item.tx;
              const txCurrency = (tx.currency || 'EUR') as CurrencyCode;
              const rateEur = tx.exchange_rate_eur ?? 1;
              const amountInEur = tx.amount * rateEur;
              const sign = tx.type === 'income' ? '+' : '-';
              const colorClass = tx.type === 'income' ? 'text-success font-semibold' : 'text-destructive font-semibold';
              return (
                <div key={tx.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{tx.category?.icon || '💰'}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{tx.category?.name || t('Transazione')}</p>
                        {item.sharedId && (
                          <Badge variant="secondary" className="bg-rose-500/10 text-rose-400 border-rose-500/20 text-xs gap-1">
                            <HeartHandshake className="w-3 h-3" />
                            {t('Condivisa')}
                          </Badge>
                        )}
                      </div>
                      {tx.description && <p className="text-sm text-muted-foreground">{tx.description}</p>}
                      <p className="text-xs text-muted-foreground">{new Date(tx.date).toLocaleDateString('it-IT')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      {item.sharedId && item.creatorShare != null ? (
                        <div>
                          <span className={colorClass}>
                            {sign}{CURRENCY_SYMBOLS[txCurrency] || txCurrency}{Number(item.creatorShare).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <p className="text-xs text-muted-foreground">
                            {t('quota {{share}} / totale {{total}}', {
                              share: `${CURRENCY_SYMBOLS[txCurrency] || txCurrency}${Number(item.creatorShare).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                              total: `${CURRENCY_SYMBOLS[txCurrency] || txCurrency}${Number(tx.amount).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                            })}
                          </p>
                        </div>
                      ) : txCurrency === defaultCurrency ? (
                        <span className={colorClass}>
                          {sign}{CURRENCY_SYMBOLS[defaultCurrency]}{Number(tx.amount).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <div>
                          <span className={colorClass}>
                            {sign}{CURRENCY_SYMBOLS[defaultCurrency] || defaultCurrency}{amountInEur.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <p className="text-xs text-muted-foreground">
                            {sign}{CURRENCY_SYMBOLS[txCurrency] || txCurrency}{Number(tx.amount).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {txCurrency}
                          </p>
                        </div>
                      )}
                    </div>
                    {/* Creator: remove share link */}
                    {item.sharedId && connection && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" title={t('Rimuovi condivisione')}>
                            <HeartHandshake className="w-4 h-4 text-rose-400" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t('Rimuovere la condivisione?')}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t('La condivisione verrà rimossa. La tua transazione rimarrà nel tuo ledger ma il partner non la vedrà più.')}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t('Annulla')}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => removeMySharedExpense.mutate(item.sharedId!)}>
                              {t('Rimuovi condivisione')}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(tx)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openDeleteConfirm(tx)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            }

            /* ---- Partner shared expense ---- */
            const se = item.se;
            const seCurrency = se.currency as CurrencyCode;
            const shareEur = se.my_share_amount * (se.exchange_rate_eur ?? 1);
            const isArchived = !!connection?.revoked_at;
            return (
              <div key={`se-${se.id}`} className="flex items-center justify-between p-4 bg-rose-500/5">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">💑</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{se.couple_category_name || t('Spesa condivisa')}</p>
                      <Badge variant="secondary" className="bg-rose-500/10 text-rose-400 border-rose-500/20 text-xs gap-1">
                        <HeartHandshake className="w-3 h-3" />
                        {isArchived ? t('Archiviata') : t('Dal partner')}
                      </Badge>
                    </div>
                    {se.description && <p className="text-sm text-muted-foreground">{se.description}</p>}
                    <p className="text-xs text-muted-foreground">{new Date(se.date).toLocaleDateString('it-IT')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    {seCurrency === 'EUR' ? (
                      <span className="text-destructive font-semibold">
                        -{CURRENCY_SYMBOLS['EUR']}{Number(se.my_share_amount).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    ) : (
                      <div>
                        <span className="text-destructive font-semibold">
                          -{CURRENCY_SYMBOLS[defaultCurrency] || defaultCurrency}{shareEur.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <p className="text-xs text-muted-foreground">
                          -{CURRENCY_SYMBOLS[seCurrency] || seCurrency}{Number(se.my_share_amount).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {seCurrency}
                        </p>
                      </div>
                    )}
                  </div>
                  {/* Partner: remove share link (only on active connection) */}
                  {!isArchived && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" title={t('Rimuovi dalla tua lista')}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t('Rimuovere dalla tua lista?')}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t('La spesa condivisa verrà rimossa dalla tua lista. La transazione originale rimarrà nel ledger del tuo partner.')}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t('Annulla')}</AlertDialogCancel>
                          <AlertDialogAction onClick={() => removePartnerSharedExpense.mutate(se.id)}>
                            {t('Rimuovi')}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Delete confirmation dialog */}
        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('Conferma eliminazione')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('Sei sicuro di voler eliminare questa transazione? Questa azione non può essere annullata.')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('Annulla')}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>{t('Elimina')}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}
