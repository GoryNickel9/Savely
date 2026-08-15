// Dati del titolare del trattamento e contenuti legali centralizzati.
// Modificare qui per propagare le modifiche a tutte le pagine legali.

export const LEGAL_OWNER = {
  name: 'Luca Baldino',
  email: 'lucabaldino10@proton.me',
  // Campi opzionali: sostituire con i valori reali quando disponibili.
  vatId: '[P.IVA / C.F. da compilare]',
  address: '[Indirizzo della sede da compilare]',
} as const;

export const LEGAL_APP = {
  name: 'Savely',
  url: 'https://savely.cc',
  lastUpdated: '2 luglio 2026',
} as const;

// Subprocessori (hosting/database). Savely utilizza Supabase come BaaS.
export const LEGAL_SUBPROCESSORS = [
  {
    name: 'Supabase Inc.',
    purpose: 'Autenticazione, database (PostgreSQL), storage e funzioni serverless',
    region: 'Stati Uniti / Unione Europea (region selezionabile)',
    // Supabase offre region EU (es. eu-central-1, eu-west-1).
    privacyUrl: 'https://supabase.com/privacy',
  },
] as const;

// Email mailto precompilata per le richieste GDPR.
export const privacyMailtoHref = (subject: string) =>
  `mailto:${LEGAL_OWNER.email}?subject=${encodeURIComponent(subject)}`;
