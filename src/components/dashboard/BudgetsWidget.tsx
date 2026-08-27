import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { endOfMonth, startOfMonth } from 'date-fns';
import { Progress } from '@/components/ui/progress';
import { isInRange } from '@/lib/statistics/dashboardStats';
import { Budget, Transaction } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatEUR, formatPercent } from './format';

interface BudgetsWidgetProps {
  budgets: Budget[];
  transactions: Transaction[];
}

/** Numero massimo di budget mostrati nel widget. */
const MAX_ITEMS = 4;

export default function BudgetsWidget({ budgets, transactions }: BudgetsWidgetProps) {
  const { t } = useTranslation();

  // I budget sono mensili e generici (month/year sentinella nel DB): la spesa
  // di riferimento è il mese corrente, indipendente dal periodo selezionato.
  const currentMonth = useMemo(() => {
    const now = new Date();
    return { from: startOfMonth(now), to: endOfMonth(now) };
  }, []);

  const rows = useMemo(() => {
    const spentByCategory = new Map<string, number>();
    for (const tx of transactions) {
      if (tx.type !== 'expense' || !tx.category_id) continue;
      if (!isInRange(tx, currentMonth)) continue;
      spentByCategory.set(
        tx.category_id,
        (spentByCategory.get(tx.category_id) ?? 0) + (Number(tx.amount) || 0)
      );
    }

    return budgets
      .map((budget) => {
        const limit = Number(budget.amount) || 0;
        const spent = spentByCategory.get(budget.category_id) ?? 0;
        return {
          budget,
          limit,
          spent,
          percent: limit > 0 ? Math.min((spent / limit) * 100, 999) : 0,
        };
      })
      .sort((a, b) => b.percent - a.percent)
      .slice(0, MAX_ITEMS);
  }, [budgets, transactions, currentMonth]);

  return (
    <div className="flex h-full flex-col rounded-xl border border-border/60 bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-display font-semibold">{t('Budget mensili')}</h2>
        <Link to="/budget" className="text-sm font-medium text-primary hover:underline">
          {t('Vedi tutti')}
        </Link>
      </div>

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
