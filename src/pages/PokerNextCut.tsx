import { useState, useMemo, useEffect } from 'react';
import { ArrowLeft, RefreshCw, Edit2, Check, X, Plus, Trash2 } from 'lucide-react';
import { useBudgets } from '@/hooks/useBudgets';
import { useTransactions } from '@/hooks/useTransactions';
import { usePokerManualExpenses } from '@/hooks/usePokerManualExpenses';
import { usePokerNextCut } from '@/hooks/usePokerNextCut';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { CURRENCY_SYMBOLS } from '@/lib/constants';
import MainLayout from '@/components/layout/MainLayout';
import { getGlobalMedianMonthlySpending, parseAmount } from '@/lib/utils';
import { MEDIAN_CALCULATION_DAYS } from '@/lib/constants';
import { useTranslation } from 'react-i18next';

export default function PokerNextCut() {
  const { t } = useTranslation();
  const { budgets } = useBudgets();
  const { transactions } = useTransactions();
  const { expenses: manualExpenses, addExpense: addExpenseMutation, updateExpense: updateExpenseMutation, deleteExpense: deleteExpenseMutation } = usePokerManualExpenses();
  const { nextCut, loading: nextCutLoading, updateDeal, updateProfitLoss, updateAmount } = usePokerNextCut();
  const { toast } = useToast();
  
  const [editingProfitLoss, setEditingProfitLoss] = useState(false);
  const [editingProfitLossValue, setEditingProfitLossValue] = useState('');
  const [editingDeal, setEditingDeal] = useState(false);
  const [editingDealValue, setEditingDealValue] = useState('');

  // Create expense dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [newExpenseName, setNewExpenseName] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');

  // Edit expense dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<{ id: string; name: string; amount: number } | null>(null);
  const [editingExpenseAmount, setEditingExpenseAmount] = useState('');

  // Spesa mensile calcolata (dal Budget, basata su transazioni ultimi 730 giorni)
  // Questo valore è calcolato automaticamente e non modificabile dall'utente
  const budgetMonthlySpending = useMemo(() => {
    // Calculate global median monthly spending (all categories together)
    return getGlobalMedianMonthlySpending(transactions, MEDIAN_CALCULATION_DAYS);
  }, [transactions]);

  // Calculate manual monthly spending
  const manualMonthlySpending = useMemo(() => {
    return manualExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  }, [manualExpenses]);

  // Total monthly spending (budget + manual)
  const totalMonthlySpending = budgetMonthlySpending + manualMonthlySpending;

  // Update nextCut.amount in database when totalMonthlySpending changes
  useEffect(() => {
    if (nextCut && nextCut.amount !== totalMonthlySpending) {
      updateAmount(totalMonthlySpending);
    }
  }, [totalMonthlySpending, nextCut, updateAmount]);

  // Calculate Next Cut Gross (nascosto, usato solo nei calcoli)
  const calculateNextCutGross = (deal: number) => {
    return totalMonthlySpending / deal;
  };

  // Calculate "Quanto manca per il prossimo cut"
  const need = useMemo(() => {
    if (!nextCut) return 0;
    const gross = calculateNextCutGross(nextCut.deal);
    return gross - nextCut.profit_loss;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextCut?.deal, nextCut?.profit_loss, totalMonthlySpending]);

  // Update Profit/Loss
  const handleUpdateProfitLoss = async () => {
    if (!editingProfitLossValue || !nextCut) return;
    
    try {
      await updateProfitLoss(parseAmount(editingProfitLossValue));
      toast({ title: t('P/L Attuale aggiornato!') });
      setEditingProfitLoss(false);
      setEditingProfitLossValue('');
    } catch (error) {
      toast({
        title: t('Errore'),
        description: t('Impossibile aggiornare il P/L Attuale'),
        variant: 'destructive'
      });
    }
  };

  // Update Deal
  const handleUpdateDeal = async () => {
    if (!editingDealValue || !nextCut) return;
    
    try {
      await updateDeal(parseAmount(editingDealValue));
      toast({ title: t('Deal aggiornato!') });
      setEditingDeal(false);
      setEditingDealValue('');
    } catch (error) {
      toast({
        title: t('Errore'),
        description: t('Impossibile aggiornare il deal'),
        variant: 'destructive'
      });
    }
  };

  // Add manual expense
  const addManualExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpenseName || !newExpenseAmount) return;
    
    try {
      await addExpenseMutation.mutateAsync({ name: newExpenseName, amount: parseAmount(newExpenseAmount) });
      toast({ title: t('Spesa aggiunta!') });
      setCreateOpen(false);
      setNewExpenseName('');
      setNewExpenseAmount('');
    } catch (error) {
      toast({
        title: t('Errore'),
        description: t('Impossibile aggiungere la spesa'),
        variant: 'destructive'
      });
    }
  };

  // Edit manual expense
  const updateManualExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense || !editingExpenseAmount) return;
    
    try {
      await updateExpenseMutation.mutateAsync({ id: editingExpense.id, amount: parseAmount(editingExpenseAmount) });
      toast({ title: t('Spesa aggiornata!') });
      setEditOpen(false);
      setEditingExpense(null);
      setEditingExpenseAmount('');
    } catch (error) {
      toast({
        title: t('Errore'),
        description: t('Impossibile aggiornare la spesa'),
        variant: 'destructive'
      });
    }
  };

  // Delete manual expense
  const handleDeleteExpense = async (id: string) => {
    try {
      await deleteExpenseMutation.mutateAsync(id);
      toast({ title: t('Spesa eliminata!') });
    } catch (error) {
      toast({
        title: t('Errore'),
        description: t('Impossibile eliminare la spesa'),
        variant: 'destructive'
      });
    }
  };

  const openEditDialog = (expense: { id: string; name: string; amount: number }) => {
    setEditingExpense(expense);
    setEditingExpenseAmount(expense.amount.toString());
    setEditOpen(true);
  };

  if (nextCutLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header with Back Button */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => window.history.back()}
            className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-colors border border-slate-700"
          >
            <ArrowLeft className="w-5 h-5 text-slate-300" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white">{t('Next Cut')}</h1>
            <p className="text-slate-400">{t('Gestisci il tuo Next Cut')}</p>
          </div>
        </div>

        {/* Monthly Spending Section */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="border-b border-slate-700 flex items-center justify-between">
            <CardTitle className="text-white">{t('Spesa Mensile')}</CardTitle>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  {t('Aggiungi nuova spesa')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('Nuova spesa')}</DialogTitle>
                </DialogHeader>
                <form onSubmit={addManualExpense} className="space-y-4">
                  <Input
                    type="text"
                    placeholder={t('Nome')}
                    value={newExpenseName}
                    onChange={e => setNewExpenseName(e.target.value)}
                    required
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder={t('Importo')}
                    value={newExpenseAmount}
                    onChange={e => setNewExpenseAmount(e.target.value)}
                    required
                  />
                  <Button type="submit" className="w-full">
                    {t('Aggiungi')}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {/* Total from Budget */}
              <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <p className="text-sm text-slate-400 mb-2">{t('Spesa mensile')}</p>
                <p className="text-2xl font-bold text-white">
                  {CURRENCY_SYMBOLS.EUR}{budgetMonthlySpending.toFixed(2)}
                </p>
                <p className="text-xs text-slate-500 mt-2">{t('Calcolato automaticamente dagli ultimi 730 giorni di transazioni')}</p>
              </div>

              {/* Manual expenses list */}
              {manualExpenses.length > 0 && (
                <div className="space-y-3 mt-4">
                  <p className="text-sm text-slate-400">{t('Spese aggiuntive')}</p>
                  {manualExpenses.map(exp => (
                    <div key={exp.id} className="p-4 bg-slate-900/30 rounded-lg border border-slate-700">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-white">{exp.name}</p>
                          <p className="text-sm text-slate-400">
                            {CURRENCY_SYMBOLS.EUR}{exp.amount.toFixed(2)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(exp)}
                            className="h-8 w-8"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteExpense(exp.id)}
                            className="h-8 w-8 text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </div>
        </CardContent>
          </Card>

        {/* Edit Expense Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
            <DialogTitle>{t('Modifica spesa')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={updateManualExpense} className="space-y-4">
            <Input
              type="number"
              step="0.01"
              placeholder={t('Nuovo importo')}
              value={editingExpenseAmount}
              onChange={e => setEditingExpenseAmount(e.target.value)}
              required
            />
            <Button type="submit" className="w-full">
              {t('Aggiorna')}
            </Button>
          </form>
          </DialogContent>
        </Dialog>

        {/* Next Cut Section */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="border-b border-slate-700">
            <CardTitle className="text-white">{t('Next Cut')}</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="p-4 bg-slate-900/30 rounded-lg border border-slate-700">
              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">{t('Next Cut Net')}</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">{t('Deal')}</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">{t('P/L Attuale')}</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">{t('Quanto manca')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="py-4 px-4">
                        <div className="font-medium text-white text-lg">€{totalMonthlySpending.toFixed(2)}</div>
                      </td>
                      <td className="py-4 px-4">
                        {editingDeal ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="0.01"
                              value={editingDealValue}
                              onChange={(e) => setEditingDealValue(e.target.value)}
                              className="w-24 px-3 py-2 bg-slate-900/50 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleUpdateDeal();
                                if (e.key === 'Escape') {
                                  setEditingDeal(false);
                                  setEditingDealValue('');
                                }
                              }}
                            />
                            <button
                              onClick={handleUpdateDeal}
                              className="p-1.5 text-green-400 hover:text-green-300 bg-slate-800 rounded"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingDeal(false);
                                setEditingDealValue('');
                              }}
                              className="p-1.5 text-red-400 hover:text-red-300 bg-slate-800 rounded"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="font-medium text-white text-lg">
                              {nextCut?.deal.toFixed(2) || '0.00'}
                            </div>
                            <button
                              onClick={() => {
                                setEditingDeal(true);
                                setEditingDealValue(nextCut?.deal.toString() || '0.55');
                              }}
                              className="p-1 text-slate-400 hover:text-blue-400"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        {editingProfitLoss ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="0.01"
                              value={editingProfitLossValue}
                              onChange={(e) => setEditingProfitLossValue(e.target.value)}
                              className="w-28 px-3 py-2 bg-slate-900/50 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleUpdateProfitLoss();
                                if (e.key === 'Escape') {
                                  setEditingProfitLoss(false);
                                  setEditingProfitLossValue('');
                                }
                              }}
                            />
                            <button
                              onClick={handleUpdateProfitLoss}
                              className="p-1.5 text-green-400 hover:text-green-300 bg-slate-800 rounded"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingProfitLoss(false);
                                setEditingProfitLossValue('');
                              }}
                              className="p-1.5 text-red-400 hover:text-red-300 bg-slate-800 rounded"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="font-medium text-white text-lg">
                              €{nextCut?.profit_loss.toFixed(2) || '0.00'}
                            </div>
                            <button
                              onClick={() => {
                                setEditingProfitLoss(true);
                                setEditingProfitLossValue(nextCut?.profit_loss.toString() || '0');
                              }}
                              className="p-1 text-slate-400 hover:text-blue-400"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <div className={`font-medium text-lg ${need > 0 ? 'text-red-400' : 'text-green-400'}`}>
                          €{need.toFixed(2)}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Info section */}
              <div className="mt-4 pt-4 border-t border-slate-700">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{t('Clicca sui valori "Deal" e "P/L Attuale" per modificarli')}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}