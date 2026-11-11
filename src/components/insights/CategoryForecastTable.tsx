import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { SpendingForecast } from '@/lib/spendingForecast';
import type { Category } from '@/lib/types';
import { formatEur } from '@/lib/insights';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAuth } from '@/hooks/useAuth';
import { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell } from '@/components/ui/table';

function readOpen(key: string | null): boolean {
  try { return key === null || localStorage.getItem(key) !== 'false'; }
  catch { return true; }
}

export default function CategoryForecastTable({ forecast, categories = [] }: { forecast: SpendingForecast; categories?: Category[] }) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const storageKey = user ? `savely:category-forecast-open:${user.id}` : null;
  const [open, setOpen] = useState(() => readOpen(storageKey));
  useEffect(() => { setOpen(readOpen(storageKey)); }, [storageKey]);
  const changeOpen = (value: boolean) => {
    setOpen(value);
    try { if (storageKey) localStorage.setItem(storageKey, String(value)); }
    catch { /* The section still works when browser storage is unavailable. */ }
  };
  if (!forecast.categories?.length) return null;
  const metadata = new Map(categories.map(category => [category.id, category]));
  const name = (id: string | null) => id === null ? t('Senza categoria') : metadata.get(id)?.name ?? t('Categoria non disponibile');
  const rows = [...forecast.categories].sort((a, b) => (b.total ?? b.spent) - (a.total ?? a.spent)
    || name(a.categoryId).localeCompare(name(b.categoryId), i18n.language));
  const amount = (value: number | null) => value === null ? '—' : formatEur(value);
  const difference = (total: number | null, limit: number | undefined) => total === null || limit === undefined
    ? '—' : `${total > limit ? '+' : ''}${formatEur(Math.round((total - limit) * 100) / 100)}`;
  const differenceColor = (total: number | null, limit: number | undefined) => total === null || limit === undefined
    ? '' : total > limit ? 'text-destructive' : total < limit ? 'text-success' : '';

  return <Collapsible open={open} onOpenChange={changeOpen} asChild><Card className="min-w-0 border-border/60 bg-card shadow-sm">
    <CardContent className="p-5 sm:p-6">
      <h2 id="category-forecast-heading">
        <CollapsibleTrigger className="group flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-md text-left text-lg font-display font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {t('Previsione per categoria')}
          <ChevronDown className="h-5 w-5 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180 motion-reduce:transition-none" aria-hidden />
        </CollapsibleTrigger>
      </h2>
      <CollapsibleContent className="pt-4">
      <Table aria-labelledby="category-forecast-heading" className="min-w-[560px]">
        <TableHeader><TableRow>
          <TableHead scope="col">{t('Categoria')}</TableHead>
          {['Già speso', 'Previsto', 'Budget', 'Scostamento'].map(label => <TableHead key={label} scope="col" className="text-right">{t(label)}</TableHead>)}
        </TableRow></TableHeader>
        <TableBody>{rows.map(row => {
          const category = row.categoryId === null ? undefined : metadata.get(row.categoryId);
          return <TableRow key={row.categoryId ?? '__uncategorized'}>
            <TableHead scope="row" className="h-auto max-w-64 py-4 font-medium text-foreground">
              <span className="flex items-center gap-2"><span className="text-lg" aria-hidden>{category?.icon ?? '📂'}</span><span className="break-words">{name(row.categoryId)}</span></span>
              {category?.spending_pattern === 'occasional' && <Badge variant="secondary" className="mt-1">{t('Spesa saltuaria')}</Badge>}
            </TableHead>
            <TableCell className="text-right tabular-nums">{amount(row.spent)}</TableCell>
            <TableCell className="text-right tabular-nums">{amount(row.total === null ? null : Math.round((row.scheduled + row.variable) * 100) / 100)}</TableCell>
            <TableCell className="text-right tabular-nums">{amount(row.budget?.limit ?? null)}</TableCell>
            <TableCell className={`text-right tabular-nums ${differenceColor(row.total, row.budget?.limit)}`}>
              {difference(row.total, row.budget?.limit)}
            </TableCell>
          </TableRow>;
        })}</TableBody>
        <TableFooter><TableRow>
          <TableHead scope="row" className="font-semibold text-foreground">{t('Totale')}</TableHead>
          <TableCell className="text-right tabular-nums">{amount(forecast.spent)}</TableCell>
          <TableCell className="text-right tabular-nums">{amount(forecast.total === null ? null : Math.round((forecast.scheduled + forecast.variable) * 100) / 100)}</TableCell>
          <TableCell className="text-right tabular-nums">{amount(forecast.budget?.limit ?? null)}</TableCell>
          <TableCell className={`text-right tabular-nums ${differenceColor(forecast.total, forecast.budget?.limit)}`}>
            {difference(forecast.total, forecast.budget?.limit)}
          </TableCell>
        </TableRow></TableFooter>
      </Table>
      </CollapsibleContent>
    </CardContent>
  </Card></Collapsible>;
}
