# Previsione condivisa — schema 1

Web e Android consumano lo stesso motore in `server/spending-forecast.ts`. La migrazione conserva il modello `weekday-history-v1`: massimo 180 giorni, minimo 56, media delle spese variabili per categoria e giorno della settimana, con programmate e ricorrenze deduplicate. I sei segnali Android restano locali; la versione web mantiene i propri otto segnali.

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

## Errori e aggiornamento

Risposte private `no-store`, escluse dalle cache CDN. Metodo errato: 405; richiesta/fuso non valido: 400; sessione mancante o scaduta: 401; dati incompatibili: 422; sorgente indisponibile: 502; configurazione mancante: 503. Nessun errore attiva una formula locale alternativa.

La cache del browser appartiene all’account e al login; modifiche a transazioni, budget e ricorrenti invalidano la previsione. Cambio data e fuso cambiano la chiave. L’ultima risposta valida resta nella cache in memoria; la pagina segnala il caricamento fallito e non presenta dati vecchi come aggiornati. Android conserva il risultato nella cache finanziaria della sessione per massimo 30 secondi, con verifica di data e fuso; aggiornamento manuale, ripresa e cambio giorno ricaricano i dati secondo le regole della cache. Non esiste una cache finanziaria pubblica o persistente aggiuntiva.

## Verifica

I 48 casi precedenti alla migrazione e tutti i 1.464 punti giornalieri sono conservati esattamente. Le stesse fixture verificano il motore server, il decoder web e il decoder Android; non è più ammessa la precedente tolleranza di 0,01 EUR. Test aggiuntivi coprono sessioni, proprietario, paginazione, errori, contratto, account sostituito, fuso, DST e febbraio bisestile. Il motore conserva la precisione float64 della precedente web app; il trasporto rende identico il risultato mostrato dai client, senza dichiarare una maggiore accuratezza statistica.

Eseguire `npm run typecheck`, `npm run lint`, `node node_modules/vitest/vitest.mjs run --pool=threads --maxWorkers=2`, `npm run build`. `node scripts/benchmark-insights.mjs` misura il motore e i segnali su 18.100 transazioni sintetiche, senza database. Il tempo di rete e il carico Vercel non fanno parte di questo benchmark. Per le prove di pubblicazione distinguere i controlli anonimi della funzione dai test autenticati con fixture: nessuna prova di questi ultimi equivale a una verifica di un conto reale.

Misura locale del 26 ottobre 2026, durante altre build: 18.100 transazioni, dieci campioni, mediana 917,81 ms, massimo 1.733,28 ms, Intel Core i3-10100F, 8 CPU logiche, 31,9 GiB RAM, Windows, Node 24.19.0, un thread, float64. È una misura del comando SSR sul computer di sviluppo, senza confronto di prestazioni controllato e senza rete; non dimostra un miglioramento dell’accuratezza o dei tempi Vercel.

Verifica della candidata: typecheck e lint senza errori, build completata, 336 test superati e un test live opzionale saltato. Nessun test del modello richiede credenziali o modifica dati finanziari reali.
