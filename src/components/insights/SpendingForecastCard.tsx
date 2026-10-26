import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { CalendarDays, Check, TriangleAlert, Wallet } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn, parseLocalDate } from '@/lib/utils';
import { formatEur } from '@/lib/insights';
import { FORECAST_DAYS, MIN_FORECAST_DAYS, type SpendingForecast } from '@/lib/spendingForecast';

export default function SpendingForecastCard({ forecast }: { forecast: SpendingForecast }) {
  const { t, i18n } = useTranslation();
  const date = parseLocalDate(forecast.date);
  const month = date.toLocaleDateString(i18n.language, { month: 'long' });
  const margin = forecast.total !== null && forecast.budget ? forecast.budget.limit - forecast.total : null;
  const over = margin !== null && margin < 0;
  const StatusIcon = over ? TriangleAlert : Check;
  return (
    <Card className="overflow-hidden border-border/60 bg-card shadow-sm">
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-display font-semibold">{t('Come chiuderai {{month}}', { month })}</h2>
          {margin !== null && <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium', over ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success')}>
            <StatusIcon className="h-3.5 w-3.5" aria-hidden />{t(over ? 'Sforamento previsto' : 'Entro il budget stimato')}
          </span>}
        </div>
        <div className="mt-5 grid gap-7 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{t('Spesa prevista a fine mese')}</p>
            {forecast.total !== null
              ? <p className="mt-1 break-words text-4xl font-display font-semibold tracking-tight tabular-nums">{formatEur(forecast.total)}</p>
              : <div className="mt-2 space-y-2"><p className="text-lg font-medium">{t('Previsione non disponibile')}</p><p className="text-sm text-muted-foreground">{forecast.unsupportedRecurring || forecast.unsupportedBudgets ? t('Budget e ricorrenti devono essere in euro per calcolare la previsione.') : t('Servono almeno {{days}} giorni di storico per stimare le abitudini di spesa.', { days: MIN_FORECAST_DAYS })}</p></div>}
            {forecast.budget ? <div className="mt-5">
              <div className="mb-2 flex items-center justify-between gap-3 text-sm"><span className="text-muted-foreground">{t('Budget mensile')}</span><span className="font-medium tabular-nums">{formatEur(forecast.budget.limit)}</span></div>
              {forecast.total !== null && <Progress aria-label={t('Spesa prevista rispetto al budget mensile')} value={forecast.total / forecast.budget.limit * 100} className="h-1.5" />}
              <p className="mt-2 text-xs text-muted-foreground">{t('Somma dei budget mensili delle categorie')}</p>
              {margin !== null && <p className={cn('mt-3 flex flex-wrap items-center gap-1.5 text-sm', over ? 'text-destructive' : 'text-muted-foreground')}><Wallet className="h-4 w-4 shrink-0" aria-hidden />{t(over ? 'Sforamento previsto:' : 'Margine previsto:')}<span className="font-semibold tabular-nums">{formatEur(Math.abs(margin))}</span></p>}
            </div> : <Link className="mt-4 inline-block text-sm text-primary hover:underline" to="/budget">{t('Configura i budget mensili')}</Link>}
            <dl className="mt-5 space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t('Già speso')}</dt><dd className="font-medium tabular-nums">{formatEur(forecast.spent)}</dd></div>
              {forecast.total !== null && <>
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t('Ricorrenti e programmate ancora attese')}</dt><dd className="shrink-0 font-medium tabular-nums">{formatEur(forecast.scheduled)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t('Variabili ancora previste')}</dt><dd className="shrink-0 font-medium tabular-nums">{formatEur(forecast.variable)}</dd></div>
              </>}
            </dl>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{t('Spesa cumulata (€)')}</p>
            <div className="mt-2 h-56 w-full" role="img" aria-label={t('Andamento della spesa registrata e prevista nel mese')}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <LineChart data={forecast.points} margin={{ top: 12, right: 10, bottom: 0, left: 0 }} accessibilityLayer>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" type="number" domain={[1, forecast.points.length]} ticks={[1, 10, 20, forecast.points.length]} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} minTickGap={12} />
                  <YAxis width={55} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={value => Number(value).toLocaleString(i18n.language, { maximumFractionDigits: 0 })} />
                  <Tooltip formatter={value => formatEur(Number(value))} labelFormatter={value => t('Giorno {{day}}', { day: value })} contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--popover-foreground))' }} />
                  {forecast.budget && <ReferenceLine y={forecast.budget.limit} stroke="hsl(var(--muted-foreground))" ifOverflow="extendDomain" />}
                  <Line type="linear" dataKey="actual" name={t('Speso')} stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                  <Line type="linear" dataKey="projected" name={t('Previsto')} stroke="hsl(var(--primary))" strokeWidth={2.5} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><span className="w-4 border-t-2 border-primary" />{t('Speso')}</span>
              {forecast.total !== null && <span className="inline-flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-primary" />{t('Previsto')}</span>}
              {forecast.budget && <span className="inline-flex items-center gap-1.5"><span className="w-4 border-t border-muted-foreground" />{t('Budget mensile')}</span>}
            </div>
          </div>
        </div>
      </CardContent>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-5 py-3 text-xs text-muted-foreground sm:px-6">
        <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" aria-hidden />{t('Regolari: {{days}} giorni; saltuarie: media su 12 mesi.', { days: FORECAST_DAYS })}</span><span>{t('Storico disponibile per le spese regolari: {{days}} giorni', { days: forecast.historyDays })}</span>
      </div>
    </Card>
  );
}
