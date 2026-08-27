import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import LegalLayout, { LegalSection } from '@/components/legal/LegalLayout';
import { LEGAL_OWNER, LEGAL_APP, contactMailtoHref } from '@/lib/legalContents';

export default function Cookies() {
  const { t } = useTranslation();
  return (
    <LegalLayout title={t('Cookie Policy')} subtitle={t('Informativa sui cookie e sulle tecnologie di memorizzazione locale')}>
      <p>
        {t('La presente informativa descrive i cookie e le tecnologie di memorizzazione equivalenti (es.')} <em>localStorage</em>) {t('utilizzate da {{app}}, in ottemperanza alla normativa europea (GDPR, ePrivacy) e italiana (Codice della Privacy — d.lgs. 196/2003).', { app: LEGAL_APP.name })}
      </p>

      <LegalSection number={1} title={t('Cosa sono i cookie')}>
        <p>
          {t("I cookie sono piccoli file di testo che un sito web salva nel tuo dispositivo. Servono a mantenere informazioni tra una visita e l'altra. Per estensione, qui trattiamo anche i dati salvati nel")} <em>localStorage</em> {t('del browser, che svolgono la stessa funzione tecnica.')}
        </p>
      </LegalSection>

      <LegalSection number={2} title={t('Cookie utilizzati da Savely')}>
        <p>
          {LEGAL_APP.name} {t('utilizza')} <strong>{t('esclusivamente cookie tecnici strettamente necessari')}</strong> {t('al funzionamento e alla sicurezza del Servizio.')} <strong>{t('Non utilizza')}</strong> {t('cookie di profilazione, analytics di terze parti, cookie pubblicitari o di tracciamento marketing.')}
        </p>
        <p>{t('Elenco dettagliato:')}</p>
        <ul>
          <li>
            <strong>{t('Token di sessione Supabase')}</strong> (<code>sb-*</code>, {t('salvato nel')} <em>localStorage</em>){t(": conserva le credenziali di accesso dopo il login per mantenerti autenticato tra una visita e l'altra, senza dover reinserire email e password a ogni pagina. Durata: sessione/rinnovo automatico (max ~7 giorni). Tipo: strettamente necessario.")}
          </li>
          <li>
            <strong>{t('Consenso cookie')}</strong> (<code>savely_cookie_consent</code>, <em>localStorage</em>){t(': registra che hai visualizzato e chiuso il banner di informativa cookie. Durata: 12 mesi. Tipo: strettamente necessario (funzionale).')}
          </li>
          <li>
            <strong>{t('Dati delle preferenze')}</strong> {t("(es. valuta predefinita, salvataggio dei moduli in corso): memorizzati localmente o nel tuo profilo per personalizzare l'esperienza. Tipo: funzionali/preferenziali.")}
          </li>
        </ul>
      </LegalSection>

      <LegalSection number={3} title={t('Cookie di terze parti')}>
        <p>
          {t('Il Servizio non integra reti sociali, widget, analytics o banner pubblicitari di terze parti, pertanto')} <strong>{t('non installa cookie di terze parti')}</strong>{t('. Qualora in futuro venissero introdotte funzionalità che li richiedono (es. analytics), questa informativa verrebbe aggiornata e il consenso richiesto preventivamente, con possibilità di rifiutare.')}
        </p>
      </LegalSection>

      <LegalSection number={4} title={t('Come gestire e disattivare i cookie')}>
        <p>
          {t('Puoi gestire, bloccare o eliminare i cookie tramite le impostazioni del tuo browser. Disabilitare i cookie tecnici di sessione ti impedirà di accedere a {{app}}. Istruzioni per i browser principali:', { app: LEGAL_APP.name })}
        </p>
        <ul>
          <li>
            <a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer">{t('Google Chrome')}</a>
          </li>
          <li>
            <a href="https://support.mozilla.org/it/kb/Gli%20cookie" target="_blank" rel="noopener noreferrer">{t('Mozilla Firefox')}</a>
          </li>
          <li>
            <a href="https://support.apple.com/it-it/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer">{t('Apple Safari')}</a>
          </li>
          <li>
            <a href="https://support.microsoft.com/it-it/microsoft-edge/eliminare-i-cookie-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener noreferrer">{t('Microsoft Edge')}</a>
          </li>
        </ul>
      </LegalSection>

      <LegalSection number={5} title={t('Banner di informativa')}>
        <p>
          {t("Al primo accesso viene mostrato un banner informativo che rinvia alla presente Cookie Policy. Chiudendolo, registriamo nel tuo browser l'avvenuta visualizzazione, in modo da non mostrartelo nuovamente per 12 mesi.")}
        </p>
      </LegalSection>

      <LegalSection number={6} title={t('Contatti')}>
        <p>
          {t("Per domande relative ai cookie, contatta il Titolare all'indirizzo")}{' '}
          <a href={contactMailtoHref('Domanda Cookie')}>{LEGAL_OWNER.contactEmail}</a>.
        </p>
        <p>
          {t('Vedi anche la')} <Link to="/privacy">{t('Privacy Policy')}</Link> {t('e i')}{' '}
          <Link to="/terms">{t('Termini di servizio')}</Link>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
