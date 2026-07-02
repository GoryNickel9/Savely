import { Link } from 'react-router-dom';
import LegalLayout, { LegalSection } from '@/components/legal/LegalLayout';
import { LEGAL_OWNER, LEGAL_APP, LEGAL_SUBPROCESSORS, privacyMailtoHref } from '@/lib/legalContents';

export default function Privacy() {
  return (
    <LegalLayout title="Privacy Policy" subtitle="Informativa ex art. 13 del Regolamento (UE) 2016/679 (GDPR)">
      <p>
        La presente informativa descrive come {LEGAL_OWNER.name} (di seguito, il <strong>"Titolare"</strong>) tratta i
        dati personali degli utenti della piattaforma {LEGAL_APP.name} (il <strong>"Servizio"</strong>). Leggila con
        attenzione prima di registrarti o utilizzare l'app.
      </p>

      <LegalSection number={1} title="Titolare del trattamento">
        <ul>
          <li><strong>Nome:</strong> {LEGAL_OWNER.name}</li>
          <li><strong>Email:</strong>{' '}
            <a href={`mailto:${LEGAL_OWNER.email}`}>{LEGAL_OWNER.email}</a>
          </li>
          <li><strong>P.IVA / C.F.:</strong> {LEGAL_OWNER.vatId}</li>
          <li><strong>Sede:</strong> {LEGAL_OWNER.address}</li>
        </ul>
        <p>
          Per qualsiasi richiesta relativa ai tuoi dati personali (compreso l'esercizio dei diritti di cui alla
          sez. 7) puoi scrivere al Titolare all'email sopra indicata.
        </p>
      </LegalSection>

      <LegalSection number={2} title="Tipologie di dati trattati">
        <p>Il Servizio tratta le seguenti categorie di dati personali:</p>
        <ul>
          <li><strong>Dati di registrazione e account:</strong> nome, indirizzo email, password (criptata), dati di autenticazione.</li>
          <li><strong>Dati finanziari inseriti dall'utente:</strong> transazioni, entrate/uscite, budget, risparmi, obiettivi di risparmio.</li>
          <li><strong>Dati di portfolio:</strong> asset finanziari, quantità, prezzi, ISIN, movimentazioni inserite manualmente o importate da file CSV.</li>
          <li><strong>Dati di profilazione e categorie:</strong> categorie personalizzate con etichette, emoji e colori.</li>
          <li><strong>Dati opzionali dei moduli:</strong> spese ricorrenti, registrazioni poker, dati sul fumo (liquido/CBD/THC), collezioni TCG (carte), libreria (libri/fumetti/manga), spese condivise con familiare (couple budget).</li>
          <li><strong>Dati tecnici:</strong> indirizzo IP, tipo di browser, dati di sessione necessari per il funzionamento e la sicurezza.</li>
        </ul>
        <p>
          <strong>Nessun dato di pagamento</strong> viene raccolto o trattato: il Servizio è gratuito e non gestisce transazioni finanziarie reali. I dati finanziari presenti sono soltanto quelli che tu inserisci manualmente a fini di monitoraggio.
        </p>
      </LegalSection>

      <LegalSection number={3} title="Finalità e basi giuridiche del trattamento">
        <p>I tuoi dati sono trattati per le seguenti finalità, ciascuna con la propria base giuridica:</p>
        <ul>
          <li><strong>Erogazione del Servizio (art. 6 lett. b GDPR — contratto):</strong> creazione e gestione dell'account, autenticazione, salvataggio e visualizzazione dei dati finanziari.</li>
          <li><strong>Obblighi di legge (art. 6 lett. c GDPR):</strong> eventuali adempimenti fiscali o contabili, conservazione dei log di sicurezza.</li>
          <li><strong>Legittimo interesse (art. 6 lett. f GDPR):</strong> sicurezza del Servizio, prevenzione di abusi o frodi, miglioramento tecnico e diagnosi di malfunzionamenti.</li>
          <li><strong>Consenso (art. 6 lett. a GDPR):</strong> per eventuali funzionalità opzionali che lo richiedano. Il consenso è revocabile in qualsiasi momento.</li>
        </ul>
        <p>
          Il trattamento è <strong>necessario</strong> per fornirti il Servizio: senza i dati di account e finanziari, {LEGAL_APP.name} non può funzionare. Rifiutarti di fornirli comporta l'impossibilità di registrarti o usare l'app.
        </p>
      </LegalSection>

      <LegalSection number={4} title="Destinatari dei dati e subprocessori">
        <p>
          I tuoi dati sono trattati esclusivamente dal Titolare e dai seguenti responsabili esterni del trattamento
          (subprocessori), selezionati per fornire l'infrastruttura tecnica del Servizio:
        </p>
        <ul>
          {LEGAL_SUBPROCESSORS.map((s) => (
            <li key={s.name}>
              <strong>{s.name}</strong> — {s.purpose} (regione: {s.region}).{' '}
              <a href={s.privacyUrl} target="_blank" rel="noopener noreferrer">Informativa privacy</a>.
            </li>
          ))}
        </ul>
        <p>
          I dati non vengono venduti, ceduti a terzi a fini commerciali né utilizzati per profilazione o pubblicità.
        </p>
      </LegalSection>

      <LegalSection number={5} title="Trasferimento dei dati al di fuori dell'UE">
        <p>
          L'infrastruttura del Servizio è ospitata su piattaforme cloud che possono elaborare i dati in regioni dell'Unione
          Europea o, per alcuni servizi tecnici, in paesi extra-UE. In tal caso, i trasferimenti avvengono con le garanzie
          adeguate previste dal GDPR (es. clausole contrattuali tipo approvate dalla Commissione Europea) e unicamente
          per le finalità tecniche necessarie.
        </p>
      </LegalSection>

      <LegalSection number={6} title="Periodo di conservazione">
        <p>
          I dati sono conservati per l'intera durata del tuo account. Puoi richiedere in qualsiasi momento
          l'accesso, la rettifica o la cancellazione dei tuoi dati (sez. 7). L'eliminazione dell'account comporta la
          <strong> cancellazione definitiva di tutti i dati associati</strong>, inclusi transazioni, budget, obiettivi,
          portfolio e dati dei moduli opzionali.
        </p>
        <p>
          I log tecnici necessari per la sicurezza possono essere conservati per un periodo limitato anche successivamente
          all'eliminazione dell'account, ove previsto da obblighi di legge o di tutela.
        </p>
      </LegalSection>

      <LegalSection number={7} title="I tuoi diritti (artt. 15–22 GDPR)">
        <p>In qualità di interessato hai diritto di:</p>
        <ul>
          <li><strong>Accesso (art. 15):</strong> ottenere conferma del trattamento e una copia dei tuoi dati.</li>
          <li><strong>Rettifica (art. 16):</strong> correggere dati inesatti o incompleti.</li>
          <li><strong>Cancellazione (art. 17 — "diritto all'oblio"):</strong> richiedere la cancellazione dei tuoi dati e del tuo account.</li>
          <li><strong>Limitazione (art. 18):</strong> limitare il trattamento in determinate condizioni.</li>
          <li><strong>Portabilità (art. 20):</strong> ricevere i tuoi dati in formato strutturato e riutilizzabile (CSV).</li>
          <li><strong>Opposizione (art. 21):</strong> opporti al trattamento per legittimo interesse.</li>
          <li><strong>Revoca del consenso (art. 7):</strong> revocare un consenso precedentemente prestato.</li>
          <li><strong>Reclamo all'autorità (art. 77):</strong> proporre reclamo al Garante per la Protezione dei Dati Personali (<a href="https://www.garanteprivacy.it" target="_blank" rel="noopener noreferrer">garanteprivacy.it</a>).</li>
        </ul>
        <div className="callout">
          <p className="mb-2"><strong>Come esercitare i diritti direttamente dall'app:</strong></p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Portabilità:</strong> vai su <em>Impostazioni → Import/Export → Esporta CSV</em> per scaricare tutti i tuoi dati.</li>
            <li><strong>Cancellazione:</strong> vai su <em>Impostazioni → Zona Pericolo → Elimina account</em>.</li>
            <li><strong>Rettifica:</strong> modifica i dati direttamente dalle sezioni dell'app.</li>
          </ul>
          <p className="mt-2">
            Per richieste che non puoi completare autonomamente, scrivi a{' '}
            <a href={privacyMailtoHref('Richiesta diritti GDPR')}>{LEGAL_OWNER.email}</a>.
          </p>
        </div>
      </LegalSection>

      <LegalSection number={8} title="Sicurezza dei dati">
        <p>
          Il Titolare adotta misure tecniche e organizzative adeguate a proteggere i dati personali, tra cui:
          crittografia in transito (TLS/HTTPS), autenticazione con password, isolamento dei dati per utente tramite
          Row Level Security a livello di database, e accesso limitato ai sistemi. Nessun sistema è tuttavia
          inattaccabile: nessuna garanzia di sicurezza assoluta può essere fornita.
        </p>
      </LegalSection>

      <LegalSection number={9} title="Profiling e decisioni automatizzate">
        <p>
          Il Servizio <strong>non effettua profilazione</strong> né decisioni automatizzate con effetti giuridici o
          similmente significative sull'utente (art. 22 GDPR).
        </p>
      </LegalSection>

      <LegalSection number={10} title="Modifiche all'informativa">
        <p>
          Il Titolare si riserva di aggiornare la presente informativa per riflettere cambiamenti normativi o
          funzionali del Servizio. La data di ultimo aggiornamento è indicata in fondo alla pagina. Ti invitiamo a
          consultare periodicamente questa pagina.
        </p>
      </LegalSection>

      <LegalSection number={11} title="Contatti">
        <p>
          Per qualsiasi domanda, richiesta o segnalazione relativa al trattamento dei dati personali, contatta il
          Titolare all'indirizzo{' '}
          <a href={privacyMailtoHref('Domanda Privacy')}>{LEGAL_OWNER.email}</a>.
        </p>
        <p>
          Vedi anche la <Link to="/cookies">Cookie Policy</Link> e i{' '}
          <Link to="/terms">Termini di servizio</Link>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
