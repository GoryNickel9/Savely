import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import LegalLayout, { LegalSection } from '@/components/legal/LegalLayout';
import { LEGAL_OWNER, LEGAL_APP, LEGAL_SUBPROCESSORS, privacyMailtoHref } from '@/lib/legalContents';

export default function Privacy() {
  const { t } = useTranslation();
  return (
    <LegalLayout title={t('Privacy Policy')} subtitle={t('Informativa ex art. 13 del Regolamento (UE) 2016/679 (GDPR)')}>
      <p>
        {t('La presente informativa descrive come {{owner}} (di seguito, il', { owner: LEGAL_OWNER.name })}{' '}
        <strong>{t('"Titolare"')}</strong>
        {t(') tratta i dati personali degli utenti della piattaforma {{app}} (il', { app: LEGAL_APP.name })}{' '}
        <strong>{t('"Servizio"')}</strong>
        {t("). Leggila con attenzione prima di registrarti o utilizzare l'app.")}
      </p>

      <LegalSection number={1} title={t('Titolare del trattamento')}>
        <ul>
          <li><strong>{t('Nome:')}</strong> {LEGAL_OWNER.name}</li>
          <li><strong>{t('Email:')}</strong>{' '}
            <a href={`mailto:${LEGAL_OWNER.privacyEmail}`}>{LEGAL_OWNER.privacyEmail}</a>
          </li>
          <li><strong>{t('Codice fiscale:')}</strong> {LEGAL_OWNER.vatId}</li>
          <li><strong>{t('Sede:')}</strong> {t(LEGAL_OWNER.address)}</li>
        </ul>
        <p>
          {t("Per qualsiasi richiesta relativa ai tuoi dati personali (compreso l'esercizio dei diritti di cui alla sez. 7) puoi scrivere al Titolare all'email sopra indicata.")}
        </p>
      </LegalSection>

      <LegalSection number={2} title={t('Tipologie di dati trattati')}>
        <p>{t('Il Servizio tratta le seguenti categorie di dati personali:')}</p>
        <ul>
          <li><strong>{t('Dati di registrazione e account:')}</strong> {t('nome, indirizzo email, password (criptata), dati di autenticazione.')}</li>
          <li><strong>{t("Dati finanziari inseriti dall'utente:")}</strong> {t('transazioni, entrate/uscite, budget, risparmi, obiettivi di risparmio.')}</li>
          <li><strong>{t('Dati di portfolio:')}</strong> {t('asset finanziari, quantità, prezzi, ISIN, movimentazioni inserite manualmente o importate da file CSV.')}</li>
          <li><strong>{t('Dati di profilazione e categorie:')}</strong> {t('categorie personalizzate con etichette, emoji e colori.')}</li>
          <li><strong>{t('Dati opzionali dei moduli:')}</strong> {t('spese ricorrenti, dati sul fumo (liquido/CBD/THC), collezioni TCG (carte), libreria (libri/fumetti/manga), spese condivise con familiare (couple budget).')}</li>
          <li><strong>{t('Dati tecnici:')}</strong> {t('indirizzo IP, tipo di browser, dati di sessione necessari per il funzionamento e la sicurezza.')}</li>
        </ul>
        <p>
          <strong>{t('Nessun dato di pagamento')}</strong> {t('viene raccolto o trattato: il Servizio è gratuito e non gestisce transazioni finanziarie reali. I dati finanziari presenti sono soltanto quelli che tu inserisci manualmente a fini di monitoraggio.')}
        </p>
      </LegalSection>

      <LegalSection number={3} title={t('Finalità e basi giuridiche del trattamento')}>
        <p>{t('I tuoi dati sono trattati per le seguenti finalità, ciascuna con la propria base giuridica:')}</p>
        <ul>
          <li><strong>{t('Erogazione del Servizio (art. 6 lett. b GDPR — contratto):')}</strong> {t("creazione e gestione dell'account, autenticazione, salvataggio e visualizzazione dei dati finanziari.")}</li>
          <li><strong>{t('Obblighi di legge (art. 6 lett. c GDPR):')}</strong> {t('eventuali adempimenti fiscali o contabili, conservazione dei log di sicurezza.')}</li>
          <li><strong>{t('Legittimo interesse (art. 6 lett. f GDPR):')}</strong> {t('sicurezza del Servizio, prevenzione di abusi o frodi, miglioramento tecnico e diagnosi di malfunzionamenti.')}</li>
          <li><strong>{t('Consenso (art. 6 lett. a GDPR):')}</strong> {t('per eventuali funzionalità opzionali che lo richiedano. Il consenso è revocabile in qualsiasi momento.')}</li>
        </ul>
        <p>
          {t('Il trattamento è')} <strong>{t('necessario')}</strong> {t("per fornirti il Servizio: senza i dati di account e finanziari, {{app}} non può funzionare. Rifiutarti di fornirli comporta l'impossibilità di registrarti o usare l'app.", { app: LEGAL_APP.name })}
        </p>
      </LegalSection>

      <LegalSection number={4} title={t('Destinatari dei dati e subprocessori')}>
        <p>
          {t("I tuoi dati sono trattati esclusivamente dal Titolare e dai seguenti responsabili esterni del trattamento (subprocessori), selezionati per fornire l'infrastruttura tecnica del Servizio:")}
        </p>
        <ul>
          {LEGAL_SUBPROCESSORS.map((s) => (
            <li key={s.name}>
              <strong>{s.name}</strong> — {t(s.purpose)} ({t('regione')}: {t(s.region)}).{' '}
              <a href={s.privacyUrl} target="_blank" rel="noopener noreferrer">{t('Informativa privacy')}</a>.
            </li>
          ))}
        </ul>
        <p>
          {t('I dati non vengono venduti, ceduti a terzi a fini commerciali né utilizzati per profilazione o pubblicità.')}
        </p>
      </LegalSection>

      <LegalSection number={5} title={t("Trasferimento dei dati al di fuori dell'UE")}>
        <p>
          {t("L'infrastruttura del Servizio risiede nell'Unione Europea: il database è ospitato in Irlanda (Supabase) e l'applicazione è distribuita dalla regione di Dublino (Vercel). Non sono previsti trasferimenti intenzionali dei dati fuori dallo Spazio Economico Europeo; qualora in futuro fossero necessari trasferimenti tecnici extra-UE, avverrebbero con le garanzie adeguate previste dal GDPR (es. clausole contrattuali tipo approvate dalla Commissione Europea) e unicamente per le finalità tecniche necessarie.")}
        </p>
      </LegalSection>

      <LegalSection number={6} title={t('Periodo di conservazione')}>
        <p>
          {t("I dati sono conservati per l'intera durata del tuo account. Puoi richiedere in qualsiasi momento l'accesso, la rettifica o la cancellazione dei tuoi dati (sez. 7). L'eliminazione dell'account comporta la")} <strong>{t('cancellazione definitiva di tutti i dati associati')}</strong>{t(', inclusi transazioni, budget, obiettivi, portfolio e dati dei moduli opzionali.')}
        </p>
        <p>
          {t("I log tecnici necessari per la sicurezza possono essere conservati per un periodo limitato anche successivamente all'eliminazione dell'account, ove previsto da obblighi di legge o di tutela.")}
        </p>
      </LegalSection>

      <LegalSection number={7} title={t('I tuoi diritti (artt. 15–22 GDPR)')}>
        <p>{t('In qualità di interessato hai diritto di:')}</p>
        <ul>
          <li><strong>{t('Accesso (art. 15):')}</strong> {t('ottenere conferma del trattamento e una copia dei tuoi dati.')}</li>
          <li><strong>{t('Rettifica (art. 16):')}</strong> {t('correggere dati inesatti o incompleti.')}</li>
          <li><strong>{t('Cancellazione (art. 17 — "diritto all\'oblio"):')}</strong> {t('richiedere la cancellazione dei tuoi dati e del tuo account.')}</li>
          <li><strong>{t('Limitazione (art. 18):')}</strong> {t('limitare il trattamento in determinate condizioni.')}</li>
          <li><strong>{t('Portabilità (art. 20):')}</strong> {t('ricevere i tuoi dati in formato strutturato e riutilizzabile (CSV).')}</li>
          <li><strong>{t('Opposizione (art. 21):')}</strong> {t('opporti al trattamento per legittimo interesse.')}</li>
          <li><strong>{t('Revoca del consenso (art. 7):')}</strong> {t('revocare un consenso precedentemente prestato.')}</li>
          <li><strong>{t("Reclamo all'autorità (art. 77):")}</strong> {t('proporre reclamo al Garante per la Protezione dei Dati Personali (')}<a href="https://www.garanteprivacy.it" target="_blank" rel="noopener noreferrer">garanteprivacy.it</a>).</li>
        </ul>
        <div className="callout">
          <p className="mb-2"><strong>{t("Come esercitare i diritti direttamente dall'app:")}</strong></p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>{t('Portabilità:')}</strong> {t('vai su')} <em>{t('Impostazioni → Import/Export → Esporta CSV')}</em> {t('per scaricare tutti i tuoi dati.')}</li>
            <li><strong>{t('Cancellazione:')}</strong> {t('vai su')} <em>{t('Impostazioni → Zona Pericolo → Elimina account')}</em>.</li>
            <li><strong>{t('Rettifica:')}</strong> {t("modifica i dati direttamente dalle sezioni dell'app.")}</li>
          </ul>
          <p className="mt-2">
            {t('Per richieste che non puoi completare autonomamente, scrivi a')}{' '}
            <a href={privacyMailtoHref('Richiesta diritti GDPR')}>{LEGAL_OWNER.privacyEmail}</a>.
          </p>
        </div>
      </LegalSection>

      <LegalSection number={8} title={t('Sicurezza dei dati')}>
        <p>
          {t('Il Titolare adotta misure tecniche e organizzative adeguate a proteggere i dati personali, tra cui: crittografia in transito (TLS/HTTPS), autenticazione con password, isolamento dei dati per utente tramite Row Level Security a livello di database, e accesso limitato ai sistemi. Nessun sistema è tuttavia inattaccabile: nessuna garanzia di sicurezza assoluta può essere fornita.')}
        </p>
      </LegalSection>

      <LegalSection number={9} title={t('Profiling e decisioni automatizzate')}>
        <p>
          {t('Il Servizio')} <strong>{t('non effettua profilazione')}</strong> {t("né decisioni automatizzate con effetti giuridici o similmente significative sull'utente (art. 22 GDPR).")}
        </p>
      </LegalSection>

      <LegalSection number={10} title={t("Modifiche all'informativa")}>
        <p>
          {t('Il Titolare si riserva di aggiornare la presente informativa per riflettere cambiamenti normativi o funzionali del Servizio. La data di ultimo aggiornamento è indicata in fondo alla pagina. Ti invitiamo a consultare periodicamente questa pagina.')}
        </p>
      </LegalSection>

      <LegalSection number={11} title={t('Contatti')}>
        <p>
          {t("Per qualsiasi domanda, richiesta o segnalazione relativa al trattamento dei dati personali, contatta il Titolare all'indirizzo")}{' '}
          <a href={privacyMailtoHref('Domanda Privacy')}>{LEGAL_OWNER.privacyEmail}</a>.
        </p>
        <p>
          {t('Vedi anche la')} <Link to="/cookies">{t('Cookie Policy')}</Link> {t('e i')}{' '}
          <Link to="/terms">{t('Termini di servizio')}</Link>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
