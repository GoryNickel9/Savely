# Distribuzione Android tramite GitHub

## Contratto

Gli APK restano nelle release di `GoryNickel9/Savely-Android`. Il backend della webapp accede a GitHub con una credenziale server; il browser e l’app non ricevono quella credenziale. Il dominio API è `https://www.savely.cc`: `savely.cc` risponde con un redirect 308 e il client Android rifiuta i redirect autenticati.

`GET /api/android-update?channel=stable` restituisce la release stabile. `channel=preview` seleziona la versione numerica più recente nelle ultime 100 release, comprese le alpha, scartando le draft. A parità di tre componenti numeriche la stabile precede l’anteprima; i suffissi delle anteprime non sono ordinati fra loro, come nell’attuale `AppVersion` Android. Non riutilizzare la stessa versione numerica per anteprime che devono aggiornarsi a vicenda. Le risposte non hanno cache. Il formato è:

```json
{
  "schema": 1,
  "tag_name": "v0.1.34-alpha",
  "draft": false,
  "prerelease": true,
  "html_url": "https://github.com/GoryNickel9/Savely-Android/releases/tag/v0.1.34-alpha",
  "assets": [{
    "name": "Savely.apk",
    "state": "uploaded",
    "size": 123456,
    "digest": "sha256:<64 caratteri esadecimali>",
    "browser_download_url": "https://www.savely.cc/api/android-download?tag=v0.1.34-alpha&sha256=<64 caratteri esadecimali>"
  }]
}
```

Il controllo versione è pubblico, come in PokerQuant. Non restituisce note, token GitHub, ID degli asset o URL del loro contenuto. Una release deve contenere un solo APK caricato, con nome valido, digest SHA-256 e dimensione fra 1 e 100.000.000 byte. Un errore GitHub o metadati non verificabili producono un errore, non una risposta «aggiornato».

`GET /api/android-download?tag=…&sha256=…` richiede `Authorization: Bearer <access_token Supabase>`. Il server interroga `/auth/v1/user`, rifiuta utenti anonimi e verifica di nuovo la release fissata. Un APK sostituito produce 409. Lo stream limita i byte, controlla dimensione e SHA-256, gestisce backpressure e si interrompe alla disconnessione del client. La credenziale GitHub raggiunge soltanto `api.github.com`; i redirect sono verificati e le richieste ai domini CDN consentiti non portano credenziali. Browser e Android controllano nuovamente il digest; Android conserva anche le verifiche di package, versione e certificato.

## Configurazione Vercel

| Variabile | Uso |
|---|---|
| `GH_TOKEN` | Secret server con accesso a `Savely-Android` e permesso repository **Contents: Read-only**. Configurare Production e Preview se si vuole verificare un deployment di anteprima. |
| `SUPABASE_URL` oppure `VITE_SUPABASE_URL` | URL del progetto Supabase; viene usato il progetto Savely se entrambe mancano. |
| `SUPABASE_ANON_KEY` oppure `VITE_SUPABASE_ANON_KEY` | Chiave pubblica del progetto per verificare il bearer dell’utente. La service role già presente è un fallback server. |

Non assegnare mai un prefisso `VITE_` al token GitHub. Non inserirlo nella repo, nel browser, nell’APK o nei parametri URL. Il server fallisce con 503 quando `GH_TOKEN` manca. Il 24 ottobre 2026 è stato configurato `GH_TOKEN` come secret Sensitive di Production: token fine-grained con sola lettura della sola `Savely-Android`, scadenza 22 gennaio 2027. Prima della scadenza occorre sostituirlo e ridistribuire il backend. Preview non è stata configurata.

## Attivazione

1. Creare e configurare il token GitHub con sola lettura della repo Android. Distribuire e verificare prima la webapp con i due endpoint.
2. Verificare 401 senza sessione, 200 con un utente Savely, checksum del file e 409 dopo una sostituzione simulata dell’asset. Verificare anche errori e assenza di cache.
3. Distribuire l’APK Android code35 o successivo, firmato con il certificato esistente. Il controllo passa dalla webapp; il blocco obbligatorio viene applicato dopo login/MFA/recovery. La schermata permette di uscire e accedere di nuovo se la sessione scade.
4. Installare manualmente dalla webapp la nuova build sui dispositivi rimasti sul vecchio canale. Gli APK fino alla code34 usano GitHub anonimamente e non possono scaricare dalla repository ora privata. Verificare aggiornamento e conservazione della sessione.
5. Verificare un successivo aggiornamento tramite proxy con repository privata, su dispositivo.

Su richiesta dell’utente, `Savely-Android` è stata resa privata il 24 ottobre 2026 prima dell’attivazione del proxy. GitHub conferma `PRIVATE`; l’API release anonima restituisce 404. Il proxy è stato poi attivato su `www.savely.cc` e la `v0.1.34-alpha`/code35 pubblicata nella repository privata. I metadati preview restituiscono 200 con tag, dimensione e SHA-256 della code35; il download senza sessione restituisce 401. Il vecchio updater non rileva né scarica nuovi APK; un requisito obbligatorio già memorizzato può mantenere bloccata una vecchia build fino all’installazione manuale della code35.

## Verifica riproducibile

```powershell
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium --only-shell
npx playwright test e2e/android-download.public.spec.ts --project=public-chromium --workers=1
```

I test Playwright usano una sessione sintetica e intercettano tutte le richieste Supabase: nessun account o dato reale viene creato. Coprono download verificato su desktop italiano e mobile inglese, visitatore anonimo, token scaduto e checksum errato. Per eseguirli localmente servono le variabili Vite del client; usare un progetto/chiave pubblica di fixture è sufficiente. Non impostare credenziali E2E reali se si vuole evitare il login eseguito dal global setup delle altre suite.

Il test `src/server/android-release.live.test.ts` è opt-in: con `VERIFY_ANDROID_GITHUB=1` e `GH_TOKEN` nell’ambiente effettua solo letture su GitHub, trasmette l’APK corrente attraverso un server HTTP locale e ne confronta dimensione e digest. È escluso dalla suite ordinaria per non dipendere da rete o credenziali.

## Limiti

Il proxy richiede una sessione valida; non rende esclusivi gli APK che hanno anche un URL pubblico su GitHub. Un utente può redistribuire un file già scaricato. Il browser conserva temporaneamente il file in memoria per verificarlo. I download non supportano ripresa HTTP Range. I [limiti del runtime Vercel](https://vercel.com/docs/functions/limitations) devono essere verificati sul deployment prima dell’attivazione: una prova locale dello stream non dimostra il comportamento del runtime ospitato. Non sono stati introdotti storage, licenze, permessi di modulo o servizi cloud aggiuntivi.

## Risultati locali — 24 ottobre 2026

Passano 252 test web, con un test di rete opt-in escluso dalla suite ordinaria. Il test opt-in su GitHub è stato eseguito separatamente e passa: scarica l’APK corrente tramite lo stream HTTP locale e verifica dimensione e SHA-256. Passano le cinque prove Playwright su desktop/mobile e la verifica visiva delle due catture del nuovo controllo. TypeScript e lint passano. I primi avvii del browser hanno incontrato timeout durante il caricamento dei moduli Vite; le fixture ora escludono il caricamento dei font remoti e attendono esplicitamente la UI della route lazy-loaded. Due ripetizioni Vitest hanno avuto timeout di avvio per tre worker jsdom; la suite completa finale, eseguita con un solo worker thread, passa senza errori.

Il pacchetto Vercel del proxy è importabile dal runtime Node e risponde 401 senza bearer. La build Vercel completa senza diagnostiche TypeScript: gli import server usano estensioni ESM esplicite e la validazione delle query compila anche con le impostazioni del builder. Il pacchetto usa Node.js 24, durata massima 300 secondi e cancellazione delle richieste. Il collaudo remoto passa sul deployment Vercel `dpl_7CtEyKfNUtEuuFYELrfocTrMwDYQ`; segue la distribuzione automatica del codice pubblicato in `cbd7ae6`, verificata pronta su `www.savely.cc`. I test locali precedono il cambio di visibilità; durante l’attivazione passano nuovamente i 24 test mirati del backend, dell’helper browser e del componente download.

## Verifica in produzione — 24 ottobre 2026

Passano otto controlli sul servizio distribuito con repository privata: metadati preview 200, download senza sessione e con token non valido 401, digest non corrente 409, canale non valido 400, metodo non consentito 405, download HTTP con sessione QA 200 e download dal pulsante di Impostazioni nel browser 200. Entrambe le copie dell’APK hanno 2.303.700 byte e SHA-256 `03ecb128d5a37176e33bdcf2c45a47b52366cfbefc9efab5c91efa0abf4afc6e`. La sessione host del solo account QA è chiusa con logout locale; nessuna scrittura finanziaria.

Il primo deployment prebuilt aveva endpoint funzionanti e frontend vuoto: il browser ha rilevato `Invalid supabaseUrl`. La build locale non aveva risolto correttamente la configurazione di produzione. Quel deployment è sostituito dalla build remota Vercel, sulla quale passa il download dal pulsante. `vite.config.ts` ora rifiuta URL Supabase non validi o chiave client assente durante la build; il controllo negativo con URL non valido è stato eseguito e fallisce come previsto. La CI usa una configurazione pubblica di sola compilazione, mentre Vercel usa le variabili reali del progetto. `.vercelignore` esclude file ambiente, secret locali e output di test dagli upload.

L’APK scaricato dal proxy è stato installato su emulatore API35 sopra la code34 con lo stesso certificato: login QA conservato, controllo versione reale della code35 riuscito e logout finale confermato. La prima prova del vecchio driver R02 è stata interrotta per selettori incompatibili con la UI corrente e non è conteggiata. Il collaudo su telefono fisico e un successivo upgrade verso una versione maggiore della code35 restano da eseguire.

Passa anche `HostedProxyTest` su Android API35, un test in 5,664 secondi, senza intercettazione della rete: `ReleaseRepository` legge i metadati reali e `UpdateDownloader` scarica l’asset privato tramite Savely con bearer QA. Verifica SHA-256, byte ricevuti, package, versione e certificato; un bearer non valido viene respinto. La prima esecuzione non aveva accesso al file della sessione, scritto nella directory del pacchetto di test: host e test ora usano la directory privata dell’app debug. La fixture viene consumata e la sessione host revocata con logout locale. Nessuna credenziale entra nell’APK pubblicato.

La [CI del commit funzionale](https://github.com/GoryNickel9/Savely/actions/runs/40117674622) supera build/lint, TypeScript, unit test ed E2E. L’audit dipendenze fallisce con 6 segnalazioni high e 5 moderate. Il lockfile è rimasto invariato; l’aggiornamento di queste dipendenze resta fuori da questa attivazione. La compilazione con configurazione CI pubblica di esempio passa; quella con URL Supabase non valido viene respinta.
