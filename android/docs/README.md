# Savely Android

Compila l'APK con gli strumenti nella cartella `android`, installalo sul telefono e completa la [matrice funzionale](FUNCTIONAL_MATRIX.md) prima di dichiarare la parità verificata con il sito.

Savely Android apre `https://www.savely.cc/` come Trusted Web Activity (TWA). Il browser Android esegue il sito pubblicato: l'APK contiene il launcher e le risorse Android, senza una copia del frontend. Account, API, dati e permessi restano quelli di Savely.

`savely.cc` reindirizza con HTTP 308 a `www.savely.cc`. Il launcher usa direttamente il dominio finale e verifica soltanto quello. I link espliciti al vecchio dominio possono essere convertiti al dominio canonico mantenendo percorso, query e fragment.

## Confini del progetto

Il lavoro Android lascia invariati `src`, `api`, `supabase`, dipendenze web, comandi npm, configurazioni Vite e Vercel. L'unica aggiunta web autorizzata è `public/.well-known/assetlinks.json`, che associa il dominio al certificato dell'APK. Gli strumenti Android hanno build e output separati. Un eventuale deploy web avviato da un commit Android usa comunque i comandi web esistenti; questa versione non modifica i filtri di build della dashboard Vercel.

La cartella `android/app-project` ospita il progetto nativo. Identificatore: `cc.savely.android`. Gli output distribuibili vanno in `android/dist`, esclusi dal versionamento. `.github/workflows/android.yml` compila l'APK su richiesta o per tag `android-v*` e non distribuisce il sito.

## Prerequisiti

Usa un JDK compatibile con Gradle, l'SDK Android e un browser che supporti TWA. Il progetto compila con SDK 36 e richiede Android API 23 o superiore; questo minimo del contenitore non certifica la compatibilità del sito con ogni vecchio browser. Per il primo collaudo usa Chrome aggiornato.

Il dispositivo deve poter raggiungere Savely via HTTPS. L'app non aggiunge sincronizzazione offline, notifiche, widget o un sistema OTA. La prima versione si distribuisce direttamente come APK firmato, senza pubblicazione su Google Play.

## Compilazione locale su Windows

Esegui gli script dalla radice del repository. Leggi prima i parametri con `Get-Help` se vuoi modificare i valori predefiniti.

```powershell
Get-Help .\android\scripts\Initialize-Signing.ps1 -Detailed
.\android\scripts\Initialize-Signing.ps1
Get-Help .\android\scripts\Build-Android.ps1 -Detailed
.\android\scripts\Build-Android.ps1
```

La prima inizializzazione conserva chiave e credenziali sotto `%LOCALAPPDATA%\Savely\android-signing`, fuori dal repository. Le credenziali locali protette con DPAPI sono legate all'utente Windows: per ripristinare il rilascio su un altro computer servono il backup della chiave e le password originali. Il backup deve essere accessibile al responsabile dei rilasci e conservato separatamente dai file APK.

La build locale e il workflow eseguono prima i 10 test del checker HTTP, poi `testDebugUnitTest`, `lintDebug` e `assembleRelease`. Lo script verifica firma e corrispondenza del certificato con `assetlinks.json`, genera il checksum e copia i file distribuibili in `android/dist`. Conferma il percorso dell'APK nell'output dello script. `lintRelease` e `assembleDebug` sono disponibili anche per controlli diretti del progetto.

Le build release usano le variabili `SAVELY_ANDROID_KEYSTORE`, `SAVELY_ANDROID_KEYSTORE_PASSWORD`, `SAVELY_ANDROID_KEY_ALIAS` e `SAVELY_ANDROID_KEY_PASSWORD`. Evita di inserirle nei comandi salvati, nei log o nei file versionati. Lo script locale carica le credenziali dal deposito esterno al repository.

## Pubblicazione di Digital Asset Links

1. Genera l'APK con la firma che userai per la distribuzione.
2. Confronta l'impronta SHA-256 del certificato con quella in `public/.well-known/assetlinks.json`.
3. Verifica su un deploy di prova che `/.well-known/assetlinks.json` restituisca HTTP 200 e JSON, senza reindirizzamenti o HTML della SPA.
4. Pubblica il file tramite il normale processo web e ripeti la verifica sul dominio di produzione.
5. Installa l'APK firmato e verifica l'apertura senza barra del browser.

Il nome del pacchetto e l'impronta devono riferirsi alla stessa release. Una firma debug diversa non acquisisce automaticamente l'associazione della release. Se il controllo fallisce, TWA può aprire Savely come Custom Tab con barra del browser. [Guida Android TWA](https://developer.android.com/develop/ui/views/layout/webapps/guide-trusted-web-activities-version2).

Sul dominio di produzione, il controllo deve raggiungere direttamente `https://www.savely.cc/.well-known/assetlinks.json`. Il redirect del dominio senza `www` non costituisce un'associazione verificata.

```powershell
Get-Help .\android\scripts\Verify-Deployment.ps1 -Detailed
.\android\scripts\Verify-Deployment.ps1
node .\android\scripts\verify-isolation.mjs
.\android\scripts\Test-DeploymentChecks.ps1
```

Se la verifica restituisce HTML dopo l'aggiunta del file, fermati e registra il problema. `vercel.json` resta fuori dal perimetro autorizzato; non cambiare routing o header per mascherare una verifica fallita.

## Installazione diretta

Distribuisci l'APK release insieme al suo SHA-256. Sul telefono apri il file e autorizza l'installazione dalla fonte scelta, per esempio browser o gestore file. L'utente conferma l'installazione. [Distribuzione Android fuori dallo store](https://developer.android.com/distribute/marketing-tools/alternative-distribution).

Per un aggiornamento del contenitore, aumenta `versionCode` e aggiorna `versionName` in `android/release.json`, mantieni `cc.savely.android` e usa la stessa chiave di firma. Il file è l'unica fonte dei metadati di versione per Gradle, script e workflow. Un tag deve coincidere con `android-v` seguito da `versionName`. Installa sopra la versione precedente: una disinstallazione non costituisce prova di aggiornabilità. `versionName` descrive il contenitore Android e non rappresenta la versione del sito. [Firma delle app Android](https://developer.android.com/studio/publish/app-signing).

## Aggiornamento del sito all'apertura

L'apertura dall'icona avvia una nuova navigazione verso Savely. Il launcher aggiunge alla home un parametro tecnico variabile per evitare il riuso della stessa URL di avvio. Il parametro non contiene credenziali. Le modifiche del sito arrivano attraverso il normale deploy Vercel; non richiedono un nuovo APK.

Il ritorno all'app da Recenti riprende la pagina corrente. Non forza un ricaricamento e non cancella i moduli in compilazione. I collegamenti email devono mantenere percorso, query e fragment originali, necessari a conferma account e recupero password.

Aprire dall'icona avvia invece una nuova navigazione: salva prima i dati di un modulo aperto. Il contenitore non aggiunge il recupero delle bozze al sito.

Il requisito vale con connessione disponibile, deploy completato e cache browser/server coerente. TWA usa il motore del browser e il contenitore non può leggere o invalidare direttamente cookies, `localStorage` o service worker del sito. [Architettura TWA](https://developer.android.com/develop/ui/views/layout/webapps/trusted-web-activities). Nel codice attuale non è stato individuato un service worker. Se il sito ne aggiungerà uno, il collaudo di aggiornamento andrà ripetuto.

Nell'emulatore la riapertura dall'icona ha richiesto il nuovo documento via rete con HTTP 200, senza cache disco né service worker. La prova che confronta due deploy diversi resta da completare.

## Stato della verifica

Il censimento delle 41 route e il controllo HTTP preliminare sono eseguiti. I controlli web passano: lint, TypeScript, 228 test e build Vite. Passano 7 test nativi e 10 test del checker HTTP; il lint Android riporta 0 errori e 3 warning. La release firmata sul dominio canonico `www` apre il sito su emulatore API 35 / Chrome 124, sia a freddo sia dall'icona con browser già aperto, senza crash. La barra del browser resta visibile finché Asset Links manca in produzione.

Lo smoke test anonimo sul target attivo dell'APK ha superato tutti i 39 casi: redirect delle 34 route protette e caricamento delle cinque pagine pubbliche/404. L'APK finale, versione `1.0.0` con `versionCode` 2, è stato installato sopra la build interna con codice 1 mantenendo un valore di prova nello storage browser. Lo smoke e questa prova di aggiornamento non verificano i flussi con account. La parità funzionale autenticata resta **NON ESEGUITO**. Conserva evidenze in [VALIDATION.md](VALIDATION.md) e aggiorna ogni riga della [matrice](FUNCTIONAL_MATRIX.md) dopo il test.

Per ripetere lo smoke usa un emulatore di collaudo con Chrome e profilo anonimo, apri l'APK e inoltra il socket DevTools con ADB:

```powershell
adb forward tcp:9227 localabstract:chrome_devtools_remote
node .\android\scripts\Smoke-Browser.mjs 2
```

Lo script richiede Node con `fetch` e `WebSocket` integrati, naviga il tab Savely e scrive `android/local/browser-smoke.json`, ignorato da Git. Il parametro `2` seleziona il target CDP usato nel collaudo: prima di ripetere il comando, sostituiscilo con l'identificatore del target dell'APK nel tuo emulatore. Lo script porta il target in primo piano e attende il nuovo documento prima delle asserzioni. Rifiuta un profilo con stato Supabase salvato; non eseguirlo nel profilo usato per i tuoi dati. Non invia email né inserisce transazioni.

Riferimenti tecnici e rischi della piattaforma sono raccolti in [ARCHITECTURE.md](ARCHITECTURE.md).
