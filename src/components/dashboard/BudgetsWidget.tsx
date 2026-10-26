import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Progress } from '@/components/ui/progress';
import { MEDIAN_CALCULATION_DAYS } from '@/lib/constants';
import { Budget, Transaction } from '@/lib/types';
import { cn, getMedianMonthlySpending } from '@/lib/utils';
import { formatEUR, formatPercent } from './format';

interface BudgetsWidgetProps {
  budgets: Budget[];
  transactions: Transaction[];
}

/** Numero massimo di budget mostrati nel widget. */
const MAX_ITEMS = 4;

export default function BudgetsWidget({ budgets, transactions }: BudgetsWidgetProps) {
  const { t } = useTranslation();

  // Stessa mediana della pagina Budget, indipendente dal periodo della Dashboard.
  const rows = useMemo(() => {
    return budgets
      .map((budget) => {
        const limit = Number(budget.amount) || 0;
        const spent = getMedianMonthlySpending({
          transactions,
          categoryId: budget.category_id,
          days: MEDIAN_CALCULATION_DAYS,
        });
        return {
          budget,
          limit,
          spent,
          percent: limit > 0 ? Math.min((spent / limit) * 100, 999) : 0,
        };
      })
      .sort((a, b) => b.percent - a.percent)
      .slice(0, MAX_ITEMS);
  }, [budgets, transactions]);

  return (
    <div className="flex h-full flex-col rounded-xl border border-border/60 bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-display font-semibold">{t('Budget mensili')}</h2>
        <Link to="/budget" className="text-sm font-medium text-primary hover:underline">
          {t('Vedi tutti')}
        </Link>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {t('Mediana mensile (ultimi 730 giorni)')}
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
                </span>
                <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                  {formatEUR(spent)}
                  <span className="hidden sm:inline"> / {formatEUR(limit)}</span>
                </span>
                <span className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums">
                  {formatPercent(percent)}
                </span>
              </div>
              <Progress value={percent} className={cn('h-2', percent >= 100 && '[&>div]:bg-destructive')} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
