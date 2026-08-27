// Dati del titolare del trattamento e contenuti legali centralizzati.
// Modificare qui per propagare le modifiche a tutte le pagine legali.

export const LEGAL_OWNER = {
  name: 'Luca Baldino',
  // Email dedicata al trattamento dei dati personali (Privacy Policy, richieste GDPR).
  privacyEmail: 'privacy@savely.cc',
  // Email generale di contatto (Cookie Policy, Termini, informazioni).
  contactEmail: 'info@savely.it',
  vatId: 'BLDLCU95H20I452X',
  address: 'Via Ettore Sacchi 102, 07046 Porto Torres (SS), Italia',
} as const;

export const LEGAL_APP = {
  name: 'Savely',
  url: 'https://savely.cc',
  lastUpdated: '27 agosto 2026',
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

// Email mailto precompilata per le richieste GDPR (Privacy Policy).
export const privacyMailtoHref = (subject: string) =>
  `mailto:${LEGAL_OWNER.privacyEmail}?subject=${encodeURIComponent(subject)}`;

// Email mailto precompilata per i contatti generali (Cookie Policy, Termini).
export const contactMailtoHref = (subject: string) =>
  `mailto:${LEGAL_OWNER.contactEmail}?subject=${encodeURIComponent(subject)}`;
