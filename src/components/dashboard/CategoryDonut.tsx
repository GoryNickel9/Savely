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

/**
 * Palette di riserva per le categorie senza colore definito (dopo i cinque
 * token chart, tonalità distinte per restare leggibili anche con molte voci).
 */
const FALLBACK_PALETTE = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  '#0ea5e9',
  '#f97316',
  '#14b8a6',
  '#8b5cf6',
  '#f43f5e',
  '#a3a3a3',
];

const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function sliceColor(categoryColor: string | null | undefined, index: number): string {
  if (categoryColor && HEX_COLOR.test(categoryColor.trim())) {
    return categoryColor.trim();
  }
  return FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
}

/** Sfondo morbido per la tessera dell'icona a partire dal colore categoria. */
function iconTileStyle(color: string | null): React.CSSProperties | undefined {
  if (color && HEX_COLOR.test(color.trim())) {
    return { backgroundColor: `${color.trim()}22` };
  }
  return undefined;
}

export default function CategoryDonut({ transactions, range }: CategoryDonutProps) {
  const { t } = useTranslation();

  // Tutte le categorie del periodo, ordinate per importo decrescente (nessuna
  // aggregazione in "Altro": ogni categoria resta visibile e riconoscibile).
  const slices = useMemo(
    () => categoryBreakdown(transactions, range),
    [transactions, range]
  );

  const total = useMemo(() => slices.reduce((sum, s) => sum + s.total, 0), [slices]);

  const chartData = slices.map((slice, index) => ({
    name: slice.name || t('Nessuna categoria'),
    value: slice.total,
    color: sliceColor(slice.color, index),
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
          {/* group + group-hover: con il tooltip aperto il totale centrale
              sfuma per non sovrapporsi alla scritta. */}
          <div className="group relative h-[200px] w-[200px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip content={<ChartTooltip />} wrapperStyle={{ zIndex: 50 }} />
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
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-200 group-hover:opacity-0">
              <p className="text-lg font-display font-bold tabular-nums">{formatEUR(total)}</p>
              <p className="text-xs text-muted-foreground">{t('Totale')}</p>
            </div>
          </div>

          <ul className="w-full min-w-0 flex-1 max-h-[260px] space-y-3 overflow-y-auto pr-1">
            {slices.map((slice, index) => (
              <li key={slice.categoryId} className="flex items-center gap-3">
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-secondary text-base"
                  style={iconTileStyle(slice.color)}
                  aria-hidden
                >
                  {slice.icon ?? '🏷️'}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {slice.name || t('Nessuna categoria')}
                </span>
                <span className="text-sm font-semibold tabular-nums">{formatEUR(slice.total)}</span>
                <span className="w-14 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                  {formatPercent(slice.percent)}
                </span>
                <span
                  className="hidden h-2 w-2 rounded-full sm:block"
                  style={{ backgroundColor: sliceColor(slice.color, index) }}
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
