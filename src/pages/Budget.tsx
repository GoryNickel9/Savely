import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import MainLayout from '@/components/layout/MainLayout';
import { useBudgets } from '@/hooks/useBudgets';
import { useCategories } from '@/hooks/useCategories';
import { useTransactions } from '@/hooks/useTransactions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { CURRENCY_SYMBOLS } from '@/lib/constants';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { getMedianMonthlySpending, getGlobalMedianMonthlySpending, parseAmount } from '@/lib/utils';
import { MEDIAN_CALCULATION_DAYS } from '@/lib/constants';
import { CategorySelect } from '@/components/CategorySelect';

export default function Budget() {
  const { t } = useTranslation();
  const { budgets, createBudget, updateBudget, deleteBudget } = useBudgets();
  const { expenseCategories } = useCategories();
  const { transactions } = useTransactions();
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');

  // Edit budget dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editBudgetId, setEditBudgetId] = useState('');
  const [editAmount, setEditAmount] = useState('');

  // Calculate the 24-month period ending at current date
  const { startDate, endDate } = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 730);
    return { startDate: start, endDate: end };
  }, []);

  // Get median monthly spending for a category over the last 24 months
  const getMedianSpending = useMemo(() => {
    return (catId: string) => {
      return getMedianMonthlySpending({
        transactions,
        categoryId: catId,
        days: MEDIAN_CALCULATION_DAYS
      });
    };
  }, [transactions]);

  // Sort budgets alphabetically by category name
  const sortedBudgets = useMemo(() => {
    return [...budgets].sort((a, b) => {
      const nameA = a.category?.name?.toLowerCase() || '';
      const nameB = b.category?.name?.toLowerCase() || '';
      return nameA.localeCompare(nameB);
    });
  }, [budgets]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalExpected = budgets.reduce((sum, b) => sum + Number(b.amount), 0);
    // Calculate global median monthly spending (all categories together)
    const totalActual = getGlobalMedianMonthlySpending(transactions, MEDIAN_CALCULATION_DAYS);
    const difference = totalActual - totalExpected;
    return { totalExpected, totalActual, difference };
  }, [budgets, transactions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createBudget.mutateAsync({ category_id: categoryId, amount: parseAmount(amount) });
      toast(t('Budget creato!'));
      setOpen(false);
      setCategoryId('');
      setAmount('');
    } catch {
      toast.error(t('Errore'));
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateBudget.mutateAsync({ id: editBudgetId, amount: parseAmount(editAmount) });
      toast(t('Budget aggiornato!'));
      setEditOpen(false);
      setEditBudgetId('');
      setEditAmount('');
    } catch {
      toast.error(t('Errore'));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBudget.mutateAsync(id);
      toast(t('Budget eliminato!'));
    } catch {
      toast.error(t('Errore'));
    }
  };

  const openEditDialog = (budgetId: string, currentAmount: number) => {
    setEditBudgetId(budgetId);
    setEditAmount(currentAmount.toString());
    setEditOpen(true);
  };

  const usedCategoryIds = budgets.map(b => b.category_id);
  const availableCategories = expenseCategories.filter(c => !usedCategoryIds.includes(c.id));

  const periodLabel = `${startDate.toLocaleDateString('it-IT', { month: 'short', year: 'numeric' })} - ${endDate.toLocaleDateString('it-IT', { month: 'short', year: 'numeric' })}`;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-display font-bold">{t('Budget')}</h1>
            <p className="text-muted-foreground">{t('Mediana mensile (ultimi 730 giorni)')}</p>
          </div>
          <div className="flex gap-2">
            {/* Create Budget Dialog */}
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />{t('Nuovo Budget')}</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{t('Nuovo Budget')}</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <CategorySelect
                    categories={availableCategories}
                    value={categoryId}
                    onValueChange={setCategoryId}
                    placeholder={t('Categoria')}
                    filterType="expense"
                    disablePortal
                  />
                  <Input type="number" placeholder={t('Importo')} value={amount} onChange={e => setAmount(e.target.value)} required />
                  <Button type="submit" className="w-full">{t('Crea')}</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Totals Section */}
        {budgets.length > 0 && (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="glass rounded-xl p-6">
              <p className="text-sm text-muted-foreground mb-1">{t('Spesa mensile prevista')}</p>
              <p className="text-2xl font-bold">{CURRENCY_SYMBOLS.EUR}{totals.totalExpected.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="glass rounded-xl p-6">
              <p className="text-sm text-muted-foreground mb-1">{t('Spesa mediana mensile reale')}</p>
              <p className="text-2xl font-bold">{CURRENCY_SYMBOLS.EUR}{totals.totalActual.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="glass rounded-xl p-6">
              <p className="text-sm text-muted-foreground mb-1">{t('Differenza')}</p>
              <p className={`text-2xl font-bold ${totals.difference > 0 ? 'text-destructive' : totals.difference < 0 ? 'text-green-600' : ''}`}>
                {totals.difference > 0 ? '+' : ''}{CURRENCY_SYMBOLS.EUR}{totals.difference.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-4">
          {budgets.length === 0 ? (
            <div className="glass rounded-xl p-12 text-center text-muted-foreground">{t('Nessun budget impostato')}</div>
          ) : sortedBudgets.map(b => {
            const medianSpent = getMedianSpending(b.category_id);
            const percent = Math.min((medianSpent / Number(b.amount)) * 100, 100);
            const isOver = medianSpent > Number(b.amount);
            return (
              <div key={b.id} className="glass rounded-xl p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{b.category?.icon}</span>
                    <span className="font-medium">{b.category?.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={isOver ? 'text-destructive font-semibold' : 'text-muted-foreground'}>
                      {CURRENCY_SYMBOLS.EUR}{medianSpent.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {CURRENCY_SYMBOLS.EUR}{Number(b.amount).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(b.id, Number(b.amount))}
                      className="h-8 w-8"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(b.id)}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Progress value={percent} className={isOver ? '[&>div]:bg-destructive' : ''} />
              </div>
            );
          })}
        </div>

        {/* Edit Budget Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{t('Modifica Budget')}</DialogTitle></DialogHeader>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <Input type="number" placeholder={t('Nuovo importo')} value={editAmount} onChange={e => setEditAmount(e.target.value)} required />
              <Button type="submit" className="w-full" disabled={updateBudget.isPending}>
                {updateBudget.isPending ? t('Aggiornamento...') : t('Aggiorna')}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
