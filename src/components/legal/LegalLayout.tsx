import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Shield, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LEGAL_APP } from '@/lib/legalContents';

/**
 * Layout condiviso per le pagine legali pubbliche (/privacy, /cookies, /terms).
 * Indipendente da MainLayout (nessuna sidebar, nessun auth required) così da
 * essere raggiungibile anche da utenti non autenticati (es. dal footer di Auth).
 */
export default function LegalLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background dark">
      {/* Header */}
      <header className="border-b border-border/50 bg-sidebar/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Shield className="w-5 h-5" />
            </div>
            <span className="text-xl font-display font-bold">{LEGAL_APP.name}</span>
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t("Torna all'app")}
            </Link>
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold mb-2">{title}</h1>
          {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
        </div>

        <article className="prose-legal space-y-8 text-foreground/90 leading-relaxed">
          {children}
        </article>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-border/50 text-sm text-muted-foreground space-y-3">
          <p>{t('Ultimo aggiornamento: {{date}}', { date: LEGAL_APP.lastUpdated })}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <Link to="/privacy" className="hover:text-foreground hover:underline">{t('Privacy Policy')}</Link>
            <Link to="/cookies" className="hover:text-foreground hover:underline">{t('Cookie Policy')}</Link>
            <Link to="/terms" className="hover:text-foreground hover:underline">{t('Termini di servizio')}</Link>
          </div>
          <p>{t('© {{year}} {{name}}. Tutti i diritti riservati.', { year: new Date().getFullYear(), name: LEGAL_APP.name })}</p>
        </footer>
      </main>
    </div>
  );
}

/** Sezione numerata riutilizzabile nelle pagine legali. */
export function LegalSection({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold flex items-baseline gap-2">
        <span className="text-primary font-mono text-sm">{number}.</span>
        <span>{title}</span>
      </h2>
      <div className="space-y-2 pl-6">{children}</div>
    </section>
  );
}
