import { useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { useCouplePairStatus } from '@/hooks/useCouplePairStatus';
import { useSharedExpenses } from '@/hooks/useSharedExpenses';
import { useCoupleBudgets } from '@/hooks/useCoupleBudgets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { CURRENCY_SYMBOLS } from '@/lib/constants';
import { Plus, Edit2, Trash2, HeartHandshake } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getMedianMonthlySpendingShared } from '@/lib/coupleExpenses';
import { parseAmount } from '@/lib/utils';

export default function CoupleBudget() {
  const { connection, isLoading: statusLoading } = useCouplePairStatus();
  const { sharedExpenses, isLoading: expensesLoading } = useSharedExpenses(connection?.id ?? null);
  const { budgets, availableCategories, isLoading: budgetsLoading, createBudget, updateBudget, deleteBudget } =
    useCoupleBudgets(connection?.id ?? null, sharedExpenses);
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [amount, setAmount] = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [editBudgetId, setEditBudgetId] = useState('');
  const [editAmount, setEditAmount] = useState('');

  const isLoading = statusLoading || expensesLoading || budgetsLoading;

  const isArchived = !!connection?.revoked_at;

  // Categories that already have a budget
  const usedCategories = new Set(budgets.map(b => b.couple_category_name));
  const freeCategories = availableCategories.filter(c => !usedCategories.has(c));

  // Sorted budgets
  const sortedBudgets = useMemo(
    () => [...budgets].sort((a, b) => a.couple_category_name.localeCompare(b.couple_category_name)),
    [budgets]
  );

  // Totals
  const totals = useMemo(() => {
    const totalExpected = budgets.reduce((s, b) => s + Number(b.amount), 0);
    const totalActual = getMedianMonthlySpendingShared(sharedExpenses);
    return { totalExpected, totalActual, difference: totalActual - totalExpected };
  }, [budgets, sharedExpenses]);

  // Guard: no connection → redirect to settings (after all hooks)
  if (!isLoading && !connection) {
    return <Navigate to="/settings" replace />;
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createBudget.mutateAsync({ couple_category_name: categoryName, amount: parseAmount(amount) });
      toast({ title: 'Budget coppia creato!' });
      setOpen(false);
      setCategoryName('');
      setAmount('');
    } catch {
      toast({ title: 'Errore', variant: 'destructive' });
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateBudget.mutateAsync({ id: editBudgetId, amount: parseAmount(editAmount) });
      toast({ title: 'Budget aggiornato!' });
      setEditOpen(false);
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

  const openEdit = (id: string, currentAmount: number) => {
    setEditBudgetId(id);
    setEditAmount(currentAmount.toString());
    setEditOpen(true);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-display font-bold flex items-center gap-2">
              <HeartHandshake className="w-8 h-8 text-rose-400" />
              Budget Coppia
            </h1>
            <p className="text-muted-foreground">
              {isArchived
                ? 'Connessione archiviata — sola lettura'
                : 'Budget basato sulla mediana mensile delle spese condivise'}
            </p>
          </div>

          {!isArchived && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button disabled={freeCategories.length === 0}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nuovo Budget
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nuovo Budget Coppia</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Categoria condivisa</label>
                    {freeCategories.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Nessuna categoria disponibile. Condividi prima delle spese.
                      </p>
                    ) : (
                      <Select value={categoryName} onValueChange={setCategoryName}>
                        <SelectTrigger><SelectValue placeholder="Seleziona categoria" /></SelectTrigger>
                        <SelectContent>
                          {freeCategories.map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Importo mensile (€)"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    required
                  />
                  <Button type="submit" className="w-full" disabled={!categoryName || createBudget.isPending}>
                    {createBudget.isPending ? 'Creazione...' : 'Crea Budget'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="text-center text-muted-foreground py-12">Caricamento...</div>
        )}

        {/* No shared expenses yet */}
        {!isLoading && sharedExpenses.length === 0 && (
          <div className="glass rounded-xl p-12 text-center text-muted-foreground">
            <HeartHandshake className="w-12 h-12 mx-auto mb-4 text-rose-400/50" />
            <p>Nessuna spesa condivisa trovata.</p>
            <p className="text-sm mt-1">Condividi prima delle spese dalla pagina Transazioni.</p>
          </div>
        )}

        {/* Totals */}
        {!isLoading && budgets.length > 0 && (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="glass rounded-xl p-6">
              <p className="text-sm text-muted-foreground mb-1">Budget mensile previsto</p>
              <p className="text-2xl font-bold">
                {CURRENCY_SYMBOLS.EUR}{totals.totalExpected.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="glass rounded-xl p-6">
              <p className="text-sm text-muted-foreground mb-1">Spesa mediana mensile reale</p>
              <p className="text-2xl font-bold">
                {CURRENCY_SYMBOLS.EUR}{totals.totalActual.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="glass rounded-xl p-6">
              <p className="text-sm text-muted-foreground mb-1">Differenza</p>
              <p className={`text-2xl font-bold ${totals.difference > 0 ? 'text-destructive' : totals.difference < 0 ? 'text-green-500' : ''}`}>
                {totals.difference > 0 ? '+' : ''}
                {CURRENCY_SYMBOLS.EUR}{totals.difference.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        )}

        {/* Budget list */}
        {!isLoading && (
          <div className="grid gap-4">
            {budgets.length === 0 ? (
              sharedExpenses.length > 0 && (
                <div className="glass rounded-xl p-12 text-center text-muted-foreground">
                  Nessun budget impostato. Crea il primo budget per una delle categorie condivise.
                </div>
              )
            ) : sortedBudgets.map(b => {
              const medianSpent = getMedianMonthlySpendingShared(sharedExpenses, b.couple_category_name);
              const percent = b.amount > 0 ? Math.min((medianSpent / Number(b.amount)) * 100, 100) : 0;
              const isOver = medianSpent > Number(b.amount);
              return (
                <div key={b.id} className="glass rounded-xl p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <HeartHandshake className="w-5 h-5 text-rose-400" />
                      <span className="font-medium">{b.couple_category_name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={isOver ? 'text-destructive font-semibold' : 'text-muted-foreground'}>
                        {CURRENCY_SYMBOLS.EUR}{medianSpent.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        {' '}/ {CURRENCY_SYMBOLS.EUR}{Number(b.amount).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      {!isArchived && (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(b.id, Number(b.amount))}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(b.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <Progress value={percent} className={isOver ? '[&>div]:bg-destructive' : ''} />
                </div>
              );
            })}
          </div>
        )}

        {/* Edit dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Modifica Budget</DialogTitle></DialogHeader>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <Input
                type="number"
                step="0.01"
                placeholder="Nuovo importo (€)"
                value={editAmount}
                onChange={e => setEditAmount(e.target.value)}
                required
              />
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
