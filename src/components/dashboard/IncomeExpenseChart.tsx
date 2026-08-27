import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  buildSeries,
  DateRange,
  Granularity,
} from '@/lib/statistics/dashboardStats';
import { Transaction } from '@/lib/types';
import { ChartTooltip } from './ChartTooltip';

interface IncomeExpenseChartProps {
  transactions: Transaction[];
  range: DateRange;
}

const GRANULARITIES: Granularity[] = ['giornaliero', 'settimanale', 'mensile'];

/** Etichette i18n delle granularità (chiavi naturali). */
const GRANULARITY_LABELS: Record<Granularity, string> = {
  giornaliero: 'Giornaliero',
  settimanale: 'Settimanale',
  mensile: 'Mensile',
};

const LABEL_FORMATS: Record<Granularity, string> = {
  giornaliero: 'd MMM',
  settimanale: 'd MMM',
  mensile: 'MMM yy',
};

export default function IncomeExpenseChart({ transactions, range }: IncomeExpenseChartProps) {
  const { t } = useTranslation();
  const [granularity, setGranularity] = useState<Granularity>('giornaliero');

  const data = useMemo(
    () => buildSeries(transactions, range, granularity),
    [transactions, range, granularity]
  );

  const isEmpty = useMemo(
    () => data.every((point) => point.income === 0 && point.expenses === 0),
    [data]
  );

  const formatTick = (isoDate: string) =>
    format(parseISO(isoDate), LABEL_FORMATS[granularity], { locale: it });

  return (
    <div className="flex h-full flex-col rounded-xl border border-border/60 bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-display font-semibold">{t('Andamento entrate e uscite')}</h2>
        <Select value={granularity} onValueChange={(value) => setGranularity(value as Granularity)}>
          <SelectTrigger className="h-9 w-36 rounded-lg bg-card text-sm shadow-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GRANULARITIES.map((g) => (
              <SelectItem key={g} value={g}>
                {t(GRANULARITY_LABELS[g])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-success" />
          {t('Entrate')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-destructive" />
          {t('Uscite')}
        </span>
      </div>

      {isEmpty ? (
        <div className="flex flex-1 items-center justify-center py-16 text-sm text-muted-foreground">
          {t('Nessuna transazione nel periodo selezionato')}
        </div>
      ) : (
        <div className="mt-4 h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="dashboard-income-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="dashboard-expense-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                tickFormatter={formatTick}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis
                width={64}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(value: number) => `€ ${value.toLocaleString('it-IT')}`}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'hsl(var(--border))' }} />
              <Area
                type="monotone"
                dataKey="income"
                name={t('Entrate')}
                stroke="hsl(var(--success))"
                strokeWidth={2}
                fill="url(#dashboard-income-gradient)"
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Area
                type="monotone"
                dataKey="expenses"
                name={t('Uscite')}
                stroke="hsl(var(--destructive))"
                strokeWidth={2}
                fill="url(#dashboard-expense-gradient)"
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
