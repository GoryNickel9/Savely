import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Cookie, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Chiave localStorage e durata del consenso informativo (12 mesi).
const CONSENT_KEY = 'spendy_cookie_consent';
const CONSENT_TTL_MS = 365 * 24 * 60 * 60 * 1000;

type ConsentRecord = { value: 'essential'; ts: number };

function readConsent(): boolean {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as ConsentRecord;
    if (!parsed || typeof parsed.ts !== 'number') return false;
    // Scaduto: considera come non ancora accettato.
    if (Date.now() - parsed.ts > CONSENT_TTL_MS) return false;
    return true;
  } catch {
    return false;
  }
}

function writeConsent() {
  const record: ConsentRecord = { value: 'essential', ts: Date.now() };
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(record));
  } catch {
    // localStorage non disponibile (es. modalità privata): ignora senza rompere.
  }
}

/**
 * Banner informativo cookie (regime "solo essenziali").
 * Si mostra finché l'utente non lo chiude; la scelta persiste 12 mesi.
 * Non blocca alcuno script: l'app utilizza solo cookie tecnici necessari.
 */
export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Mostra solo se il consenso non è ancora stato registrato.
    if (!readConsent()) setVisible(true);
  }, []);

  const accept = () => {
    writeConsent();
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Informativa cookie"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4"
    >
      <div className="max-w-3xl mx-auto glass rounded-xl border-border shadow-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
            <Cookie className="w-5 h-5" />
          </div>
          <p className="text-sm text-muted-foreground">
            Utilizziamo solo <strong className="text-foreground">cookie tecnici necessari</strong> al funzionamento
            (autenticazione, preferenze). Nessun cookie di profilazione o analytics.{' '}
            <Link to="/cookies" className="text-primary hover:underline">
              Scopri di più
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" onClick={accept}>
            Accetta e chiudi
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={accept}
            aria-label="Chiudi informativa cookie"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
