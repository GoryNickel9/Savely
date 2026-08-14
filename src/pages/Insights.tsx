import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import MainLayout from '@/components/layout/MainLayout';
import { useInsights } from '@/hooks/useInsights';
import type { Insight, InsightKind, InsightSeverity } from '@/lib/insights';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Trophy,
  Sparkles,
  BellRing,
  Receipt,
  PiggyBank,
  Repeat,
} from 'lucide-react';

type FilterKey = 'all' | InsightSeverity;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Tutti' },
  { key: 'warning', label: '⚠️ Attenzione' },
  { key: 'positive', label: '✅ Positivi' },
  { key: 'info', label: 'ℹ️ Info' },
];

const KIND_ICON: Record<InsightKind, typeof Sparkles> = {
  spending_anomaly: TrendingUp,
  recurring_price_change: BellRing,
  budget_exceeded: AlertTriangle,
  portfolio_loss: TrendingDown,
  net_worth_milestone: Trophy,
  saving_month: PiggyBank,
  category_trend: Receipt,
  new_recurring_detected: Repeat,
};

const SEVERITY_BADGE: Record<InsightSeverity, { variant: 'destructive' | 'default' | 'secondary'; label: string }> = {
  warning: { variant: 'destructive', label: 'Attenzione' },
  positive: { variant: 'default', label: 'Positivo' },
  info: { variant: 'secondary', label: 'Info' },
};

export default function Insights() {
  const { t } = useTranslation();
  const { insights, isLoading } = useInsights();
  const [filter, setFilter] = useState<FilterKey>('all');

  const counts = useMemo(() => {
    const c = { warning: 0, positive: 0, info: 0 };
    for (const i of insights) c[i.severity]++;
    return c;
  }, [insights]);

  const filtered = useMemo(
    () => (filter === 'all' ? insights : insights.filter((i) => i.severity === filter)),
    [insights, filter]
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-3xl font-display font-bold">{t('Insights')}</h1>
              <p className="text-muted-foreground">
                {t('Segnali automatici sulle tue finanze: anomalie, milestone e trend.')}
              </p>
            </div>
          </div>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> {t('Dashboard')}
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : insights.length === 0 ? (
          <Card className="glass">
            <CardContent className="py-12 text-center text-muted-foreground">
              <p className="text-lg">{t('Nessun segnale rilevante al momento — tutto sotto controllo ✅')}</p>
              <p className="text-sm mt-2">
                {t('Continua a registrare transazioni: gli insights appariranno appena ci sarà qualcosa di notevole.')}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
              <TabsList>
                {FILTERS.map((f) => {
                  const count = f.key === 'all' ? insights.length : counts[f.key as InsightSeverity];
                  return (
                    <TabsTrigger key={f.key} value={f.key} className="gap-2">
                      {t(f.label)}
                      <span className="text-xs text-muted-foreground">({count})</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map((insight) => (
                <InsightCard key={insight.id} insight={insight} />
              ))}
            </div>

            {filtered.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                {t('Nessun insight in questa categoria.')}
              </p>
            )}
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
    <Card className="glass animate-fade-in">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
              insight.severity === 'warning' && 'bg-destructive/15 text-destructive',
              insight.severity === 'positive' && 'bg-primary/15 text-primary',
              insight.severity === 'info' && 'bg-secondary text-secondary-foreground'
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-base leading-tight">{insight.title}</CardTitle>
            <p className="text-sm text-muted-foreground">{insight.message}</p>
          </div>
        </div>
        <Badge variant={badge.variant} className="shrink-0">
          {t(badge.label)}
        </Badge>
      </CardHeader>
    </Card>
  );
}
