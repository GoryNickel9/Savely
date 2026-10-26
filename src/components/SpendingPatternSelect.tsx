import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { SpendingPattern } from '@/lib/types';

export default function SpendingPatternSelect({ value, onChange }: {
  value: SpendingPattern; onChange: (value: SpendingPattern) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  return <div className="space-y-2">
    <label htmlFor={id} className="text-sm font-medium">{t('Andamento delle spese')}</label>
    <Select value={value} onValueChange={value => onChange(value as SpendingPattern)}>
      <SelectTrigger id={id} aria-describedby={`${id}-help`}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="regular">{t('Regolari')}</SelectItem>
        <SelectItem value="occasional">{t('Saltuarie')}</SelectItem>
      </SelectContent>
    </Select>
    <p id={`${id}-help`} className="text-xs text-muted-foreground">{t('Per le spese saltuarie, il budget si confronta con la media su 12 mesi, inclusi i mesi a zero e il mese corrente fino a oggi.')}</p>
  </div>;
}
