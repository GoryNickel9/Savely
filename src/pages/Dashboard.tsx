import { useTransactions } from '@/hooks/useTransactions';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useBudgets } from '@/hooks/useBudgets';
import { CURRENCY_SYMBOLS } from '@/lib/types';
import StatCard from '@/components/dashboard/StatCard';
import MainLayout from '@/components/layout/MainLayout';
import { Wallet, TrendingUp, TrendingDown, PieChart } from 'lucide-react';

export default function Dashboard() {
  const { transactions } = useTransactions();
  const { totalValue, totalGainPercent } = usePortfolio();
  const { budgets } = useBudgets();

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  // Monthly income/expenses
  const monthlyIncome = transactions
    .filter(t => t.type === 'income' && new Date(t.date).getMonth() === currentMonth && new Date(t.date).getFullYear() === currentYear)
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const monthlyExpenses = transactions
    .filter(t => t.type === 'expense' && new Date(t.date).getMonth() === currentMonth && new Date(t.date).getFullYear() === currentYear)
    .reduce((sum, t) => sum + Number(t.amount), 0);

  // Annual income/expenses for net worth calculation
  const annualIncome = transactions
    .filter(t => t.type === 'income' && new Date(t.date).getFullYear() === currentYear)
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const annualExpenses = transactions
    .filter(t => t.type === 'expense' && new Date(t.date).getFullYear() === currentYear)
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalBudget = budgets.reduce((sum, b) => sum + Number(b.amount), 0);
  
  // Patrimonio Netto = Portfolio + cashflow annuale (entrata annuale - uscita annuale)
  const annualCashflow = annualIncome - annualExpenses;
  const netWorth = totalValue + annualCashflow;

  return (
    <MainLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-display font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Panoramica delle tue finanze</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Patrimonio Netto"
            value={`${CURRENCY_SYMBOLS.EUR}${netWorth.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={<Wallet className="w-6 h-6" />}
          />
          <StatCard
            title="Entrate del Mese"
            value={`${CURRENCY_SYMBOLS.EUR}${monthlyIncome.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={<TrendingUp className="w-6 h-6" />}
            className="border-l-4 border-l-success"
          />
          <StatCard
            title="Uscite del Mese"
            value={`${CURRENCY_SYMBOLS.EUR}${monthlyExpenses.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={<TrendingDown className="w-6 h-6" />}
            className="border-l-4 border-l-destructive"
          />
          <StatCard
            title="Portfolio"
            value={`${CURRENCY_SYMBOLS.EUR}${totalValue.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={<PieChart className="w-6 h-6" />}
            trend={{ value: totalGainPercent, isPositive: totalGainPercent >= 0 }}
          />
        </div>

        <div className="glass rounded-xl p-6">
          <h2 className="text-xl font-display font-semibold mb-4">Ultime Transazioni</h2>
          {transactions.slice(0, 5).length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nessuna transazione ancora. Inizia ad aggiungerne!</p>
          ) : (
            <div className="space-y-3">
              {transactions.slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
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
                  <span className={t.type === 'income' ? 'text-success font-semibold' : 'text-destructive font-semibold'}>
                    {t.type === 'income' ? '+' : '-'}{CURRENCY_SYMBOLS.EUR}{Number(t.amount).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
