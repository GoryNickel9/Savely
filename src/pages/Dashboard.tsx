import { useTranslation } from 'react-i18next';
import { useTransactions } from '@/hooks/useTransactions';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useBudgets } from '@/hooks/useBudgets';
import { CURRENCY_SYMBOLS } from '@/lib/constants';
import { calculateNetWorth } from '@/lib/netWorth';
import StatCard from '@/components/dashboard/StatCard';
import MainLayout from '@/components/layout/MainLayout';
import { Wallet, TrendingUp, TrendingDown, PieChart } from 'lucide-react';
import { Link } from 'react-router';

export default function Dashboard() {
  const { t } = useTranslation();
  const { transactions } = useTransactions();
  const { totalValue, totalGainPercent, totalGain, openAssets } = usePortfolio();
  const { budgets } = useBudgets();

  // Calcola valore del portfolio escludendo liquidità, immobili e altro
  const portfolioValue = openAssets
    .filter(a => a.type !== 'cash' && a.type !== 'real_estate' && a.type !== 'other')
    .reduce((sum, asset) => {
      const price = asset.current_price ?? asset.purchase_price;
      return sum + (price * asset.quantity);
    }, 0);

  // Calcola P&L del portfolio escludendo liquidità, immobili e altro
  const portfolioPL = openAssets
    .filter(a => a.type !== 'cash' && a.type !== 'real_estate' && a.type !== 'other')
    .reduce((sum, asset) => {
      const price = asset.current_price ?? asset.purchase_price;
      const cost = asset.purchase_price;
      return sum + ((price * asset.quantity) - (cost * asset.quantity));
    }, 0);

  // Calcola P&L percentuale del portfolio (esclusi liquidità, immobili e altro)
  const portfolioCost = openAssets
    .filter(a => a.type !== 'cash' && a.type !== 'real_estate' && a.type !== 'other')
    .reduce((sum, asset) => sum + (asset.purchase_price * asset.quantity), 0);
  const portfolioPLPercent = portfolioCost > 0 ? (portfolioPL / portfolioCost) * 100 : 0;

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  // Monthly income/expenses
  const monthlyIncome = transactions
    .filter(t => t.type === 'income' && new Date(t.date).getMonth() === currentMonth && new Date(t.date).getFullYear() === currentYear)
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const monthlyExpenses = transactions
    .filter(t => t.type === 'expense' && new Date(t.date).getMonth() === currentMonth && new Date(t.date).getFullYear() === currentYear)
    .reduce((sum, t) => sum + Number(t.amount), 0);

  // Yearly income/expenses
  const yearlyIncome = transactions
    .filter(t => t.type === 'income' && new Date(t.date).getFullYear() === currentYear)
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const yearlyExpenses = transactions
    .filter(t => t.type === 'expense' && new Date(t.date).getFullYear() === currentYear)
    .reduce((sum, t) => sum + Number(t.amount), 0);

  // Total income/expenses for balance calculation (like in Charts page)
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalBudget = budgets.reduce((sum, b) => sum + Number(b.amount), 0);

  // Patrimonio Netto — formula centralizzata in src/lib/netWorth.ts.
  const { netWorth } = calculateNetWorth({ transactions, assets: openAssets });

  return (
    <MainLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-display font-bold">{t('Dashboard')}</h1>
          <p className="text-muted-foreground mt-1">{t('Panoramica delle tue finanze')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
          <Link to="/net-worth" className="block">
            <StatCard
              title={t('Patrimonio Netto')}
              value={`${CURRENCY_SYMBOLS.EUR}${netWorth.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              icon={<Wallet className="w-6 h-6" />}
            />
          </Link>
          <StatCard
            title={t('Entrate del Mese')}
            value={`${CURRENCY_SYMBOLS.EUR}${monthlyIncome.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={<TrendingUp className="w-6 h-6" />}
            className="border-l-4 border-l-success"
          />
          <StatCard
            title={t('Uscite del Mese')}
            value={`${CURRENCY_SYMBOLS.EUR}${monthlyExpenses.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={<TrendingDown className="w-6 h-6 text-destructive" />}
            className="border-l-4 border-l-destructive"
          />
          <StatCard
            title={t('Cashflow Mensile')}
            value={`${CURRENCY_SYMBOLS.EUR}${(monthlyIncome - monthlyExpenses).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={<PieChart className="w-6 h-6" />}
            className={`border-l-4 ${monthlyIncome - monthlyExpenses >= 0 ? 'border-l-success' : 'border-l-destructive'}`}
          />
          <StatCard
            title={t('Cashflow Annuale')}
            value={`${CURRENCY_SYMBOLS.EUR}${(yearlyIncome - yearlyExpenses).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={<PieChart className="w-6 h-6" />}
            className={`border-l-4 ${yearlyIncome - yearlyExpenses >= 0 ? 'border-l-success' : 'border-l-destructive'}`}
          />
          <StatCard
            title={t('Portfolio')}
            value={`${CURRENCY_SYMBOLS.EUR}${portfolioValue.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={<PieChart className="w-6 h-6" />}
            trend={{ value: portfolioPLPercent, isPositive: portfolioPLPercent >= 0 }}
          />
        </div>

        <div className="glass rounded-xl p-6">
          <h2 className="text-xl font-display font-semibold mb-4">{t('Ultime Transazioni')}</h2>
          {transactions.slice(0, 5).length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{t('Nessuna transazione ancora. Inizia ad aggiungerne!')}</p>
          ) : (
            <div className="space-y-3">
              {transactions.slice(0, 5).map((tx) => (
                <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{tx.category?.icon || '💰'}</span>
                    <div>
                      <p className="font-medium">{tx.category?.name || t('Transazione')}</p>
                      {tx.description && (
                        <p className="text-sm text-muted-foreground">{tx.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground">{new Date(tx.date).toLocaleDateString('it-IT')}</p>
                    </div>
                  </div>
                  <span className={tx.type === 'income' ? 'text-success font-semibold' : 'text-destructive font-semibold'}>
                    {tx.type === 'income' ? '+' : '-'}{CURRENCY_SYMBOLS.EUR}{Number(tx.amount).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
