# Verifica della release Android

Registra prove e limiti prima di distribuire la release come verificata. Questo documento distingue i controlli eseguiti sul repository dalle prove che richiedono APK, browser e dispositivo.

## Evidenze dell'11 ottobre 2026

| Controllo | Esito osservato | Metodo |
|---|---|---|
| Censimento funzionalità | ESEGUITO: route pubbliche, protette, moduli e impostazioni censiti | Lettura `src/App.tsx`, pagine e componenti condivisi |
| Service worker nel sorgente | ESEGUITO: nessuna occorrenza nelle directory analizzate | Ricerca `serviceWorker`, `service-worker`, `workbox`, `navigator.serviceWorker` in `src`, `public`, `vite.config.ts` |
| `https://savely.cc/` | ESEGUITO: HTTP 308 verso `https://www.savely.cc/` | GET senza seguire redirect; il controllo iniziale seguiva automaticamente il redirect |
| `https://www.savely.cc/` | ESEGUITO: 200, `text/html; charset=utf-8`, `public, max-age=0, must-revalidate` | GET HTTP diretto sul dominio canonico |
| `https://www.savely.cc/manifest.webmanifest` | ESEGUITO: 200, `application/manifest+json; charset=utf-8`, stesso Cache-Control | Primo GET al dominio storico con redirect seguito fino al dominio canonico |
| `https://www.savely.cc/.well-known/assetlinks.json` | FALLITO prima della pubblicazione: 200 HTML della SPA, non JSON | GET diretto senza redirect; ETag uguale alla home |
| Isolamento web | PASSATO: solo perimetro Android e Asset Links; contenuto web invariato | `node android/scripts/verify-isolation.mjs`; normalizzazione LF/CRLF |
| Regressione web | PASSATO: lint, typecheck, 228 test in 20 file e build Vite | Comandi npm eseguiti dall'agente principale |
| Asset Links nell'output web locale | PASSATO: JSON copiato in `dist/.well-known/assetlinks.json` | Build Vite e lettura del file generato |
| Unit test nativi dopo correzione manifest e dominio canonico | PASSATO: 7 test, 0 failure, 0 error | `testDebugUnitTest`, incluso `BrowserHelperManifestTest` e policy URL |
| Contratti del checker deployment | PASSATO: 10 casi, con cache, certificato errato e HTML al posto di JSON | `android/scripts/Test-DeploymentChecks.ps1`, eseguito anche da build e CI |
| Lint nativo | PASSATO: 0 errori, 3 warning | `lintDebug`: Gradle fissato a 8.13, icona legacy quadrata e icona adaptive monochrome assente |
| Build debug dopo correzione manifest | PASSATO | `assembleDebug`, eseguito dall'agente Android |
| Firma e prima build release | PASSATO per l'APK precedente alla correzione runtime | Build e verifica firma eseguite dall'agente principale; certificato sotto |
| Primo avvio su emulatore Android API 35 / Chrome | FALLITO: crash per `ManageDataLauncherActivity` assente dal manifest | Crash buffer e mapping release; correzione manifest e test di regressione aggiunti |
| Release corretta dopo il crash iniziale | PASSATO AVVIO: sito e pagina login visibili; barra browser presente perché produzione non associata | Emulatore API 35, Chrome 124; APK ancora con home al dominio storico |
| Release con dominio canonico `www` e sessione TWA stabile | PASSATO: firmata, installata e aperta a freddo e a caldo senza AndroidRuntime error | Emulatore API 35, Chrome 124; hash APK sotto; produzione aperta in fallback browser |
| Riapertura dall'icona | PASSATO nell'emulatore: stessa pagina CDP attiva torna da NotFound a `/auth`, target totali invariati | Target attivo 2; totale 3 comprendente due target storici delle prove precedenti |
| Documento nuovo dalla rete all'apertura | PASSATO: GET home con nonce riceve 200, `fromDiskCache=false`, `fromServiceWorker=false` | `android/local/opening-network.json`; `public, max-age=0, must-revalidate`; target Chrome 2 riutilizzato |
| Smoke browser anonimo sul target attivo dell'APK | PASSATO: 39 test, 0 failure | `Smoke-Browser.mjs 2`, `android/local/browser-smoke.json` del 11 ottobre ore 14:27:48 Europe/Rome; nuovo documento e target in primo piano verificati |
| Aggiornamento APK senza disinstallazione | PASSATO: release con versionCode 2 installata sopra build interna con codice 1 e stessa firma | `adb install -r`; valore di prova di `localStorage` conservato; sessione autenticata non verificata |
| Avvio della release finale dopo aggiornamento | PASSATO: avvio a freddo e buffer AndroidRuntime senza errori | Emulatore API 35 / Chrome 124; screenshot `android/local/savely-android.png` |
| Deep link Android ACTION_VIEW | BLOCCATO: comando ADB rifiutato dalla revisione automatica senza motivo disponibile | Conservazione query/fragment e origine verificata con unit test; nessuna prova device dichiarata |
| Funzioni Android con account | NON ESEGUITO | Nessuna sessione/account E2E disponibile durante questi controlli |
| Preview Vercel con Asset Links | PASSATO: home 200 HTML/max-age=0; Asset Links 200 `application/json; charset=utf-8`, impronta esatta | [Preview verificata](https://savely-cdajlhta7-gorynickel9s-projects.vercel.app/), GET eseguiti dall'agente principale; routing Vercel invariato |
| Versione aggiornata dopo deploy | NON ESEGUITO | Richiede osservazione di due aperture separate da deploy |

Il controllo HTTP è una fotografia del dominio al momento della lettura. L'aggiunta locale del file e una build web riuscita non dimostrano che Vercel lo esponga correttamente. La risposta online deve essere ricontrollata dopo la pubblicazione.

La preview dimostra che il file aggiunto viene servito come JSON senza modificare `vercel.json`. Il dominio canonico dell'APK è `www.savely.cc`: la verifica dell'associazione in produzione resta da completare. Nel log della build preview sono presenti due diagnostiche TypeScript TS2835 sugli import `./vercel` in `api/admin.ts` e `api/reset-password.ts`. Quei file sono invariati; le diagnostiche non hanno impedito il completamento del deploy. Le API non sono state collaudate attraverso questa prova HTTP.

## Preparazione del collaudo

Registra i dati nella scheda seguente. Un risultato senza ambiente ed evidenza resta NON ESEGUITO.

| Campo | Valore |
|---|---|
| Data e ora, Europe/Rome | 11 ottobre 2026; smoke definitivo ore 14:27:48 |
| Commit sorgente APK | Da compilare |
| Package / versionCode / versionName | `cc.savely.android` / `2` / `1.0.0`, fonte `android/release.json` |
| SHA-256 file APK | `de6f78b8858740de7d0d3312e4e90bbc4b1c83cac659d2cfd383dc2aecd6bb4c` |
| Dimensione APK finale | 769581 byte |
| SHA-256 certificato firma | `14:81:89:8B:EE:49:7D:37:CB:22:A3:70:79:53:82:ED:20:D2:5F:3A:E5:DF:05:65:B1:B1:80:8C:5D:DC:FC:1D` |
| Telefono/emulatore, Android API | Emulatore API 35 nella prima prova runtime; telefono reale non verificato |
| Browser/provider e versione | Chrome 124 sull'emulatore nella prova di avvio dopo correzione |
| Dominio e deploy osservato | `https://www.savely.cc` per il browser; preview con Asset Links riportata sopra |
| Account di prova e permessi, senza credenziali | Profilo anonimo; nessun account autenticato collaudato |
| Log e screenshot privi di token/dati riservati | `android/local/browser-smoke.json`, `opening-network.json`, `savely-android.png`; output locali ignorati da Git |

La prima verifica va eseguita sul browser compatibile scelto per il supporto iniziale. Ripeti i casi principali su un telefono reale prima di dichiarare il comportamento certificato su hardware. I risultati dell'emulatore devono indicare esplicitamente che provengono dall'emulatore.

La chiave locale è conservata in `%LOCALAPPDATA%\Savely\android-signing` con credenziali protette da Windows DPAPI. Il progetto richiede minSdk 23 e compila con target/compileSdk 36. Il superamento del lint non aveva individuato il componente Browser Helper mancante: il controllo di avvio resta necessario dopo il test del manifest.

## Sequenza di rilascio

1. Esegui isolamento, test/lint nativi e build release. Conserva output e checksum; verifica firma, package, SDK e assenza di segreti nell'APK.
2. Verifica il JSON online e la corrispondenza del certificato. Conferma a schermo intero con APK firmato; controlla il fallback quando l'associazione manca in un ambiente di prova.
3. Esegui [FUNCTIONAL_MATRIX.md](FUNCTIONAL_MATRIX.md) con gli account necessari. Usa dati di prova e annota dipendenze backend o permessi mancanti.
4. Prova un APK con versionCode superiore sopra quello precedente e verifica la sessione. Non disinstallare per superare il test.
5. Completa la prova di aggiornamento web e registra i risultati. Consegna APK, SHA-256 e istruzioni insieme ai casi ancora aperti.

## Prova dell'aggiornamento web

Apri l'app dall'icona con rete disponibile e annota un asset JS referenziato dal documento e un dettaglio osservabile del deploy corrente. Il controllo può usare il remote debugging del browser. Dopo un deploy web ordinario completato, apri nuovamente dall'icona e verifica documento/asset del nuovo deploy. Nessuna modifica del frontend viene introdotta per questo test.

Ripeti con il task TWA ancora esistente, dopo una chiusura completa e dopo un periodo in background. Verifica che il nuovo launcher apra una navigazione, preservando query e fragment dei link ricevuti. I segreti dei link di recovery non vanno conservati nei log.

Riaprire da Recenti mantiene la pagina corrente: registra questo comportamento separatamente. Senza rete, o con una pagina già ripristinata dal browser, il test non certifica l'aggiornamento. Un nonce nell'URL riduce il riuso della home ma non controlla tutti i livelli di cache.

## Isolamento Vercel

Confronta i file modificati con l'allowlist: `android/**`, eventuale workflow Android dedicato e `public/.well-known/assetlinks.json`. Lo script di verifica segnala qualsiasi modifica fuori perimetro rispetto alla base Git scelta. Confronta quelle eventuali con lo stato iniziale del workspace; le modifiche preesistenti vanno segnalate senza essere annullate.

Controlla che `package.json`, lockfile web, `vite.config.ts`, `vercel.json`, `tsconfig*`, sorgenti e API siano invariati dall'intervento. La build web può copiare il nuovo file pubblico come gli altri asset. Non deve eseguire Gradle o richiedere l'SDK Android.

Il workflow di build Android non pubblica il sito. Un commit della stessa repository può comunque far partire Vercel secondo le impostazioni già attive: questa versione non modifica tali impostazioni. Il deploy di `assetlinks.json` usa il normale processo esistente.

## Limiti da riportare

La parità funzionale deriva dallo stesso sito e deve essere confermata con prove TWA. MFA, file picker, download, collegamenti email, domini esterni e account admin meritano risultati distinti. Senza gli account o il dispositivo richiesti, usa BLOCCATO con causa precisa; non sostituire il caso con PASSATO perché la route esiste.

Il contenitore non corregge problemi della web app. Se un difetto dipende dal frontend, registralo e mantieni il codice web invariato; una correzione richiederà un nuovo ambito autorizzato. Un difetto nel launcher, nella firma o nei metadati Android resta nel perimetro di questo lavoro.

La navigazione anonima verifica l'accesso pubblico e il redirect a login delle route protette. Non verifica MFA, recupero attraverso email, import/export, CRUD, amministrazione o calcoli con dati personali. Il collaudo di versione aggiornata dopo un deploy e quello su un telefono reale restano da eseguire. I target CDP storici non indicano tre nuove finestre per ogni apertura: nel controllo a caldo il numero è rimasto invariato.

La prima run poteva leggere il documento precedente prima della nuova navigazione. Una run successiva ha registrato 38 PASS e 1 FAIL sul vecchio target Chrome 0, lasciato in background dalle prove precedenti. La suite definitiva seleziona esplicitamente il target attivo 2 dell'APK, lo porta in primo piano, controlla gli errori di navigazione e attende il nuovo `loaderId`: tutti i 39 casi passano. Il risultato definitivo sostituisce le due prove precedenti.

La richiesta di rete osservata all'apertura dimostra che il browser carica un nuovo documento dalla home. La prova tra due deploy diversi deve ancora confrontare gli asset caricati prima e dopo il rilascio: i due risultati hanno ambiti distinti.
