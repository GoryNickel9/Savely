import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPercent } from './format';

type Accent = 'neutral' | 'success' | 'destructive' | 'info';

const ACCENTS: Record<Accent, { value: string; tile: string }> = {
  neutral: { value: 'text-card-foreground', tile: 'bg-primary/10 text-primary' },
  success: { value: 'text-success', tile: 'bg-success/10 text-success' },
  destructive: { value: 'text-destructive', tile: 'bg-destructive/10 text-destructive' },
  info: { value: 'text-chart-4', tile: 'bg-chart-4/10 text-chart-4' },
};

interface KpiCardProps {
  title: string;
  value: string;
  icon: ReactNode;
  accent?: Accent;
  /** Variazione % rispetto al periodo precedente; null = confronto non disponibile. */
  deltaPercent?: number | null;
  /** Per metriche dove scendere è positivo (es. uscite): inverte solo il colore, non la freccia. */
  goodWhenDown?: boolean;
  subtitle?: string;
}

export default function KpiCard({
  title,
  value,
  icon,
  accent = 'neutral',
  deltaPercent = null,
  goodWhenDown = false,
  subtitle,
}: KpiCardProps) {
  const { t } = useTranslation();
  const accentClasses = ACCENTS[accent];

  const showDelta = deltaPercent !== null && Number.isFinite(deltaPercent);
  const isUp = (deltaPercent ?? 0) >= 0;
  // Colore semantico: il segno decide la freccia, la bontà del cambio decide il colore.
  const increaseIsGood = !goodWhenDown;
  const isGood = isUp ? increaseIsGood : !increaseIsGood;

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div className={cn('rounded-lg p-2', accentClasses.tile)}>{icon}</div>
      </div>
      <p className={cn('mt-1 text-3xl font-display font-bold tabular-nums tracking-tight', accentClasses.value)}>
        {value}
      </p>
      <div className="mt-2 flex items-center gap-1.5">
        {showDelta ? (
          <>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-semibold',
                isGood ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
              )}
            >
              {isUp ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {formatPercent(Math.abs(deltaPercent as number))}
            </span>
            <span className="text-xs text-muted-foreground">{t('vs. periodo precedente')}</span>
          </>
        ) : (
          <>
            {!subtitle && <Minus className="h-3 w-3 text-muted-foreground" />}
            <span className="text-xs text-muted-foreground">
              {subtitle ?? t('Nessun confronto disponibile')}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
