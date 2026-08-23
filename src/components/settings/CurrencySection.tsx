import { useTranslation } from 'react-i18next';
import { Settings2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProfile } from '@/hooks/useProfile';
import { toast } from 'sonner';
import { CURRENCY_SYMBOLS } from '@/lib/constants';
import { CurrencyCode } from '@/lib/types';

/**
 * Sezione "Valuta Principale" di Settings. Estratta da Settings.tsx (TD-006).
 */
export default function CurrencySection() {
  const { defaultCurrency, updateDefaultCurrency } = useProfile();
  const { t } = useTranslation();

  return (
    <div className="border-t border-border pt-6">
      <h3 className="font-medium mb-4 flex items-center gap-2">
        <Settings2 className="w-5 h-5" />
        {t('Valuta Principale')}
      </h3>
      <p className="text-sm text-muted-foreground mb-3">
        {t('Le transazioni vengono visualizzate in questa valuta. Il controvalore viene calcolato al cambio del momento dell\'inserimento.')}
      </p>
      <Select
        value={defaultCurrency}
        onValueChange={async (v) => {
          try {
            await updateDefaultCurrency.mutateAsync(v as CurrencyCode);
            toast(t('Valuta principale aggiornata!'));
          } catch {
            toast.error(t('Errore'));
          }
        }}
      >
        <SelectTrigger className="w-full sm:w-64">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(CURRENCY_SYMBOLS) as CurrencyCode[]).map(code => (
            <SelectItem key={code} value={code}>
              {code} — {CURRENCY_SYMBOLS[code]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
