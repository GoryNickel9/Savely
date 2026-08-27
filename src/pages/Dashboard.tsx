import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PiggyBank, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import KpiCard from '@/components/dashboard/KpiCard';
import PeriodPicker from '@/components/dashboard/PeriodPicker';
import IncomeExpenseChart from '@/components/dashboard/IncomeExpenseChart';
import CategoryDonut from '@/components/dashboard/CategoryDonut';
import RecentTransactions from '@/components/dashboard/RecentTransactions';
import BudgetsWidget from '@/components/dashboard/BudgetsWidget';
import { formatEUR, formatPercent } from '@/components/dashboard/format';
import {
  computePeriodStats,
  PeriodSelection,
  resolvePeriod,
} from '@/lib/statistics/dashboardStats';
import { useTransactions } from '@/hooks/useTransactions';
import { useBudgets } from '@/hooks/useBudgets';

export default function Dashboard() {
  const { t } = useTranslation();
  const { transactions } = useTransactions();
  const { budgets } = useBudgets();

  const [selection, setSelection] = useState<PeriodSelection>({ preset: 'mese-corrente' });
  const range = useMemo(() => resolvePeriod(selection), [selection]);
  const stats = useMemo(() => computePeriodStats(transactions, range), [transactions, range]);

  return (
    <MainLayout>
      <div className="space-y-6 lg:space-y-8">
        <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-display font-bold">{t('Dashboard')}</h1>
            <p className="mt-1 text-muted-foreground">{t('Panoramica delle tue finanze')}</p>
          </div>
          <PeriodPicker selection={selection} onChange={setSelection} />
        </header>

        <section aria-label={t('Indicatori principali')} className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            title={t('Saldo totale')}
            value={formatEUR(stats.balance)}
            icon={<Wallet className="h-5 w-5" />}
            accent="neutral"
            deltaPercent={stats.deltaPercent.balance}
          />
          <KpiCard
            title={t('Entrate')}
            value={formatEUR(stats.income)}
            icon={<TrendingUp className="h-5 w-5" />}
            accent="success"
            deltaPercent={stats.deltaPercent.income}
          />
          <KpiCard
            title={t('Uscite')}
            value={formatEUR(stats.expenses)}
            icon={<TrendingDown className="h-5 w-5" />}
            accent="destructive"
            goodWhenDown
            deltaPercent={stats.deltaPercent.expenses}
          />
          <KpiCard
            title={t('Risparmio')}
            value={formatEUR(stats.savings)}
            icon={<PiggyBank className="h-5 w-5" />}
            accent="info"
            subtitle={`${formatPercent(stats.savingsRate)} ${t('del totale entrate')}`}
          />
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-5">
          <div className="xl:col-span-3">
            <IncomeExpenseChart transactions={transactions} range={range} />
          </div>
          <div className="xl:col-span-2">
            <CategoryDonut transactions={transactions} range={range} />
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <RecentTransactions transactions={transactions} range={range} />
          <BudgetsWidget budgets={budgets} transactions={transactions} />
        </section>
      </div>
    </MainLayout>
  );
}
