import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, BellRing, CalendarDays, Info, Lightbulb, PiggyBank, Receipt, Repeat, TrendingDown, TrendingUp, Trophy } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import SpendingForecastCard from '@/components/insights/SpendingForecastCard';
import { useInsights } from '@/hooks/useInsights';
import type { Insight, InsightKind, InsightSeverity } from '@/lib/insights';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type FilterKey = 'all' | InsightSeverity;
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Tutti' }, { key: 'warning', label: 'Attenzione' },
  { key: 'positive', label: 'Positivi' }, { key: 'info', label: 'Da verificare' },
];
const KIND_ICON: Record<InsightKind, typeof Lightbulb> = {
  spending_anomaly: TrendingUp, recurring_price_change: BellRing, budget_exceeded: AlertTriangle,
  portfolio_loss: TrendingDown, net_worth_milestone: Trophy, saving_month: PiggyBank,
  category_trend: Receipt, new_recurring_detected: Repeat,
};
const SEVERITY_BADGE: Record<InsightSeverity, { variant: 'destructive' | 'default' | 'secondary'; label: string }> = {
  warning: { variant: 'destructive', label: 'Attenzione' },
  positive: { variant: 'default', label: 'Positivo' },
  info: { variant: 'secondary', label: 'Da verificare' },
};

export default function Insights() {
  const { t, i18n } = useTranslation();
  const { insights, forecast, referenceDate, isLoading, isError, dataError, hasTransactions, retry } = useInsights();
  const [filter, setFilter] = useState<FilterKey>('all');
  const counts = useMemo(() => {
    const result = { warning: 0, positive: 0, info: 0 };
    for (const insight of insights) result[insight.severity]++;
    return result;
  }, [insights]);
  const filtered = filter === 'all' ? insights : insights.filter(insight => insight.severity === filter);
  return (
    <MainLayout>
      <div className="mx-auto max-w-6xl space-y-7">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-display font-bold"><Lightbulb className="h-7 w-7 text-primary" aria-hidden />{t('Insights')}</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t('Cosa sta cambiando nelle tue spese, e cosa aspettarti a fine mese.')}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="h-4 w-4" aria-hidden />{t('Situazione al {{date}}', { date: referenceDate.toLocaleDateString(i18n.language, { day: 'numeric', month: 'long', year: 'numeric' }) })}</span>
        </header>
        {isLoading ? (
          <div className="space-y-4" role="status" aria-label={t('Caricamento degli insights')}><Skeleton className="h-80 rounded-xl" /><Skeleton className="h-28 rounded-xl" /><Skeleton className="h-28 rounded-xl" /></div>
        ) : isError ? (
          <Card><CardContent className="space-y-3 p-6" role="alert">
            <h2 className="font-semibold">{t('Impossibile calcolare gli insights')}</h2>
            <p className="text-sm text-muted-foreground">{t(dataError ? 'Controlla date, importi e cambi di transazioni, budget e ricorrenti.' : 'Alcuni dati non sono stati caricati. Riprova per visualizzare risultati aggiornati.')}</p>
            <Button variant="outline" onClick={() => void retry()}>{t('Riprova')}</Button>
          </CardContent></Card>
        ) : (
          <>
            {forecast && <SpendingForecastCard forecast={forecast} />}
            <section aria-labelledby="insights-signals-heading">
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 id="insights-signals-heading" className="text-lg font-display font-semibold">{t('Da guardare questo mese')}</h2>
                <span className="shrink-0 text-xs text-muted-foreground" aria-live="polite">{t('{{count}} segnali', { count: filtered.length })}</span>
              </div>
              {insights.length > 0 ? <>
                <div className="mb-4 flex flex-wrap gap-1" role="group" aria-label={t('Filtra i segnali')}>
                  {FILTERS.map(item => <Button key={item.key} variant={filter === item.key ? 'secondary' : 'ghost'} size="sm" aria-pressed={filter === item.key} onClick={() => setFilter(item.key)} className="gap-1.5">
                    {t(item.label)}<span className="text-xs text-muted-foreground">({item.key === 'all' ? insights.length : counts[item.key]})</span>
                  </Button>)}
                </div>
                <div className="space-y-3">{filtered.map(insight => <InsightCard key={insight.id} insight={insight} />)}</div>
                {filtered.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">{t('Nessun insight in questa categoria.')}</p>}
                <p className="mt-4 flex items-start gap-1.5 text-xs text-muted-foreground"><Info className="h-3.5 w-3.5 shrink-0" aria-hidden />{t('Confronti a parità di periodo. Le previsioni sono stime, non spese già sostenute.')}</p>
              </> : <Card><CardContent className="space-y-2 py-9 text-center">
                <p className="font-medium">{t(hasTransactions ? 'Nessun segnale rilevante nei dati disponibili' : 'Nessuna transazione disponibile')}</p>
                <p className="text-sm text-muted-foreground">{t(hasTransactions ? 'I segnali verranno aggiornati con le nuove transazioni.' : 'Registra le transazioni per analizzare le tue abitudini di spesa.')}</p>
              </CardContent></Card>}
            </section>
          </>
        )}
      </div>
    </MainLayout>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const { t } = useTranslation();
  const Icon = KIND_ICON[insight.kind];
  const badge = SEVERITY_BADGE[insight.severity];
  return (
    <Card className="border-border/60 bg-card shadow-sm">
      <CardContent className="flex items-start gap-3 p-4 sm:p-5">
        <div className={cn('hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:flex', insight.severity === 'warning' ? 'bg-destructive/10 text-destructive' : insight.severity === 'positive' ? 'bg-success/10 text-success' : 'bg-secondary text-muted-foreground')}><Icon className="h-4 w-4" aria-hidden /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="text-sm font-semibold leading-snug">{insight.title}</h3><Badge variant={badge.variant}>{t(badge.label)}</Badge></div>
          <p className="mt-1.5 text-sm text-muted-foreground">{insight.message}</p>
        </div>
      </CardContent>
    </Card>
  );
}
