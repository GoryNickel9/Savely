import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import BudgetProgress from '@/components/BudgetProgress';
import { Budget, Transaction } from '@/lib/types';
import { getBudgetReferenceSpending } from '@/lib/budgetSpending';
import { todayLocalISO } from '@/lib/utils';
import { useSpendingForecast } from '@/hooks/useSpendingForecast';
import { formatEUR, formatPercent } from './format';

interface BudgetsWidgetProps {
  budgets: Budget[];
  transactions: Transaction[];
}

/** Numero massimo di budget mostrati nel widget. */
const MAX_ITEMS = 4;

export default function BudgetsWidget({ budgets, transactions }: BudgetsWidgetProps) {
  const { t } = useTranslation();
  const remote = useSpendingForecast(todayLocalISO(), budgets.some(budget => budget.category?.spending_pattern === 'occasional'));
  const comparisons = remote.isError ? undefined : remote.data?.occasionalSpending;

  // Same per-category comparison as the Budget page, independent of dashboard filters.
  const rows = useMemo(() => {
    return budgets
      .map((budget) => {
        const limit = Number(budget.amount) || 0;
        const spent = getBudgetReferenceSpending(budget, transactions, comparisons);
        return {
          budget,
          limit,
          spent,
          percent: spent !== null && limit > 0 ? (spent / limit) * 100 : 0,
        };
      })
      .sort((a, b) => b.percent - a.percent)
      .slice(0, MAX_ITEMS);
  }, [budgets, transactions, comparisons]);

  return (
    <div className="flex h-full flex-col rounded-xl border border-border/60 bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-display font-semibold">{t('Budget mensili')}</h2>
        <Link to="/budget" className="text-sm font-medium text-primary hover:underline">
          {t('Vedi tutti')}
        </Link>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {t(budgets.some(budget => budget.category?.spending_pattern === 'occasional')
          ? 'Spese regolari: mediana su 730 giorni. Spese saltuarie: media su 12 mesi, inclusi i mesi a zero.'
          : 'Mediana mensile (ultimi 730 giorni)')}
      </p>

      {rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-16 text-sm text-muted-foreground">
          {t('Nessun budget configurato')}
        </div>
      ) : (
        <ul className="mt-4 space-y-5">
          {rows.map(({ budget, limit, spent, percent }) => (
            <li key={budget.id} className="space-y-2">
              <div className="flex items-center gap-3">
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-secondary text-base"
                  style={
                    budget.category?.color?.startsWith('#')
                      ? { backgroundColor: `${budget.category.color}22` }
                      : undefined
                  }
                  aria-hidden
                >
                  {budget.category?.icon ?? '🎯'}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {budget.category?.name ?? t('Categoria')}
                  {budget.category?.spending_pattern === 'occasional' && <span className="block text-xs font-normal text-muted-foreground">{t('Media mensile su 12 mesi')}</span>}
                </span>
                <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                  {spent === null ? '—' : formatEUR(spent)}
                  <span className="hidden sm:inline"> / {formatEUR(limit)}</span>
                </span>
                <span className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums">
                  {spent === null ? '—' : formatPercent(percent, 2)}
                </span>
              </div>
              {spent === null ? <p className="text-xs text-muted-foreground" role="status">{t(remote.isLoading ? 'Calcolo in corso…' : 'Confronto delle spese saltuarie non disponibile. Riprova.')}</p>
                : <BudgetProgress value={percent} className="h-2" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
