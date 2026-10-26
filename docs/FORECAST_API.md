# Previsione condivisa — schema 1

Web e Android consumano lo stesso motore in `server/spending-forecast.ts`. La migrazione conserva il modello `weekday-history-v1`: massimo 180 giorni, minimo 56, media delle spese variabili per categoria e giorno della settimana, con programmate e ricorrenze deduplicate. Il confronto con il budget delle categorie saltuarie viene calcolato dal server in `server/occasional-spending.ts`. Gli altri segnali mantengono i calcoli esistenti nei client.

## Richiesta e autenticazione

`POST /api/spending-forecast`, `Content-Type: application/json`, `Authorization: Bearer <sessione Supabase>`.

```json
{"schemaVersion":1,"timeZone":"Europe/Rome"}
```

Il server verifica la sessione tramite `/auth/v1/user`, rifiuta gli utenti anonimi e usa lo stesso JWT con la chiave pubblica per leggere transazioni, budget e ricorrenti. Ogni query specifica anche il proprietario verificato; RLS resta attivo. Il client non può inviare un proprietario, dati finanziari o una data arbitraria. Le variabili richieste sono `SUPABASE_URL`/`VITE_SUPABASE_URL` e `SUPABASE_ANON_KEY`/`VITE_SUPABASE_ANON_KEY`; la chiave service role non viene usata.

L’orologio del server determina il giorno nel fuso richiesto. Il motore lavora su date ISO e aritmetica UTC del calendario, conservando i giorni 29–31 dopo i mesi corti. A parità di dati, giorno, fuso e versione, entrambi i client ricevono gli stessi centesimi.

## Risposta

La risposta contiene `schemaVersion`, `modelVersion`, `userId`, `timeZone`, `generatedAt`, `inputSha256` e `forecast`. I campi di `forecast` sono `date`, `historyDays`, `available`, `spent`, `scheduled`, `variable`, `total`, `budget`, `points`, `unsupportedRecurring`, `unsupportedBudgets`.

Tutti gli importi sono stringhe decimali EUR con due cifre, per esempio `"152.60"`; i valori mancanti sono `null`. Budget, se presente, contiene `limit`. Ogni punto contiene `day`, `actual`, `projected`. Il browser converte i decimali soltanto per formattazione e grafico; Android li legge con `BigDecimal`, senza ricalcolarli. Entrambi verificano schema, proprietario, fuso e forma del mese. Un nuovo `modelVersion` è accettato se il contratto rimane compatibile; cambiamenti incompatibili richiedono una nuova versione dello schema e dei client.

`inputSha256` identifica gli input letti per il calcolo. Le letture REST di tabelle diverse non sono uno snapshot transazionale: movimenti inseriti durante la lettura possono appartenere alla richiesta successiva. Le pagine usano ordinamento stabile, 500 righe, limite di 100.000 righe per tabella e controllo degli ID duplicati; errori e limiti interrompono la risposta senza totali parziali. La funzione ha durata massima di 60 secondi e timeout complessivo delle richieste dati di 45 secondi.

## Confronto delle categorie saltuarie

La risposta aggiunge `occasionalSpending`: `startDate`, `endDate`, `months: 12` e un array `categories`. Ogni categoria contiene `categoryId`, `total`, `averageMonthly`, `expectedMonthly`, `exceeded` e `over`. Gli importi sono stringhe EUR a due decimali. `expectedMonthly` è `null` quando manca un budget in EUR; in quel caso non viene dichiarato uno sforamento. I client leggono media ed esito senza applicare una formula locale alternativa.

Il periodo comprende il mese corrente fino alla data del server e gli 11 mesi precedenti, dal primo giorno del mese iniziale. La somma delle spese effettive della categoria è divisa sempre per 12, anche se alcuni mesi non hanno movimenti. Tre pagamenti da 100 EUR producono una media di 25 EUR/mese; un solo pagamento da 100 EUR produce 8,33 EUR/mese. Non vengono spostate transazioni né creati saldi cumulativi. Le spese del mese e la previsione rimangono negli importi effettivi.

Il server accumula centesimi interi e verifica lo sforamento sul totale non arrotondato, confrontandolo con 12 volte il budget. La media trasportata e lo scostamento sono arrotondati ai centesimi per la visualizzazione: un superamento inferiore a mezzo centesimo mensile può apparire come 0,00 EUR. La classificazione è inclusa nell'hash degli input. Date future, movimenti cancellati e movimenti fuori dalla finestra sono esclusi; i cambi sono quelli registrati nelle transazioni.

`categories.spending_pattern` ammette `regular` e `occasional`; la scelta avviene nei form Categorie e Impostazioni del web e nel form Categorie Android. La migrazione `20261026220000_category_spending_pattern.sql` mantiene regolari le categorie esistenti. Applicarla prima di pubblicare il backend, poi distribuire i client aggiornati. Lo schema 1 rimane compatibile con i client precedenti, che ignorano la sezione aggiunta; i vecchi client continuano però a usare il precedente confronto mensile fino all'aggiornamento dell'app.

Il campo è opzionale nei decoder per conservare la lettura delle fixture e risposte precedenti. Una categoria marcata saltuaria con budget richiede il risultato aggiornato del server: se manca o il budget è cambiato, il confronto viene segnalato come non disponibile. La cache della previsione viene invalidata anche quando si modifica una categoria.

Il divisore fisso presume che lo storico dei 12 mesi sia completo. Un mese senza movimenti non si distingue da uno non importato: uno storico parziale può sottostimare la media. I nuovi test coprono esplicitamente questa convenzione. La previsione mantiene i propri requisiti di storico; il confronto su 12 mesi viene restituito anche quando la previsione non è disponibile.

Verifiche locali del 26 ottobre 2026: suite Vitest completa, test aggiuntivi dei form Categorie e Impostazioni, TypeScript, lint dei file modificati, build web e caricamento ESM della funzione server superati. Il selettore reale è stato controllato in Chromium a 375, 812 e 1280 px, nei due temi, con apertura da tastiera, selezione, movimento ridotto e testo al 125%; nessun overflow orizzontale. Android: 400 test JUnit, compilazione e `lintDebug` superati. Non erano collegati emulatori o dispositivi; non è stato verificato il nuovo form su Android in esecuzione. Queste prove precedono l'attivazione descritta sotto.

## Attivazione — 26 ottobre 2026

Migrazione `20261026220000` applicata al progetto condiviso: le 112 categorie esistenti risultavano regolari dopo il backfill. Il test SQL transazionale `supabase/tests/category_spending_pattern.sql` verifica default, salvataggio, valori non ammessi, NOT NULL e permanenza della RLS, senza modificare dati degli utenti.

Backend e web pubblicati dal commit funzionale `71541f05a447e94d80df800943bf6b9194c6c878`, deployment `dpl_Aej8BJfQqHNu2xdLpWWTPoRzkqGn`, pronto e associato a `www.savely.cc`. La copia di rilascio, basata sul ramo di produzione, supera 347 test web con un test live opzionale saltato, TypeScript, lint, build e caricamento ESM. Gli esperimenti previsionali del ramo di ricerca non sono inclusi. La CI supera test, TypeScript, quality ed E2E; il solo audit delle dipendenze resta negativo con 5 segnalazioni moderate e 6 high, già presenti nel commit precedente. Il lockfile non cambia.

Verifica remota con account QA: categoria saltuaria e budget atteso di 25 EUR letti dal backend, media 0,00 EUR senza movimenti, finestra dal 1 novembre 2025 al 26 ottobre 2026, risposta autenticata 200 e `private, no-store`. Categoria e budget sintetici rimossi e sessione di test chiusa con logout locale. Il calcolo con tre pagamenti da 100 EUR resta coperto dai test del server; nessuna spesa fittizia è stata inserita nel database per questa prova remota.

Android [1.0.8 / code46](https://github.com/GoryNickel9/Savely-Android/releases/tag/v1.0.8) pubblicata nel canale stabile dal commit `995ae22a94db24525ac759e1762664b6d60d6484`. Passano 400 test debug e 400 release; lint release senza errori. APK di 2.418.814 byte, SHA-256 `ba3e3a0a99d284cd2341a60a779235d368fdaca965c09ec1006b424771aa86c9`, certificato di distribuzione invariato. Metadati stabili 200, download anonimo 401, download autenticato dal proxy 200 e digest della copia scaricata uguale all'APK locale. La UI Android in esecuzione e il telefono fisico restano non verificati per questo rilascio.

## Errori e aggiornamento

Risposte private `no-store`, escluse dalle cache CDN. Metodo errato: 405; richiesta/fuso non valido: 400; sessione mancante o scaduta: 401; dati incompatibili: 422; sorgente indisponibile: 502; configurazione mancante: 503. Nessun errore attiva una formula locale alternativa.

La cache del browser appartiene all’account e al login; modifiche a transazioni, budget e ricorrenti invalidano la previsione. Cambio data e fuso cambiano la chiave. L’ultima risposta valida resta nella cache in memoria; la pagina segnala il caricamento fallito e non presenta dati vecchi come aggiornati. Android conserva il risultato nella cache finanziaria della sessione per massimo 30 secondi, con verifica di data e fuso; aggiornamento manuale, ripresa e cambio giorno ricaricano i dati secondo le regole della cache. Non esiste una cache finanziaria pubblica o persistente aggiuntiva.

## Verifica

I 48 casi precedenti alla migrazione e tutti i 1.464 punti giornalieri sono conservati esattamente. Le stesse fixture verificano il motore server, il decoder web e il decoder Android; non è più ammessa la precedente tolleranza di 0,01 EUR. Test aggiuntivi coprono sessioni, proprietario, paginazione, errori, contratto, account sostituito, fuso, DST e febbraio bisestile. Il motore conserva la precisione float64 della precedente web app; il trasporto rende identico il risultato mostrato dai client, senza dichiarare una maggiore accuratezza statistica.

Eseguire `npm run test:forecast-runtime` per compilare la funzione con NodeNext e caricarla con Node ESM nativo, senza risoluzione implicita degli import da parte di Vite. Questo controllo copre la regressione del primo deploy, dovuta a un import privo di estensione `.js`. Eseguire poi `npm run typecheck`, `npm run lint`, `node node_modules/vitest/vitest.mjs run --pool=threads --maxWorkers=2`, `npm run build`. `node scripts/benchmark-insights.mjs` misura il motore e i segnali su 18.100 transazioni sintetiche, senza database. Il tempo di rete e il carico Vercel non fanno parte di questo benchmark. Per le prove di pubblicazione distinguere i controlli anonimi della funzione dai test autenticati con fixture: nessuna prova di questi ultimi equivale a una verifica di un conto reale.

Misura locale del 26 ottobre 2026, durante altre build: 18.100 transazioni, dieci campioni, mediana 917,81 ms, massimo 1.733,28 ms, Intel Core i3-10100F, 8 CPU logiche, 31,9 GiB RAM, Windows, Node 24.19.0, un thread, float64. È una misura del comando SSR sul computer di sviluppo, senza confronto di prestazioni controllato e senza rete; non dimostra un miglioramento dell’accuratezza o dei tempi Vercel.

Verifica della candidata: typecheck e lint senza errori, build completata, 336 test superati e un test live opzionale saltato. Nessun test del modello richiede credenziali o modifica dati finanziari reali.
