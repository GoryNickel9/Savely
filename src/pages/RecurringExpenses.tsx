import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { parseAmount, todayLocalISO } from '@/lib/utils';
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
import { Plus, Edit2, Trash2, RefreshCw, Calendar, Sparkles, X, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRecurringCandidates } from '@/hooks/useRecurringCandidates';
import { Badge } from '@/components/ui/badge';

export default function RecurringExpenses() {
  const { t } = useTranslation();
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
  const [nextDueDate, setNextDueDate] = useState(todayLocalISO());

  const expenseCategories = categories.filter(c => c.type === 'expense');

  const resetForm = () => {
    setName('');
    setAmount('');
    setCategoryId('');
    setFrequency('monthly');
    setWeekInterval(1);
    setNextDueDate(todayLocalISO());
    setEditingExpense(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const expenseData = {
      name,
      amount: parseAmount(amount),
      category_id: categoryId || undefined,
      frequency,
      week_interval: frequency === 'weekly' ? weekInterval : undefined,
      next_due_date: nextDueDate,
    };

    try {
      if (editingExpense) {
        await updateRecurringExpense.mutateAsync({ id: editingExpense, ...expenseData });
        toast({ title: t('Uscita ricorrente aggiornata') });
      } else {
        await createRecurringExpense.mutateAsync(expenseData);
        toast({ title: t('Uscita ricorrente creata') });
      }
      setDialogOpen(false);
      resetForm();
    } catch (error) {
      toast({ title: t('Errore'), description: t('Operazione fallita'), variant: 'destructive' });
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

  // Detected recurring-expense suggestions.
  const { candidates, ignore: ignoreCandidate } = useRecurringCandidates();

  const acceptCandidate = (c: (typeof candidates)[0]) => {
    // Pre-fill the create form with the detected values and open it.
    setEditingExpense(null);
    setName(c.description);
    setAmount(String(c.medianAmount));
    setCategoryId('');
    setFrequency(c.frequency);
    setWeekInterval(1);
    setNextDueDate(c.suggestedNextDueDate);
    setDialogOpen(true);
    ignoreCandidate(c.normalizedKey);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRecurringExpense.mutateAsync(id);
      toast({ title: t('Uscita ricorrente eliminata') });
    } catch (error) {
      toast({ title: t('Errore'), description: t('Eliminazione fallita'), variant: 'destructive' });
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      await updateRecurringExpense.mutateAsync({ id, is_active: !isActive });
      toast({ title: isActive ? t('Uscita disattivata') : t('Uscita attivata') });
    } catch (error) {
      toast({ title: 'Errore', variant: 'destructive' });
    }
  };

  const handleProcessNow = async () => {
    try {
      const result = await processDueExpenses.mutateAsync();
      toast({
        title: t('Elaborazione completata'),
        description: result.processed > 0
          ? t('{{num}} transazioni create', { num: result.processed })
          : t('Nessuna uscita da elaborare'),
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
            <h1 className="text-3xl font-display font-bold">{t('Uscite Ricorrenti')}</h1>
            <p className="text-muted-foreground mt-1">{t('Automatizza le spese periodiche')}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleProcessNow} disabled={processDueExpenses.isPending}>
              <RefreshCw className={`w-4 h-4 mr-2 ${processDueExpenses.isPending ? 'animate-spin' : ''}`} />
              {t('Elabora Ora')}
            </Button>
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  {t('Nuova Uscita')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingExpense ? t('Modifica Uscita Ricorrente') : t('Nuova Uscita Ricorrente')}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label>{t('Nome')}</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t('Es. Abbonamento Netflix')}
                      required
                    />
                  </div>
                  <div>
                    <Label>{t('Importo (€)')}</Label>
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
                    <Label>{t('Categoria')}</Label>
                    <CategorySelect
                      categories={expenseCategories}
                      value={categoryId}
                      onValueChange={setCategoryId}
                      placeholder={t('Seleziona categoria')}
                      filterType="expense"
                    />
                  </div>
                  <div>
                    <Label>{t('Frequenza')}</Label>
                    <Select value={frequency} onValueChange={(v) => setFrequency(v as RecurringFrequency)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(FREQUENCY_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{t(label)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {frequency === 'weekly' && (
                    <div>
                      <Label>{t('Intervallo (settimane)')}</Label>
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
                    <Label>{t('Prossima Scadenza')}</Label>
                    <Input
                      type="date"
                      value={nextDueDate}
                      onChange={(e) => setNextDueDate(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={createRecurringExpense.isPending || updateRecurringExpense.isPending}>
                    {editingExpense ? t('Salva Modifiche') : t('Crea Uscita')}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Detected recurring-expense suggestions */}
        {candidates.length > 0 && (
          <div className="glass rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="font-medium">{t('Suggerimenti rilevati')}</h3>
              <Badge variant="secondary">{candidates.length}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('Abbiamo rilevato spese ricorrenti nelle tue transazioni. Aggiungile per automatizzarle.')}
            </p>
            <ul className="space-y-2">
              {candidates.map((c) => (
                <li
                  key={c.normalizedKey}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{c.description}</p>
                    <p className="text-sm text-muted-foreground">
                      {CURRENCY_SYMBOLS.EUR}{c.medianAmount.toLocaleString('it-IT', { minimumFractionDigits: 2 })} ·{' '}
                      {t(FREQUENCY_LABELS[c.frequency])} · {t('{{num}} occorrenze', { num: c.occurrenceCount })}
                      {c.confidence === 'high' && t(' · alta affidabilità')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button size="sm" onClick={() => acceptCandidate(c)}>
                      <Check className="w-4 h-4 mr-1" />
                      {t('Aggiungi')}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => ignoreCandidate(c.normalizedKey)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">{t('Caricamento...')}</div>
        ) : recurringExpenses.length === 0 ? (
          <div className="glass rounded-xl p-12 text-center">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">{t('Nessuna uscita ricorrente')}</h3>
            <p className="text-muted-foreground">{t('Crea la tua prima uscita ricorrente per automatizzare le spese periodiche.')}</p>
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
                          ? t(
                              (expense.week_interval || 1) > 1
                                ? 'Ogni {{num}} settimane'
                                : 'Ogni {{num}} settimana',
                              { num: expense.week_interval || 1 }
                            )
                          : t(FREQUENCY_LABELS[expense.frequency as RecurringFrequency])
                        }
                      </span>
                      <span>•</span>
                      <span>{t('Prossima: {{date}}', { date: new Date(expense.next_due_date).toLocaleDateString('it-IT') })}</span>
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
                        <AlertDialogTitle>{t('Eliminare questa uscita ricorrente?')}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('L\'uscita "{{name}}" verrà eliminata. Le transazioni già create rimarranno.', { name: expense.name })}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('Annulla')}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(expense.id)} className="bg-destructive hover:bg-destructive/90">
                          {t('Elimina')}
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
