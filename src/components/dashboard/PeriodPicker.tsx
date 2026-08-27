import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { CalendarRange, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  PeriodPreset,
  PeriodSelection,
  resolvePeriod,
} from '@/lib/statistics/dashboardStats';

interface PeriodPickerProps {
  selection: PeriodSelection;
  onChange: (selection: PeriodSelection) => void;
}

const PRESETS: PeriodPreset[] = [
  'mese-corrente',
  'mese-precedente',
  'ultimi-30-giorni',
  'anno-corrente',
  'personalizzato',
];

/** Etichette i18n dei preset (chiavi naturali, coerenti col resto dell'app). */
const PRESET_LABELS: Record<PeriodPreset, string> = {
  'mese-corrente': 'Mese corrente',
  'mese-precedente': 'Mese precedente',
  'ultimi-30-giorni': 'Ultimi 30 giorni',
  'anno-corrente': 'Anno corrente',
  personalizzato: 'Personalizzato',
};

const toISODate = (d: Date) => format(d, 'yyyy-MM-dd');

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Etichetta compatta dello stile "1 – 27 Agosto 2026". */
function rangeLabel(from: Date, to: Date): string {
  const sameDay = toISODate(from) === toISODate(to);
  if (sameDay) return capitalize(format(from, 'd MMMM yyyy', { locale: it }));
  const sameYear = from.getFullYear() === to.getFullYear();
  if (sameYear) {
    return capitalize(`${format(from, 'd', { locale: it })} – ${format(to, 'd MMMM yyyy', { locale: it })}`);
  }
  return capitalize(
    `${format(from, 'd MMM yy', { locale: it })} – ${format(to, 'd MMM yy', { locale: it })}`,
  );
}

export default function PeriodPicker({ selection, onChange }: PeriodPickerProps) {
  const { t } = useTranslation();
  const range = resolvePeriod(selection);

  const handleCustom = (which: 'from' | 'to', value: string) => {
    // Un estremo vuoto/invalido non aggiorna la selezione.
    if (!value || Number.isNaN(parseISO(value).getTime())) return;
    const raw = {
      from: which === 'from' ? value : toISODate(range.from),
      to: which === 'to' ? value : toISODate(range.to),
    };
    onChange({ preset: 'personalizzato', ...raw });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-10 w-full gap-2 rounded-lg border-border bg-card px-4 text-sm font-medium text-card-foreground shadow-sm hover:bg-muted/60 md:w-auto"
        >
          <CalendarRange className="h-4 w-4 text-muted-foreground" />
          {rangeLabel(range.from, range.to)}
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-4 rounded-xl">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">{t('Periodo')}</p>
          <Select
            value={selection.preset}
            onValueChange={(preset) => onChange({ preset: preset as PeriodPreset })}
          >
            <SelectTrigger className="w-full bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRESETS.map((preset) => (
                <SelectItem key={preset} value={preset}>
                  {t(PRESET_LABELS[preset])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="period-from" className="text-xs font-medium text-muted-foreground">
              {t('Dal')}
            </label>
            <Input
              id="period-from"
              type="date"
              value={toISODate(range.from)}
              onChange={(e) => handleCustom('from', e.target.value)}
              className="bg-card"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="period-to" className="text-xs font-medium text-muted-foreground">
              {t('Al')}
            </label>
            <Input
              id="period-to"
              type="date"
              value={toISODate(range.to)}
              onChange={(e) => handleCustom('to', e.target.value)}
              className="bg-card"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
