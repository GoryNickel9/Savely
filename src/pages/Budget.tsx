import MainLayout from '@/components/layout/MainLayout';
import { useBudgets } from '@/hooks/useBudgets';
import { useCategories } from '@/hooks/useCategories';
import { useTransactions } from '@/hooks/useTransactions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { CURRENCY_SYMBOLS } from '@/lib/types';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

// Calculate median of an array
const calculateMedian = (arr: number[]): number => {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export default function Budget() {
  const { budgets, createBudget, updateBudget, deleteBudget } = useBudgets();
  const { expenseCategories } = useCategories();
  const { transactions } = useTransactions();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');

  // Edit budget dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editBudgetId, setEditBudgetId] = useState('');
  const [editAmount, setEditAmount] = useState('');

  // Calculate the 18-month period ending at current date
  const { startDate, endDate } = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 18);
    return { startDate: start, endDate: end };
  }, []);

  // Get median monthly spending for a category over the last 18 months
  const getMedianSpending = useMemo(() => {
    return (catId: string) => {
      // Filter transactions for this category in the last 18 months
      const categoryTransactions = transactions.filter(t => {
        const txDate = new Date(t.date);
        return t.category_id === catId &&
               t.type === 'expense' &&
               txDate >= startDate &&
               txDate <= endDate;
      });

      // Group by month (year-month key)
      const monthlyTotals: Record<string, number> = {};
      categoryTransactions.forEach(t => {
        const date = new Date(t.date);
        const key = `${date.getFullYear()}-${date.getMonth()}`;
        monthlyTotals[key] = (monthlyTotals[key] || 0) + Number(t.amount);
      });

      // Get array of monthly totals and calculate median
      const totalsArray = Object.values(monthlyTotals);
      return calculateMedian(totalsArray);
    };
  }, [transactions, startDate, endDate]);

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
    // Calculate total actual spending from categories WITH budget only
    const totalActual = budgets.reduce((sum, b) => sum + getMedianSpending(b.category_id), 0);
    const difference = totalActual - totalExpected;
    return { totalExpected, totalActual, difference };
  }, [budgets, getMedianSpending]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createBudget.mutateAsync({ category_id: categoryId, amount: parseFloat(amount) });
      toast({ title: 'Budget creato!' });
      setOpen(false);
      setCategoryId('');
      setAmount('');
    } catch {
      toast({ title: 'Errore', variant: 'destructive' });
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateBudget.mutateAsync({ id: editBudgetId, amount: parseFloat(editAmount) });
      toast({ title: 'Budget aggiornato!' });
      setEditOpen(false);
      setEditBudgetId('');
      setEditAmount('');
    } catch {
      toast({ title: 'Errore', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBudget.mutateAsync(id);
      toast({ title: 'Budget eliminato!' });
    } catch {
      toast({ title: 'Errore', variant: 'destructive' });
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
            <h1 className="text-3xl font-display font-bold">Budget</h1>
            <p className="text-muted-foreground">Mediana mensile ({periodLabel})</p>
          </div>
          <div className="flex gap-2">
            {/* Create Budget Dialog */}
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Nuovo Budget</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nuovo Budget</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
                    <SelectContent>{availableCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="number" placeholder="Importo" value={amount} onChange={e => setAmount(e.target.value)} required />
                  <Button type="submit" className="w-full">Crea</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Totals Section */}
        {budgets.length > 0 && (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="glass rounded-xl p-6">
              <p className="text-sm text-muted-foreground mb-1">Spesa mediana mensile prevista</p>
              <p className="text-2xl font-bold">{CURRENCY_SYMBOLS.EUR}{totals.totalExpected.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="glass rounded-xl p-6">
              <p className="text-sm text-muted-foreground mb-1">Spesa mediana mensile reale</p>
              <p className="text-2xl font-bold">{CURRENCY_SYMBOLS.EUR}{totals.totalActual.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="glass rounded-xl p-6">
              <p className="text-sm text-muted-foreground mb-1">Differenza</p>
              <p className={`text-2xl font-bold ${totals.difference > 0 ? 'text-destructive' : totals.difference < 0 ? 'text-green-600' : ''}`}>
                {totals.difference > 0 ? '+' : ''}{CURRENCY_SYMBOLS.EUR}{totals.difference.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-4">
          {budgets.length === 0 ? (
            <div className="glass rounded-xl p-12 text-center text-muted-foreground">Nessun budget impostato</div>
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
            <DialogHeader><DialogTitle>Modifica Budget</DialogTitle></DialogHeader>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <Input type="number" placeholder="Nuovo importo" value={editAmount} onChange={e => setEditAmount(e.target.value)} required />
              <Button type="submit" className="w-full" disabled={updateBudget.isPending}>
                {updateBudget.isPending ? 'Aggiornamento...' : 'Aggiorna'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
