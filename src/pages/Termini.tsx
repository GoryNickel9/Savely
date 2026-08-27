import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import LegalLayout, { LegalSection } from '@/components/legal/LegalLayout';
import { LEGAL_OWNER, LEGAL_APP, LEGAL_SOURCE_URL, contactMailtoHref } from '@/lib/legalContents';

export default function Termini() {
  const { t } = useTranslation();
  return (
    <LegalLayout title={t('Termini di servizio')} subtitle={t("Condizioni d'uso della piattaforma Savely")}>
      <p>
        {t("L'accesso e l'utilizzo della piattaforma {{app}} (il", { app: LEGAL_APP.name })}{' '}
        <strong>{t('"Servizio"')}</strong>
        {t(") implicano l'accettazione integrale dei presenti Termini di servizio. Ti invitiamo a leggerli attentamente. Registrando un account dichiari di averli compresi e accettati.")}
      </p>

      <LegalSection number={1} title={t('Descrizione del Servizio')}>
        <p>
          {t("{{app}} è un'applicazione web gratuita per la gestione e il monitoraggio della finanza personale. Consente di registrare entrate e uscite, definire budget, tracciare obiettivi di risparmio, monitorare un portfolio di investimenti e accedere a moduli opzionali (poker, fumo, collezioni TCG, libreria, spese condivise con familiari). Il Servizio è fornito \"così com'è\", a scopo informativo e di produttività personale.", { app: LEGAL_APP.name })}
        </p>
      </LegalSection>

      <LegalSection number={2} title={t("Account e responsabilità dell'utente")}>
        <ul>
          <li>{t('Per utilizzare il Servizio devi avere almeno 16 anni o il consenso di chi esercita la responsabilità genitoriale.')}</li>
          <li>{t("Sei responsabile dell'accuratezza, della veridicità e della liceità dei dati che inserisci.")}</li>
          <li>{t('Sei responsabile della riservatezza delle tue credenziali di accesso e di tutte le attività svolte dal tuo account.')}</li>
          <li>{t('Ti impegni a non usare il Servizio per scopi illeciti, abusivi o dannosi per terzi.')}</li>
          <li>{t('È consentito un account per persona.')}</li>
        </ul>
      </LegalSection>

      <LegalSection number={3} title={t('Natura informativa — non consulenza finanziaria')}>
        <p>
          {t("{{app}} non fornisce consulenza finanziaria, fiscale, legale o d'investimento. I calcoli, gli indicatori (es. FIRE, asset allocation) e le statistiche mostrate hanno scopo unicamente informativo e didattico. Non costituiscono raccomandazione personalizzata.", { app: LEGAL_APP.name })}
        </p>
        <p>
          {t('Le decisioni finanziarie sono di tua esclusiva responsabilità. Consulta professionisti abilitati prima di assumere decisioni rilevanti.')}
        </p>
      </LegalSection>

      <LegalSection number={4} title={t('Proprietà intellettuale')}>
        <p>
          {t('Il codice sorgente del Servizio è pubblicato come software open source su')}{' '}
          <a href={LEGAL_SOURCE_URL} target="_blank" rel="noopener noreferrer">GitHub</a>
          {t(": l'utilizzo del codice è disciplinato dalla licenza riportata nel repository, mentre l'utilizzo del Servizio ospitato resta regolato dai presenti Termini.")}
        </p>
        <p>
          {t('I dati che inserisci rimangono di tua proprietà. Marchi, identità visiva e contenuti del sito restano del Titolare, che non ne concede alcun uso salvo quanto previsto dalla licenza del codice.')}
        </p>
      </LegalSection>

      <LegalSection number={5} title={t("Sospensione e cessazione dell'account")}>
        <p>
          {t('Puoi chiudere il tuo account in qualsiasi momento dalla sezione')} <em>{t('Impostazioni → Zona Pericolo → Elimina account')}</em>{t(": l'eliminazione è irreversibile e comporta la cancellazione di tutti i tuoi dati.")}
        </p>
        <p>
          {t('Il Titolare si riserva di sospendere o disabilitare account in caso di violazione dei presenti Termini, di usi abusivi del Servizio o per motivi di sicurezza.')}
        </p>
      </LegalSection>

      <LegalSection number={6} title={t('Limitazione di responsabilità')}>
        <p>
          {t("Il Servizio è fornito \"così com'è\" e \"come disponibile\". Nella misura massima consentita dalla legge, il Titolare non risponde di interruzioni, malfunzionamenti, perdita di dati, danni diretti o indiretti derivanti dall'uso o dall'impossibilità di usare il Servizio. Non è garantita la continuità assoluta del servizio né l'assenza di errori.")}
        </p>
        <p>
          {t('Si raccomanda di mantenere copie di backup dei dati rilevanti utilizzando la funzione di esportazione disponibile in Impostazioni.')}
        </p>
      </LegalSection>

      <LegalSection number={7} title={t('Modifiche al Servizio e ai Termini')}>
        <p>
          {t('Il Titolare può aggiornare o modificare il Servizio e i presenti Termini. Le modifiche ai Termini entrano in vigore dalla pubblicazione su questa pagina. Un uso continuato del Servizio dopo le modifiche equivale ad accettazione.')}
        </p>
      </LegalSection>

      <LegalSection number={8} title={t('Legge applicabile e foro competente')}>
        <p>
          {t('I presenti Termini sono regolati dalla legge italiana e dal Regolamento (UE) 2016/679 (GDPR). Per qualsiasi controversia è competente in via esclusiva il Foro del domicilio del Titolare, salva diversa disposizione inderogabile di legge a tutela del consumatore.')}
        </p>
      </LegalSection>

      <LegalSection number={9} title={t('Contatti')}>
        <p>
          {t("Per domande sui presenti Termini, contatta il Titolare all'indirizzo")}{' '}
          <a href={contactMailtoHref('Domanda Termini')}>{LEGAL_OWNER.contactEmail}</a>.
        </p>
        <p>
          {t('Vedi anche la')} <Link to="/privacy">{t('Privacy Policy')}</Link> {t('e la')}{' '}
          <Link to="/cookies">{t('Cookie Policy')}</Link>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
