# Architettura Android

L'APK Savely contiene un launcher TWA. Il browser esegue il frontend all'origine `https://www.savely.cc`; le chiamate relative a `/api` rimangono sullo stesso dominio e i servizi Supabase restano quelli del sito.

## Decisione

TWA risponde al requisito di distribuire un'icona Android mantenendo tutte le funzioni nella versione web esistente. La prima versione non introduce un frontend mobile duplicato, plugin Capacitor o pacchetti Live Updates. L'associazione tra sito e pacchetto si verifica con Digital Asset Links. [Android TWA](https://developer.android.com/develop/ui/views/layout/webapps/trusted-web-activities).

| Componente | Responsabilità |
|---|---|
| `android/app-project` | Manifest, launcher, risorse e compilazione Android |
| `android/scripts` | Firma locale, build, checksum e controlli di isolamento/deployment |
| `android/release.json` | Unica fonte di `versionCode` e `versionName` del contenitore |
| `android/docs` | Istruzioni, matrice funzionale ed evidenze |
| `public/.well-known/assetlinks.json` | Relazione pubblica tra dominio, package e certificato |
| Sito Vercel esistente | Frontend, routing, API e rilascio delle funzioni |

Le build Android non hanno bisogno di eseguire Vite. Vercel continua a usare il processo web attuale. L'aggiunta di un progetto nativo non impedisce a Vercel di avviare una build web su un commit della repository: l'isolamento garantisce che quella build non compili Android. Il filtro delle build Vercel non viene modificato in questo intervento.

`android/.ignore` esclude i file Android dallo scanner automatico Tailwind, che altrimenti potrebbe aggiungere classi al CSS web. `.ignore` riguarda l'analisi dei file; `.gitignore` continua a proteggere segreti e output, mentre i sorgenti nativi rimangono versionabili. Il controllo `verify-web-scanner.mjs` verifica queste due proprietà.

## Browser, sessione e permessi

TWA si basa su Custom Tabs. Browser, cookie, storage e password salvate seguono il provider del dispositivo. Cambio di browser, profilo o cancellazione dei dati browser possono richiedere un nuovo login. Il contenitore non legge i token web e non modifica i permessi degli utenti Savely. [Custom Tabs](https://developer.chrome.com/docs/android/custom-tabs).

La verifica del dominio e la gestione dei collegamenti Android sono controlli distinti: l'apertura a schermo intero deve funzionare, ma vanno provati anche i link email con app chiusa e già aperta. I token non vanno copiati nelle evidenze dei test.

Una navigazione a un dominio esterno può mostrare UI del browser. Questo comportamento è previsto, per esempio per `bank.savely.cc`, finché quel dominio non ha una propria associazione. La prima versione verifica soltanto l'associazione di `www.savely.cc`: il dominio senza `www` restituisce un redirect e non ha un endpoint Asset Links direttamente verificabile. Il launcher accetta link espliciti al dominio storico e li converte a `www`, preservando le altre componenti dell'URL.

## Versione aggiornata all'icona

Il launcher usa una navigazione nuova per l'apertura dall'icona. Una query variabile sulla home riduce il riuso della URL d'avvio; non costituisce una prova autonoma che ogni asset sia aggiornato. La risposta HTML, gli asset referenziati, eventuali service worker e il browser restano parte del percorso di cache.

Il launcher crea una sessione TWA stabile, indipendente dalla task transitoria dell'entry point. Nella prova a caldo su Chrome 124 la navigazione ha riutilizzato il target browser attivo. Questo controllo verifica il riuso della pagina, mentre la prova dopo un deploy verifica l'aggiornamento dei contenuti.

Per i link ricevuti il launcher deve preservare percorso, query e fragment originali della URL, anche quando converte il dominio storico a `www`. Query e fragment possono contenere lo stato dell'autenticazione; per questo il parametro tecnico di avvio non deve sostituirle.

Il ritorno da Recenti conserva la pagina in uso. Non esiste un controllo web aggiunto prima di ogni operazione. Non viene promessa una versione nuova mentre l'app è offline o quando il dispositivo riprende una schermata già caricata.

Il collaudo confronta un identificatore di asset pubblicato prima e dopo un deploy ordinario e osserva quale asset carica il browser all'apertura dall'icona. È una prova osservabile senza introdurre logica di versione nel frontend.

## Firma e integrità

Il certificato di release identifica l'app nel file Digital Asset Links e durante l'installazione degli aggiornamenti. La chiave privata e le password rimangono fuori dal repository. Il checksum dell'APK identifica il file distribuito, mentre l'impronta SHA-256 del certificato identifica il firmatario: non sono intercambiabili.

La build locale e quella CI interrompono il rilascio se il certificato dell'APK non coincide con il file Asset Links. `android/release.json` definisce la versione per entrambe; la CI rifiuta tag diversi da `android-v` seguito dal `versionName` dichiarato.

Il file pubblico deve contenere `delegate_permission/common.handle_all_urls`, namespace `android_app`, package `cc.savely.android` e l'impronta del certificato release. `https://www.savely.cc/.well-known/assetlinks.json` deve servire JSON direttamente attraverso HTTPS e il certificato del dominio deve essere valido. [Digital Asset Links](https://developers.google.com/digital-asset-links/v1/getting-started), [verifica Android App Links](https://developer.android.com/training/app-links/verify-android-applinks).

## Rischi e controlli

| Rischio | Effetto | Controllo richiesto |
|---|---|---|
| HTML invece di JSON in `.well-known` | Associazione non valida | GET reale, status, Content-Type e parsing JSON |
| Certificato pubblicato diverso dall'APK | Barra browser o App Links non verificati | Confrontare impronta con `apksigner`/`keytool` |
| Browser non compatibile o obsoleto | Fallback o funzioni web mancanti | Collaudo con provider e versione registrati |
| Cache o ripristino della pagina | Visualizzazione del sito precedente | Prova dall'icona prima/dopo deploy; separare Recenti |
| Link di recovery alterato | Login/reset fallito | Test query e fragment con account di prova |
| Cambio provider browser | Sessione assente | Verificare login e documentare il provider |
| Import/download dipendenti dal browser | File non importato o non reperibile | CSV reali di prova e controllo Download |

Il periodo di sviluppo non elimina la necessità di un browser/dispositivo compatibile e dell'accesso ad account di collaudo. I blocchi esterni rimangono espliciti nel rapporto di verifica.
