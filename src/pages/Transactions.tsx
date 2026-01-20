import { useState, useMemo } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { TransactionType, Transaction } from '@/lib/types';
import { CategorySelect } from '@/components/CategorySelect';
import { CURRENCY_SYMBOLS } from '@/lib/constants';
import { Plus, Trash2, Pencil, Search, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, subYears, isWithinInterval, parseISO } from 'date-fns';

type FilterPeriod = 'this_month' | 'last_month' | 'last_semester' | 'last_year' | 'this_year' | 'custom';

export default function Transactions() {
  const { transactions, createTransaction, updateTransaction, deleteTransaction } = useTransactions();
  const { incomeCategories, expenseCategories, categories: allCategories } = useCategories();
  const { toast } = useToast();

  // Dialog states
  const [open, setOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);

  // Form states
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // Filter states
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('this_month');
  const [filterCategoryId, setFilterCategoryId] = useState<string>('all');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const categories = type === 'income' ? incomeCategories : expenseCategories;

  const resetForm = () => {
    setType('expense');
    setAmount('');
    setCategoryId('');
    setDescription('');
    setDate(new Date().toISOString().split('T')[0]);
    setEditingTransaction(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setOpen(true);
  };

  const openEditDialog = (t: Transaction) => {
    setEditingTransaction(t);
    setType(t.type);
    setAmount(String(t.amount));
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
      toast({ title: 'Transazione eliminata!' });
      setDeleteConfirmOpen(false);
      setTransactionToDelete(null);
    } catch {
      toast({ title: 'Errore durante l\'eliminazione', variant: 'destructive' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTransaction) {
        await updateTransaction.mutateAsync({
          id: editingTransaction.id,
          type,
          amount: parseFloat(amount),
          category_id: categoryId || undefined,
          description: description || undefined,
          date,
        });
        toast({ title: 'Transazione modificata!' });
      } else {
        await createTransaction.mutateAsync({
          type,
          amount: parseFloat(amount),
          category_id: categoryId || undefined,
          description: description || undefined,
          date,
        });
        toast({ title: 'Transazione aggiunta!' });
      }
      setOpen(false);
      resetForm();
    } catch {
      toast({ title: 'Errore', variant: 'destructive' });
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

      return true;
    });
  }, [transactions, filterPeriod, filterCategoryId, filterStartDate, filterEndDate, categorySearch, selectedYear]);

  // Extract unique years from transactions
  const availableYears = useMemo(() => {
    const years = transactions.map(t => new Date(t.date).getFullYear());
    return Array.from(new Set(years)).sort((a, b) => b - a);
  }, [transactions]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">Transazioni</h1>
            <p className="text-muted-foreground">Gestisci entrate e uscite</p>
          </div>
          <Dialog open={open} onOpenChange={handleCloseDialog}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}><Plus className="w-4 h-4 mr-2" />Nuova</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingTransaction ? 'Modifica Transazione' : 'Nuova Transazione'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant={type === 'expense' ? 'default' : 'outline'} onClick={() => setType('expense')}>Uscita</Button>
                  <Button type="button" variant={type === 'income' ? 'default' : 'outline'} onClick={() => setType('income')}>Entrata</Button>
                </div>
                <div><Label>Importo</Label><Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required /></div>
                <div><Label>Categoria</Label>
                  <CategorySelect
                    categories={allCategories}
                    value={categoryId}
                    onValueChange={setCategoryId}
                    placeholder="Seleziona"
                    filterType={type}
                  />
                </div>
                <div><Label>Descrizione</Label><Input value={description} onChange={e => setDescription(e.target.value)} /></div>
                <div><Label>Data</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
                <Button type="submit" className="w-full">{editingTransaction ? 'Aggiorna' : 'Salva'}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="glass rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Search className="w-4 h-4" />
            <span className="font-medium">Filtri</span>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Period filter */}
            <div>
              <Label className="text-xs text-muted-foreground">Periodo</Label>
              <Select value={filterPeriod} onValueChange={(v) => setFilterPeriod(v as FilterPeriod)}>
                <SelectTrigger>
                  <Calendar className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="this_month">Questo mese</SelectItem>
                  <SelectItem value="last_month">Scorso mese</SelectItem>
                  <SelectItem value="last_semester">Ultimo semestre</SelectItem>
                  <SelectItem value="last_year">Ultimi 12 mesi</SelectItem>
                  <SelectItem value="this_year">Anno</SelectItem>
                  <SelectItem value="custom">Personalizzato</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Category search */}
            <div>
              <Label className="text-xs text-muted-foreground">Cerca categoria o note</Label>
              <Input
                placeholder="Cerca..."
                value={categorySearch}
                onChange={e => setCategorySearch(e.target.value)}
                className="h-10"
              />
            </div>

            {/* Category filter */}
            <div>
              <Label className="text-xs text-muted-foreground">Categoria</Label>
              <CategorySelect
                categories={allCategories}
                value={filterCategoryId}
                onValueChange={setFilterCategoryId}
                placeholder="Tutte"
                showAllOption={true}
                allOptionLabel="Tutte le categorie"
                allOptionValue="all"
              />
            </div>

            {/* Custom date range */}
            {filterPeriod === 'custom' && (
              <>
                <div>
                  <Label className="text-xs text-muted-foreground">Da</Label>
                  <Input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">A</Label>
                  <Input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} />
                </div>
              </>
            )}

            {/* Year selection */}
            {filterPeriod === 'this_year' && (
              <div>
                <Label className="text-xs text-muted-foreground">Anno</Label>
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
        </div>

        {/* Transactions list */}
        <div className="glass rounded-xl divide-y divide-border">
          {filteredTransactions.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">Nessuna transazione trovata</p>
          ) : filteredTransactions.map(t => (
            <div key={t.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{t.category?.icon || '💰'}</span>
                <div>
                  <p className="font-medium">{t.category?.name || 'Transazione'}</p>
                  {t.description && (
                    <p className="text-sm text-muted-foreground">{t.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{new Date(t.date).toLocaleDateString('it-IT')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={t.type === 'income' ? 'text-success font-semibold' : 'text-destructive font-semibold'}>
                  {t.type === 'income' ? '+' : '-'}{CURRENCY_SYMBOLS.EUR}{Number(t.amount).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <Button variant="ghost" size="icon" onClick={() => openEditDialog(t)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => openDeleteConfirm(t)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Delete confirmation dialog */}
        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
              <AlertDialogDescription>
                Sei sicuro di voler eliminare questa transazione? Questa azione non può essere annullata.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Elimina</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}
