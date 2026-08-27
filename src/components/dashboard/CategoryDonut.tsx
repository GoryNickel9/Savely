import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import {
  categoryBreakdown,
  DateRange,
} from '@/lib/statistics/dashboardStats';
import { Transaction } from '@/lib/types';
import { formatEUR, formatPercent } from './format';
import { ChartTooltip } from './ChartTooltip';

interface CategoryDonutProps {
  transactions: Transaction[];
  range: DateRange;
}

/** Fette mostrate singolarmente; le restanti si aggregano in "Altro". */
const MAX_SLICES = 5;

// Palette per il donut: i cinque token chart + un grigio neutro per "Altro".
const SLICE_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];
const OTHER_COLOR = '#94a3b8';

/** Sfondo morbido per la tessera dell'icona: usa il colore categoria se è un hex. */
function iconTileStyle(color: string | null): React.CSSProperties | undefined {
  if (color && color.startsWith('#') && (color.length === 7 || color.length === 4)) {
    return { backgroundColor: `${color}22` };
  }
  return undefined;
}

export default function CategoryDonut({ transactions, range }: CategoryDonutProps) {
  const { t } = useTranslation();

  const slices = useMemo(() => {
    const breakdown = categoryBreakdown(transactions, range);
    if (breakdown.length <= MAX_SLICES) return breakdown;
    const top = breakdown.slice(0, MAX_SLICES);
    const restTotal = breakdown.slice(MAX_SLICES).reduce((sum, s) => sum + s.total, 0);
    const grandTotal = breakdown.reduce((sum, s) => sum + s.total, 0);
    return [
      ...top,
      {
        categoryId: 'altro',
        name: t('Altro'),
        icon: null,
        color: null,
        total: restTotal,
        percent: grandTotal > 0 ? (restTotal / grandTotal) * 100 : 0,
      },
    ];
  }, [transactions, range, t]);

  const total = useMemo(() => slices.reduce((sum, s) => sum + s.total, 0), [slices]);

  const chartData = slices.map((s, index) => ({
    name: s.name,
    value: s.total,
    color: s.categoryId === 'altro' ? OTHER_COLOR : SLICE_COLORS[index % SLICE_COLORS.length],
  }));

  return (
    <div className="flex h-full flex-col rounded-xl border border-border/60 bg-card p-6 shadow-sm">
      <h2 className="text-lg font-display font-semibold">{t('Spese per categoria')}</h2>

      {total === 0 ? (
        <div className="flex flex-1 items-center justify-center py-16 text-sm text-muted-foreground">
          {t('Nessuna transazione nel periodo selezionato')}
        </div>
      ) : (
        <div className="mt-4 flex flex-1 flex-col items-center gap-6 lg:flex-row">
          <div className="relative h-[200px] w-[200px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip content={<ChartTooltip />} />
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="65%"
                  outerRadius="92%"
                  paddingAngle={2}
                  cornerRadius={4}
                  strokeWidth={0}
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-lg font-display font-bold tabular-nums">{formatEUR(total)}</p>
              <p className="text-xs text-muted-foreground">{t('Totale')}</p>
            </div>
          </div>

          <ul className="w-full min-w-0 flex-1 space-y-3">
            {slices.map((slice, index) => (
              <li key={slice.categoryId} className="flex items-center gap-3">
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-secondary text-base"
                  style={iconTileStyle(slice.color)}
                  aria-hidden
                >
                  {slice.icon ?? '🏷️'}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{slice.name}</span>
                <span className="text-sm font-semibold tabular-nums">{formatEUR(slice.total)}</span>
                <span className="w-14 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                  {formatPercent(slice.percent)}
                </span>
                {/* Colore della fetta corrispondente, per associare legenda e grafico. */}
                <span
                  className="hidden h-2 w-2 rounded-full sm:block"
                  style={{
                    backgroundColor:
                      slice.categoryId === 'altro' ? OTHER_COLOR : SLICE_COLORS[index % SLICE_COLORS.length],
                  }}
                  aria-hidden
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
