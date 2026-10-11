# Matrice funzionale Android

Esegui i casi sull'APK firmato e registra dispositivo, Android, browser/provider, versione APK, data e prova. Il censimento deriva da `src/App.tsx`, `src/pages`, `src/components/settings` e dai componenti CRUD condivisi. Non dimostra che i flussi funzionino sul dispositivo.

Ogni riga parte da **NON ESEGUITO**. Usa `PASSATO`, `FALLITO` o `BLOCCATO` solo dopo il controllo, indicando evidenze e causa. `NON APPLICABILE` richiede una motivazione. Un test nel browser desktop o mobile simulato non sostituisce una prova TWA.

Lo smoke definitivo su Chrome dell'emulatore ha superato 39 casi: redirect delle 34 route protette e caricamento di login, privacy, cookie, termini e 404. Il test seleziona il target attivo 2 dell'APK, lo porta in primo piano e controlla il nuovo documento. I casi funzionali sotto restano NON ESEGUITO dove richiedono autenticazione, dati o azioni non provate. Query e fragment dei link recovery passano nei test JVM; il lancio ACTION_VIEW sull'emulatore è stato bloccato dalla revisione automatica.

## Account necessari

Predisponi un account ordinario, uno con i permessi dei moduli, un account admin di collaudo e due utenti collegabili per le spese familiari. Usa record di prova identificabili. Le prove di eliminazione account o utenti e quelle che inviano email richiedono un ambiente/account di prova e autorizzazione per il destinatario. Durante il lavoro sul sito reale si possono verificare i dialog di conferma senza eseguire la cancellazione.

## Route pubbliche

| ID | Route | Prova e risultato atteso | Android | Evidenza |
|---|---|---|---|---|
| PUB-01 | `/auth` | Login valido/errato, registrazione secondo configurazione, recupero, TOTP; testi ed errori visibili | NON ESEGUITO | — |
| PUB-02 | `/auth/callback` | Link email valido completa il flusso; link scaduto/errato mostra un errore; query e fragment preservati | NON ESEGUITO | — |
| PUB-03 | `/reset-password` | Recovery email apre il form; validazione password e conferma; successivo login valido | NON ESEGUITO | — |
| PUB-04 | `/privacy` | Testo leggibile, link e mailto accessibili | NON ESEGUITO | — |
| PUB-05 | `/cookies` | Testo leggibile e link esterni apribili | NON ESEGUITO | — |
| PUB-06 | `/terms` | Testo leggibile e link sorgente apribile | NON ESEGUITO | — |
| PUB-07 | `*` | URL inesistente mostra NotFound e ritorno alla home | NON ESEGUITO | — |

## Route con autenticazione

Per ciascuna verifica anche il redirect a `/auth` con utente disconnesso e l'apertura tramite URL diretta. Dopo CRUD, riapri la schermata e confronta i dati con il sito usando lo stesso account.

| ID | Route | Prova e risultato atteso | Android | Evidenza |
|---|---|---|---|---|
| FIN-01 | `/` | KPI, selettore periodo, grafico entrate/uscite, categorie, budget e transazioni recenti coerenti | NON ESEGUITO | — |
| FIN-02 | `/transactions` | Inserimento/modifica/eliminazione di entrata e uscita; ricerca e filtri; valuta/tasso; condivisione quando autorizzata | NON ESEGUITO | — |
| FIN-03 | `/recurring` | Creazione/modifica/eliminazione, frequenze e attivazione; suggerimenti; generazione delle scadenze su dati di prova | NON ESEGUITO | — |
| FIN-04 | `/budget` | CRUD per categoria, mediana e indicatori aggiornati dopo una transazione di prova | NON ESEGUITO | — |
| FIN-05 | `/categories` | Elenco e operazioni offerte dalla pagina; selezione categorie coerente nei form | NON ESEGUITO | — |
| FIN-06 | `/charts` | Tutti i collegamenti ai grafici navigabili | NON ESEGUITO | — |
| FIN-07 | `/charts/income-expense` | Periodi e grafico comparativo; tooltip touch e assenza di tagli | NON ESEGUITO | — |
| FIN-08 | `/charts/expense` | Distribuzione spese per categoria e periodo | NON ESEGUITO | — |
| FIN-09 | `/charts/income` | Distribuzione entrate per categoria e periodo | NON ESEGUITO | — |
| FIN-10 | `/portfolio` | Aggiunta asset/acquisto, liquidità multivaluta, chiusura posizione, eliminazione; storico/allocation e aggiornamento prezzi secondo limiti | NON ESEGUITO | — |
| FIN-11 | `/net-worth` | Patrimonio, storico, periodo, cashflow e profitto/perdita visibili | NON ESEGUITO | — |
| FIN-12 | `/insights` | Categorie di insight e filtri; dati vuoti e popolati senza errore | NON ESEGUITO | — |
| FIN-13 | `/settings` | Tutte le sezioni della matrice Impostazioni sotto, logout e dialog eliminazione account | NON ESEGUITO | — |

## Route con permesso

Ripeti apertura diretta con permesso concesso e negato. Con permesso negato, il comportamento deve coincidere con il sito: nessun accesso a dati del modulo, redirect alla home. La presenza del modulo nell'APK non concede il permesso.

| ID | Route | Permesso | Prova e risultato atteso | Android | Evidenza |
|---|---|---|---|---|---|
| MOD-01 | `/poker` | `poker` | Collegamenti a Next Cut, guadagni orari e rakeback | NON ESEGUITO | — |
| MOD-02 | `/poker/next-cut` | `poker` | Deal/P&L, spese manuali CRUD e calcolo prossimo cut con budget | NON ESEGUITO | — |
| MOD-03 | `/poker/hourly-earnings` | `poker` | CRUD mensile, minuti/ore, profitto ed EV, riepiloghi annuali | NON ESEGUITO | — |
| MOD-04 | `/poker/rakeback` | `poker` | CRUD rake e rakeback; percentuali e riepiloghi mensili/annuali | NON ESEGUITO | — |
| MOD-05 | `/fumo` | `fumo` | Collegamenti alle tre categorie | NON ESEGUITO | — |
| MOD-06 | `/fumo/liquido-sigaretta` | `fumo` | CRUD consumi, date e costi calcolati come sul sito | NON ESEGUITO | — |
| MOD-07 | `/fumo/cbd` | `fumo` | CRUD, quantità/date e calcoli costi | NON ESEGUITO | — |
| MOD-08 | `/fumo/thc` | `fumo` | CRUD, quantità/date e calcoli costi | NON ESEGUITO | — |
| MOD-09 | `/fire` | `fire` | Collegamenti alle due simulazioni | NON ESEGUITO | — |
| MOD-10 | `/fire/standard` | `fire` | Parametri, valori derivati dal DB, proiezioni e grafico; persistenza parametri se prevista | NON ESEGUITO | — |
| MOD-11 | `/fire/barista` | `fire` | Parametri specifici, proiezioni e grafico coerenti con il sito | NON ESEGUITO | — |
| MOD-12 | `/tcg` | `tcg` | Collegamenti alle tre collezioni | NON ESEGUITO | — |
| MOD-13 | `/tcg/magic` | `tcg` | Ricerca CardTrader, aggiunta/modifica/eliminazione, lingua/condizione, filtri e valori | NON ESEGUITO | — |
| MOD-14 | `/tcg/pokemon` | `tcg` | Stesse operazioni sulla collezione Pokémon | NON ESEGUITO | — |
| MOD-15 | `/tcg/yugioh` | `tcg` | Stesse operazioni sulla collezione Yu-Gi-Oh! | NON ESEGUITO | — |
| MOD-16 | `/libreria` | `libreria` | Collegamenti a Libri, Fumetti e Manga | NON ESEGUITO | — |
| MOD-17 | `/libreria/libri` | `libreria` | Ricerca Google Books, CRUD, filtri autore/editore/anno, quantità e valori | NON ESEGUITO | — |
| MOD-18 | `/libreria/fumetti` | `libreria` | Ricerca Google Books e CRUD nella categoria Fumetti | NON ESEGUITO | — |
| MOD-19 | `/libreria/manga` | `libreria` | Inserimento manuale/intervalli volumi, CRUD e filtri | NON ESEGUITO | — |
| MOD-20 | `/couple-budget` | `couple_expenses` | CRUD budget condivisi e mediane; connessione archiviata in sola lettura | NON ESEGUITO | — |
| MOD-21 | `/admin` | `admin` | Elenco utenti, permessi, configurazione registrazioni, reset e conferme cancellazione su account di prova | NON ESEGUITO | — |

## Impostazioni e flussi trasversali

| ID | Funzione | Prova e risultato atteso | Android | Evidenza |
| SET-01 | Account | Cambio email/password con password attuale e validazioni, email di conferma quando prevista | NON ESEGUITO | — |
| SET-02 | MFA | Enrollment QR e segreto manuale, verifica TOTP, login challenge, rimozione con conferma | NON ESEGUITO | — |
| SET-03 | Attività accessi e sessioni | Lista dispositivi, logout singolo e sessione corrente; dati aggiornati alla riapertura | NON ESEGUITO | — |
| SET-04 | Valuta, lingua e tema | Cambi valuta, italiano/inglese, chiaro/scuro/sistema; impostazioni persistenti | NON ESEGUITO | — |
| SET-05 | Categorie nelle impostazioni | Gestione categorie e utilizzo nei form delle transazioni | NON ESEGUITO | — |
| SET-06 | Import Revolut | Scelta CSV, anteprima/mapping e import su dati di prova, feedback e gestione duplicati prevista dal sito | NON ESEGUITO | — |
| SET-07 | Import BBVA / Trade Republic | CSV per entrambi i formati, scelta categorie e validazione | NON ESEGUITO | — |
| SET-08 | Mapping ISIN | Inserimento/modifica/rimozione secondo UI; mapping usato dall'import investimenti | NON ESEGUITO | — |
| SET-09 | Export CSV e portabilità | Generazione file, nome, presenza in Download, apertura e verifica righe; nessuna perdita di dati rispetto al sito | NON ESEGUITO | — |
| SET-10 | Banca esterna | `https://bank.savely.cc` apribile; ritorno a Savely; eventuale barra browser registrata | NON ESEGUITO | — |
| SET-11 | Collegamento familiare | Copia codice, invio/annullamento, accetta/rifiuta, revoca su due account di prova | NON ESEGUITO | — |
| SET-12 | Transazioni condivise | Ripartizione, rimozione condivisione/lista; visibilità tra i due utenti conforme al sito | NON ESEGUITO | — |
| SET-13 | Account eliminazione | Apertura/annullamento dialog; cancellazione completa solo su account di prova autorizzato | NON ESEGUITO | — |
| SET-14 | Email, cookie e link legali | Mailto, banner informativo, target esterni e ritorno all'app | NON ESEGUITO | — |
| UX-01 | Navigazione | Menu inferiore/sidebar, link interni, Back e gesto indietro; comportamento form/dialog | NON ESEGUITO | — |
| UX-02 | Tastiera e schermo | Campi importo/data/password, scroll, dialog e bottoni con tastiera aperta; portrait/landscape | NON ESEGUITO | — |
| UX-03 | Lifecycle e login | Home, Recenti, schermo bloccato, chiusura browser, riavvio telefono; sessione coerente | NON ESEGUITO | — |
| UX-04 | Rete interrotta | Errore visibile e ripresa; nessuna promessa di funzionamento offline né replay nativo delle scritture | NON ESEGUITO | — |
| UX-05 | Origine e API | `/api/reset-password`, `/api/admin` e Supabase raggiungibili dallo stesso sito; nessun token nei log | NON ESEGUITO | — |

## Rilascio e aggiornamento

| ID | Prova | Risultato atteso | Stato | Evidenza |
|---|---|---|---|---|
| REL-01 | APK release, firma e SHA-256 | Firma valida, package corretto, checksum del file distribuito | PASSATO | Hash `de6f78b8858740de7d0d3312e4e90bbc4b1c83cac659d2cfd383dc2aecd6bb4c`, versionCode 2, cert in `VALIDATION.md` |
| REL-02 | Asset Links sul dominio | 200 JSON diretto su `www.savely.cc`, nessun redirect, package e impronta release uguali all'APK | PASSATO PREVIEW; PRODUZIONE DA COMPLETARE | Preview Vercel in `VALIDATION.md`; `www.savely.cc` non ancora associato, dominio storico reindirizzato |
| REL-03 | Installazione diretta | Installazione da fonte scelta, icona e apertura a schermo intero | PASSATO EMULATORE VIA ADB; FULLSCREEN PENDENTE | API 35 / Chrome 124: apertura cold e warm senza crash; Asset Links produzione ancora HTML |
| REL-04 | Update APK | VersionCode superiore e stessa firma; installazione senza rimozione della versione precedente | PASSATO SU EMULATORE; SESSIONE AUTH NON VERIFICATA | Codice 2 sopra build interna codice 1 con `adb install -r`; valore di prova localStorage conservato, avvio senza crash |
| REL-05 | Deploy web tra due aperture dall'icona | Nuovo documento/asset dal sito senza aggiornare l'APK, con connessione e deploy completato | NON ESEGUITO | — |
| REL-06 | Ritorno da Recenti | Pagina corrente preservata; non usato come prova di aggiornamento | NON ESEGUITO | — |
| REL-07 | Build web/Vercel | Comandi e config web invariati; build web non invoca Gradle | PASSATO LOCALMENTE | Lint, typecheck, 228 test/20 file e build Vite; controllo dashboard/deploy Vercel ancora distinto |
| REL-08 | Isolamento diff | Modifiche nel perimetro Android, workflow dedicato e solo assetlinks lato web | PASSATO | `node android/scripts/verify-isolation.mjs`, 11 ottobre 2026 |

Le 41 route dichiarate comprendono anche il wildcard. Il controllo di copertura deve confrontare nuovamente la matrice con `src/App.tsx` dopo eventuali cambiamenti del sito.
