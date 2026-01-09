import { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useRecurringExpenses, FREQUENCY_LABELS, RecurringFrequency } from '@/hooks/useRecurringExpenses';
import { useCategories } from '@/hooks/useCategories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CategorySelect } from '@/components/CategorySelect';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { CURRENCY_SYMBOLS } from '@/lib/constants';
import { Plus, Edit2, Trash2, RefreshCw, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function RecurringExpenses() {
  const { recurringExpenses, isLoading, createRecurringExpense, updateRecurringExpense, deleteRecurringExpense, processDueExpenses } = useRecurringExpenses();
  const { categories } = useCategories();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<string | null>(null);
  
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [weekInterval, setWeekInterval] = useState(1);
  const [nextDueDate, setNextDueDate] = useState(new Date().toISOString().split('T')[0]);

  const expenseCategories = categories.filter(c => c.type === 'expense');

  // Process due expenses on page load
  useEffect(() => {
    processDueExpenses.mutate(undefined, {
      onSuccess: (result) => {
        if (result.processed > 0) {
          toast({
            title: 'Uscite ricorrenti elaborate',
            description: `${result.processed} transazioni create automaticamente`,
          });
        }
      },
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const resetForm = () => {
    setName('');
    setAmount('');
    setCategoryId('');
    setFrequency('monthly');
    setWeekInterval(1);
    setNextDueDate(new Date().toISOString().split('T')[0]);
    setEditingExpense(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const expenseData = {
      name,
      amount: parseFloat(amount),
      category_id: categoryId || undefined,
      frequency,
      week_interval: frequency === 'weekly' ? weekInterval : undefined,
      next_due_date: nextDueDate,
    };

    try {
      if (editingExpense) {
        await updateRecurringExpense.mutateAsync({ id: editingExpense, ...expenseData });
        toast({ title: 'Uscita ricorrente aggiornata' });
      } else {
        await createRecurringExpense.mutateAsync(expenseData);
        toast({ title: 'Uscita ricorrente creata' });
      }
      setDialogOpen(false);
      resetForm();
    } catch (error) {
      toast({ title: 'Errore', description: 'Operazione fallita', variant: 'destructive' });
    }
  };

  const handleEdit = (expense: typeof recurringExpenses[0]) => {
    setEditingExpense(expense.id);
    setName(expense.name);
    setAmount(String(expense.amount));
    setCategoryId(expense.category_id || '');
    setFrequency(expense.frequency as RecurringFrequency);
    setWeekInterval(expense.week_interval || 1);
    setNextDueDate(expense.next_due_date);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRecurringExpense.mutateAsync(id);
      toast({ title: 'Uscita ricorrente eliminata' });
    } catch (error) {
      toast({ title: 'Errore', description: 'Eliminazione fallita', variant: 'destructive' });
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      await updateRecurringExpense.mutateAsync({ id, is_active: !isActive });
      toast({ title: isActive ? 'Uscita disattivata' : 'Uscita attivata' });
    } catch (error) {
      toast({ title: 'Errore', variant: 'destructive' });
    }
  };

  const handleProcessNow = async () => {
    try {
      const result = await processDueExpenses.mutateAsync();
      toast({
        title: 'Elaborazione completata',
        description: result.processed > 0 
          ? `${result.processed} transazioni create` 
          : 'Nessuna uscita da elaborare',
      });
    } catch (error) {
      toast({ title: 'Errore', variant: 'destructive' });
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">Uscite Ricorrenti</h1>
            <p className="text-muted-foreground mt-1">Automatizza le spese periodiche</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleProcessNow} disabled={processDueExpenses.isPending}>
              <RefreshCw className={`w-4 h-4 mr-2 ${processDueExpenses.isPending ? 'animate-spin' : ''}`} />
              Elabora Ora
            </Button>
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Nuova Uscita
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingExpense ? 'Modifica' : 'Nuova'} Uscita Ricorrente</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label>Nome</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Es. Abbonamento Netflix"
                      required
                    />
                  </div>
                  <div>
                    <Label>Importo (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div>
                    <Label>Categoria</Label>
                    <CategorySelect
                      categories={expenseCategories}
                      value={categoryId}
                      onValueChange={setCategoryId}
                      placeholder="Seleziona categoria"
                      filterType="expense"
                    />
                  </div>
                  <div>
                    <Label>Frequenza</Label>
                    <Select value={frequency} onValueChange={(v) => setFrequency(v as RecurringFrequency)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(FREQUENCY_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {frequency === 'weekly' && (
                    <div>
                      <Label>Intervallo (settimane)</Label>
                      <Input
                        type="number"
                        min="1"
                        value={weekInterval}
                        onChange={(e) => setWeekInterval(parseInt(e.target.value) || 1)}
                        required
                      />
                    </div>
                  )}
                  <div>
                    <Label>Prossima Scadenza</Label>
                    <Input
                      type="date"
                      value={nextDueDate}
                      onChange={(e) => setNextDueDate(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={createRecurringExpense.isPending || updateRecurringExpense.isPending}>
                    {editingExpense ? 'Salva Modifiche' : 'Crea Uscita'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Caricamento...</div>
        ) : recurringExpenses.length === 0 ? (
          <div className="glass rounded-xl p-12 text-center">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">Nessuna uscita ricorrente</h3>
            <p className="text-muted-foreground">Crea la tua prima uscita ricorrente per automatizzare le spese periodiche.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {recurringExpenses.map((expense) => (
              <div key={expense.id} className={`glass rounded-xl p-4 flex items-center justify-between ${!expense.is_active ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-4">
                  <span className="text-2xl">{expense.category?.icon || '💳'}</span>
                  <div>
                    <p className="font-medium">{expense.name}</p>
                    <div className="flex gap-2 text-sm text-muted-foreground">
                      <span>
                        {expense.frequency === 'weekly'
                          ? `Ogni ${expense.week_interval || 1} settimana${(expense.week_interval || 1) > 1 ? 'e' : ''}`
                          : FREQUENCY_LABELS[expense.frequency as RecurringFrequency]
                        }
                      </span>
                      <span>•</span>
                      <span>Prossima: {new Date(expense.next_due_date).toLocaleDateString('it-IT')}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-semibold text-destructive">
                    -{CURRENCY_SYMBOLS.EUR}{Number(expense.amount).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                  </span>
                  <Switch
                    checked={expense.is_active}
                    onCheckedChange={() => handleToggleActive(expense.id, expense.is_active)}
                  />
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(expense)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Eliminare questa uscita ricorrente?</AlertDialogTitle>
                        <AlertDialogDescription>
                          L'uscita "{expense.name}" verrà eliminata. Le transazioni già create rimarranno.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annulla</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(expense.id)} className="bg-destructive hover:bg-destructive/90">
                          Elimina
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
