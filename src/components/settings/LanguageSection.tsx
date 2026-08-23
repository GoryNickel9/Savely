import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProfile } from '@/hooks/useProfile';
import { useToast } from '@/hooks/use-toast';
import { SUPPORTED_LANGUAGES, changeLanguage, type LanguageCode } from '@/i18n';

/**
 * Sezione "Lingua" di Settings. Estratta da Settings.tsx (TD-006).
 */
export default function LanguageSection() {
  const { updateLanguage } = useProfile();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();

  return (
    <div className="border-t border-border pt-6">
      <h3 className="font-medium mb-4 flex items-center gap-2">
        <Languages className="w-5 h-5" />
        {t('Lingua')}
      </h3>
      <p className="text-sm text-muted-foreground mb-3">
        {t('La lingua dell\'interfaccia. La preferenza è salvata sul tuo account e applicata automaticamente su tutti i dispositivi.')}
      </p>
      <Select
        value={i18n.language}
        onValueChange={async (v) => {
          changeLanguage(v as LanguageCode);
          try {
            await updateLanguage.mutateAsync(v as LanguageCode);
            toast({ title: t('Lingua aggiornata!') });
          } catch {
            toast({ title: t('Errore'), variant: 'destructive' });
          }
        }}
      >
        <SelectTrigger className="w-full sm:w-64">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SUPPORTED_LANGUAGES.map((lang) => (
            <SelectItem key={lang.code} value={lang.code}>
              {lang.flag} {lang.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
