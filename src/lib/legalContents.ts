// Dati del titolare del trattamento e contenuti legali centralizzati.
// Modificare qui per propagare le modifiche a tutte le pagine legali.

export const LEGAL_OWNER = {
  name: 'Luca Baldino',
  // Email dedicata al trattamento dei dati personali (Privacy Policy, richieste GDPR).
  privacyEmail: 'privacy@savely.cc',
  // Email generale di contatto (Cookie Policy, Termini, informazioni).
  contactEmail: 'info@savely.cc',
  vatId: 'BLDLCU95H20I452X',
  address: 'Via Ettore Sacchi 102, 07046 Porto Torres (SS), Italia',
} as const;

// Repository open source del Servizio (richiamato nei Termini).
export const LEGAL_SOURCE_URL = 'https://github.com/GoryNickel9/Savely';

export const LEGAL_APP = {
  name: 'Savely',
  url: 'https://savely.cc',
  lastUpdated: '27 agosto 2026',
} as const;

// Subprocessori (hosting/database). Database ed hosting risiedono nell'UE.
export const LEGAL_SUBPROCESSORS = [
  {
    name: 'Supabase Inc.',
    purpose: 'Autenticazione, database (PostgreSQL), storage e funzioni serverless',
    region: 'Unione Europea (Irlanda)',
    // Project region AWS eu-west-1 (Dublino).
    privacyUrl: 'https://supabase.com/privacy',
  },
  {
    name: 'Vercel Inc.',
    purpose: "Hosting dell'applicazione web e funzioni serverless",
    region: 'Unione Europea (Dublino)',
    // Region Vercel dub1 (Dublino).
    privacyUrl: 'https://vercel.com/privacy',
  },
] as const;

// Email mailto precompilata per le richieste GDPR (Privacy Policy).
export const privacyMailtoHref = (subject: string) =>
  `mailto:${LEGAL_OWNER.privacyEmail}?subject=${encodeURIComponent(subject)}`;

// Email mailto precompilata per i contatti generali (Cookie Policy, Termini).
export const contactMailtoHref = (subject: string) =>
  `mailto:${LEGAL_OWNER.contactEmail}?subject=${encodeURIComponent(subject)}`;
