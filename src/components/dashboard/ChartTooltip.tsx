import { formatEUR } from './format';

interface TooltipEntry {
  name?: string | number;
  value?: number | string;
  color?: string;
}

interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: TooltipEntry[];
  /** Etichetta mostrata sopra i valori; di default usa la label del punto. */
  heading?: string;
}

/**
 * Card del tooltip riutilizzabile dai grafici Recharts della dashboard,
 * conforme ai token del tema chiaro.
 */
export function ChartTooltip({ active, label, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/60 bg-popover px-3 py-2 shadow-md">
      {label !== undefined && (
        <p className="text-xs font-semibold text-popover-foreground">{label}</p>
      )}
      <div className="mt-1 space-y-1">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="ml-auto font-medium text-popover-foreground">
              {typeof entry.value === 'number' ? formatEUR(entry.value) : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
