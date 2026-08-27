import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { DateRange, filterByRange } from '@/lib/statistics/dashboardStats';
import { Transaction } from '@/lib/types';
import { formatEUR } from './format';

interface RecentTransactionsProps {
  transactions: Transaction[];
  range: DateRange;
}

const MAX_ITEMS = 5;

export default function RecentTransactions({ transactions, range }: RecentTransactionsProps) {
  const { t } = useTranslation();

  const recent = useMemo(() => {
    // Le transazioni arrivano già ordinate per data desc da Supabase; il sort
    // è ridondante ma rende il componente indipendente dall'ordine sorgente.
    return [...filterByRange(transactions, range)]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, MAX_ITEMS);
  }, [transactions, range]);

  return (
    <div className="flex h-full flex-col rounded-xl border border-border/60 bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-display font-semibold">{t('Transazioni recenti')}</h2>
        <Link
          to="/transactions"
          className="text-sm font-medium text-primary hover:underline"
        >
          {t('Vedi tutte')}
        </Link>
      </div>

      {recent.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-16 text-sm text-muted-foreground">
          {t('Nessuna transazione nel periodo selezionato')}
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-border/60">
          {recent.map((tx) => {
            const isIncome = tx.type === 'income';
            const title = tx.description || tx.category?.name || t('Transazione');
            const subtitleParts = [
              tx.description && tx.category?.name ? tx.category.name : null,
              format(parseISO(tx.date), 'd MMMM yyyy', { locale: it }),
            ].filter(Boolean);

            return (
              <li key={tx.id} className="flex items-center gap-3 py-3">
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary text-lg"
                  aria-hidden
                >
                  {tx.category?.icon ?? '💰'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{title}</p>
                  <p className="truncate text-xs capitalize text-muted-foreground">
                    {subtitleParts.join(' · ')}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-sm font-semibold tabular-nums ${
                    isIncome ? 'text-success' : 'text-destructive'
                  }`}
                >
                  {isIncome ? '+' : '−'} {formatEUR(Number(tx.amount))}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
