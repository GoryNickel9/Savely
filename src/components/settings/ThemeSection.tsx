import { useTranslation } from 'react-i18next';
import { useTheme } from 'next-themes';
import { SunMoon } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const THEME_OPTIONS = [
  { value: 'light', emoji: '☀️', labelKey: 'Chiaro' },
  { value: 'dark', emoji: '🌙', labelKey: 'Scuro' },
  { value: 'system', emoji: '💻', labelKey: 'Sistema' },
] as const;

/**
 * Sezione "Tema" di Settings: la scelta (chiaro/scuro/sistema) è persistita
 * sul dispositivo tramite next-themes, non sul profilo account.
 */
export default function ThemeSection() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  return (
    <div className="border-t border-border pt-6">
      <h3 className="font-medium mb-4 flex items-center gap-2">
        <SunMoon className="w-5 h-5" />
        {t('Tema')}
      </h3>
      <p className="text-sm text-muted-foreground mb-3">
        {t("Scegli l'aspetto dell'interfaccia. La preferenza è salvata su questo dispositivo.")}
      </p>
      <Select value={theme ?? 'system'} onValueChange={(v) => setTheme(v)}>
        <SelectTrigger className="w-full sm:w-64">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {THEME_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.emoji} {t(option.labelKey)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
