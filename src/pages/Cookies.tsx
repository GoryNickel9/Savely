import { Link } from 'react-router';
import LegalLayout, { LegalSection } from '@/components/legal/LegalLayout';
import { LEGAL_OWNER, LEGAL_APP, privacyMailtoHref } from '@/lib/legalContents';

export default function Cookies() {
  return (
    <LegalLayout title="Cookie Policy" subtitle="Informativa sui cookie e sulle tecnologie di memorizzazione locale">
      <p>
        La presente informativa descrive i cookie e le tecnologie di memorizzazione equivalenti (es. <em>localStorage</em>)
        utilizzate da {LEGAL_APP.name}, in ottemperanza alla normativa europea (GDPR, ePrivacy) e italiana (Codice della
        Privacy — d.lgs. 196/2003).
      </p>

      <LegalSection number={1} title="Cosa sono i cookie">
        <p>
          I cookie sono piccoli file di testo che un sito web salva nel tuo dispositivo. Servono a mantenere informazioni
          tra una visita e l'altra. Per estensione, qui trattiamo anche i dati salvati nel <em>localStorage</em> del
          browser, che svolgono la stessa funzione tecnica.
        </p>
      </LegalSection>

      <LegalSection number={2} title="Cookie utilizzati da Spendy">
        <p>
          {LEGAL_APP.name} utilizza <strong>esclusivamente cookie tecnici strettamente necessari</strong> al
          funzionamento e alla sicurezza del Servizio. <strong>Non utilizza</strong> cookie di profilazione, analytics
          di terze parti, cookie pubblicitari o di tracciamento marketing.
        </p>
        <p>Elenco dettagliato:</p>
        <ul>
          <li>
            <strong>Token di sessione Supabase</strong> (<code>sb-*</code>, salvato nel <em>localStorage</em>): conserva
            le credenziali di accesso dopo il login per mantenerti autenticato tra una visita e l'altra, senza dover
            reinserire email e password a ogni pagina. Durata: sessione/rinnovo automatico (max ~7 giorni). Tipo:
            strettamente necessario.
          </li>
          <li>
            <strong>Consenso cookie</strong> (<code>spendy_cookie_consent</code>, <em>localStorage</em>): registra che
            hai visualizzato e chiuso il banner di informativa cookie. Durata: 12 mesi. Tipo: strettamente necessario
            (funzionale).
          </li>
          <li>
            <strong>Dati delle preferenze</strong> (es. valuta predefinita, salvataggio dei moduli in corso): memorizzati
            localmente o nel tuo profilo per personalizzare l'esperienza. Tipo: funzionali/preferenziali.
          </li>
        </ul>
        <div className="callout">
          Poiché questi elementi sono <strong>strettamente necessari</strong> al funzionamento del Servizio, vengono
          installati senza bisogno di un consenso preventivo (art. 122 del Codice della Privacy). Disattivarli
          impedirebbe l'accesso e l'uso dell'app.
        </div>
      </LegalSection>

      <LegalSection number={3} title="Cookie di terze parti">
        <p>
          Il Servizio non integra reti sociali, widget, analytics o banner pubblicitari di terze parti, pertanto
          <strong> non installa cookie di terze parti</strong>. Qualora in futuro venissero introdotte funzionalità
          che li richiedono (es. analytics), questa informativa verrebbe aggiornata e il consenso richiesto
          preventivamente, con possibilità di rifiutare.
        </p>
      </LegalSection>

      <LegalSection number={4} title="Come gestire e disattivare i cookie">
        <p>
          Puoi gestire, bloccare o eliminare i cookie tramite le impostazioni del tuo browser. Disabilitare i cookie
          tecnici di sessione ti impedirà di accedere a {LEGAL_APP.name}. Istruzioni per i browser principali:
        </p>
        <ul>
          <li>
            <a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer">Google Chrome</a>
          </li>
          <li>
            <a href="https://support.mozilla.org/it/kb/Gli%20cookie" target="_blank" rel="noopener noreferrer">Mozilla Firefox</a>
          </li>
          <li>
            <a href="https://support.apple.com/it-it/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer">Apple Safari</a>
          </li>
          <li>
            <a href="https://support.microsoft.com/it-it/microsoft-edge/eliminare-i-cookie-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener noreferrer">Microsoft Edge</a>
          </li>
        </ul>
      </LegalSection>

      <LegalSection number={5} title="Banner di informativa">
        <p>
          Al primo accesso viene mostrato un banner informativo che rinvia alla presente Cookie Policy. Chiudendolo,
          registriamo nel tuo browser l'avvenuta visualizzazione, in modo da non mostrartelo nuovamente per 12 mesi.
        </p>
      </LegalSection>

      <LegalSection number={6} title="Contatti">
        <p>
          Per domande relative ai cookie, contatta il Titolare all'indirizzo{' '}
          <a href={privacyMailtoHref('Domanda Cookie')}>{LEGAL_OWNER.email}</a>.
        </p>
        <p>
          Vedi anche la <Link to="/privacy">Privacy Policy</Link> e i{' '}
          <Link to="/terms">Termini di servizio</Link>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
