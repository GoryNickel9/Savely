# Previsione condivisa — schema 1

Web e Android consumano lo stesso motore in `server/spending-forecast.ts`. Il modello schema 1, conservato per i client precedenti, è `weekday-history-mean-v2`: massimo 180 giorni, minimo 56, media delle spese variabili per categoria e giorno della settimana, con programmate e ricorrenze deduplicate. Il confronto con il budget delle categorie saltuarie viene calcolato dal server in `server/occasional-spending.ts`. Gli altri segnali vengono calcolati nei client; la web app usa le medie descritte in INSIGHTS.md.

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

### Previsione per categoria

`forecast.categories` è un campo opzionale dello schema 1. Ogni riga contiene `categoryId` (stringa o `null` per le spese senza categoria), `spent`, `scheduled`, `variable`, `total` e `budget: { limit } | null`. Gli importi sono stringhe EUR a due decimali. `total` è `null` quando la previsione complessiva non è disponibile; in quel caso il client non presenta previsioni o scostamenti numerici per categoria. Il limite di budget può essere zero; il modello rifiuta budget duplicati anche quando il primo limite è zero.

Le categorie derivano dagli stessi contributi della previsione complessiva, includendo quelle senza budget e i budget senza movimenti. Per ognuna delle tre componenti, il backend parte dai centesimi arrotondati per difetto e assegna il residuo alle frazioni maggiori. Risolve le parità nell'ordine stabile degli ID. La somma delle componenti e dei totali di categoria coincide al centesimo con gli importi complessivi precedenti. Il decoder rifiuta ID duplicati, somme incoerenti e disponibilità dei totali incompatibile con la previsione.

Il campo è disponibile per il modello pubblicato `weekday-history-mean-v2`, per il riferimento precedente `weekday-history-v1` e per le candidate deterministiche locali. Le candidate campionate non restituiscono un dettaglio per categoria quando stanno usando campioni: una somma di mediane marginali non conserverebbe la mediana del totale. Le risposte archiviate senza il nuovo campo restano compatibili. I 48 casi di riferimento mantengono tutti gli importi complessivi e i 1.464 punti del grafico precedenti.

La nuova tabella è nella web app. Il contratto mantiene la versione 1; non richiede una migrazione dati e i client precedenti possono ignorare il campo aggiunto.

## Confronto delle categorie saltuarie

La risposta aggiunge `occasionalSpending`: `startDate`, `endDate`, `months: 12` e un array `categories`. Ogni categoria contiene `categoryId`, `total`, `averageMonthly`, `expectedMonthly`, `exceeded` e `over`. Gli importi sono stringhe EUR a due decimali. `expectedMonthly` è `null` quando manca un budget in EUR; in quel caso non viene dichiarato uno sforamento. I client leggono media ed esito senza applicare una formula locale alternativa.

Il periodo comprende il mese corrente fino alla data del server e gli 11 mesi precedenti, dal primo giorno del mese iniziale. La somma delle spese effettive della categoria è divisa sempre per 12, anche se alcuni mesi non hanno movimenti. Tre pagamenti da 100 EUR producono una media di 25 EUR/mese; un solo pagamento da 100 EUR produce 8,33 EUR/mese. Non vengono spostate transazioni né creati saldi cumulativi. Le spese del mese e la previsione rimangono negli importi effettivi.

Il server accumula centesimi interi e verifica lo sforamento sul totale non arrotondato, confrontandolo con 12 volte il budget. La media trasportata e lo scostamento sono arrotondati ai centesimi per la visualizzazione: un superamento inferiore a mezzo centesimo mensile può apparire come 0,00 EUR. La classificazione è inclusa nell'hash degli input. Date future, movimenti cancellati e movimenti fuori dalla finestra sono esclusi; i cambi sono quelli registrati nelle transazioni.

`categories.spending_pattern` ammette `regular` e `occasional`; la scelta avviene nei form Categorie e Impostazioni del web e nel form Categorie Android. La migrazione `20261026220000_category_spending_pattern.sql` mantiene regolari le categorie esistenti. Applicarla prima di pubblicare il backend, poi distribuire i client aggiornati. Lo schema 1 rimane compatibile con i client precedenti, che ignorano la sezione aggiunta; i vecchi client continuano però a usare il precedente confronto mensile fino all'aggiornamento dell'app.

Il campo è opzionale nei decoder per conservare la lettura delle fixture e risposte precedenti. Una categoria marcata saltuaria con budget richiede il risultato aggiornato del server: se manca o il budget è cambiato, il confronto viene segnalato come non disponibile. La cache della previsione viene invalidata anche quando si modifica una categoria.

Il divisore fisso presume che lo storico dei 12 mesi sia completo. Un mese senza movimenti non si distingue da uno non importato: uno storico parziale può sottostimare la media. I nuovi test coprono esplicitamente questa convenzione. La previsione mantiene i propri requisiti di storico; il confronto su 12 mesi viene restituito anche quando la previsione non è disponibile.

Verifiche locali del 26 ottobre 2026: suite Vitest completa, test aggiuntivi dei form Categorie e Impostazioni, TypeScript, lint dei file modificati, build web e caricamento ESM della funzione server superati. Il selettore reale è stato controllato in Chromium a 375, 812 e 1280 px, nei due temi, con apertura da tastiera, selezione, movimento ridotto e testo al 125%; nessun overflow orizzontale. Android: 400 test JUnit, compilazione e `lintDebug` superati. Non erano collegati emulatori o dispositivi; non è stato verificato il nuovo form su Android in esecuzione. Migrazione e rilasci non eseguiti.

## Errori e aggiornamento

Risposte private `no-store`, escluse dalle cache CDN. Metodo errato: 405; richiesta/fuso non valido: 400; sessione mancante o scaduta: 401; dati incompatibili: 422; sorgente indisponibile: 502; configurazione mancante: 503. Nessun errore attiva una formula locale alternativa.

La cache del browser appartiene all’account e al login; modifiche a transazioni, budget e ricorrenti invalidano la previsione. Cambio data e fuso cambiano la chiave. L’ultima risposta valida resta nella cache in memoria; la pagina segnala il caricamento fallito e non presenta dati vecchi come aggiornati. Android conserva il risultato nella cache finanziaria della sessione per massimo 30 secondi, con verifica di data e fuso; aggiornamento manuale, ripresa e cambio giorno ricaricano i dati secondo le regole della cache. Non esiste una cache finanziaria pubblica o persistente aggiuntiva.

## Verifica

I 48 casi del riferimento `weekday-history-v1` e tutti i suoi 1.464 punti giornalieri sono conservati esattamente eseguendo quella versione. La versione pubblicata `weekday-history-mean-v2` usa la media aritmetica per gli importi delle ricorrenti rilevate; test con importi asimmetrici verificano il nuovo risultato e la differenza rispetto al riferimento precedente. Le stesse fixture verificano il motore server, il decoder web e il decoder Android; non è più ammessa la precedente tolleranza di 0,01 EUR. Test aggiuntivi coprono sessioni, proprietario, paginazione, errori, contratto, account sostituito, fuso, DST e febbraio bisestile. Il motore conserva la precisione float64 della precedente web app; il trasporto rende identico il risultato mostrato dai client, senza dichiarare una maggiore accuratezza statistica.

Eseguire `npm run test:forecast-runtime` per compilare la funzione con NodeNext e caricarla con Node ESM nativo, senza risoluzione implicita degli import da parte di Vite. Questo controllo copre la regressione del primo deploy, dovuta a un import privo di estensione `.js`. Eseguire poi `npm run typecheck`, `npm run lint`, `node node_modules/vitest/vitest.mjs run --pool=threads --maxWorkers=2`, `npm run build`. `node scripts/benchmark-insights.mjs` misura il motore e i segnali su 18.100 transazioni sintetiche, senza database. Il tempo di rete e il carico Vercel non fanno parte di questo benchmark. Per le prove di pubblicazione distinguere i controlli anonimi della funzione dai test autenticati con fixture: nessuna prova di questi ultimi equivale a una verifica di un conto reale.

Misura locale del 26 ottobre 2026, durante altre build: 18.100 transazioni, dieci campioni, mediana 917,81 ms, massimo 1.733,28 ms, Intel Core i3-10100F, 8 CPU logiche, 31,9 GiB RAM, Windows, Node 24.19.0, un thread, float64. È una misura del comando SSR sul computer di sviluppo, senza confronto di prestazioni controllato e senza rete; non dimostra un miglioramento dell’accuratezza o dei tempi Vercel.

Verifica della candidata: typecheck e lint senza errori, build completata, 336 test superati e un test live opzionale saltato. Nessun test del modello richiede credenziali o modifica dati finanziari reali.

## Migrazioni UI del 1 novembre 2026

Applicare `20261101090000_actual_active_sessions.sql` e `20261101091000_shared_expense_category_icon.sql` prima di distribuire la web app aggiornata. La prima sostituisce l'elenco dei login recenti con le sessioni presenti in `auth.sessions`; la seconda aggiunge `category_icon` alla view delle spese condivise conservando i controlli su permessi e connessioni attive. Non cancellano dati finanziari. La classificazione delle categorie richiede inoltre la precedente migrazione `20261026220000_category_spending_pattern.sql`, se ancora assente.

Il test `supabase/tests/active_sessions_and_shared_icons.sql` va eseguito soltanto su un database PostgreSQL vuoto e temporaneo, con `psql -v ON_ERROR_STOP=1 -f supabase/tests/active_sessions_and_shared_icons.sql`. Crea fixture locali e verifica isolamento tra utenti, sessioni scadute e chiuse, browser identici, sessioni di oltre 30 giorni, fallback audit per ID, privilegi anonimi, icone condivise e accesso tramite connessione attiva. Tutto viene annullato con rollback.

Verifica locale del 1 novembre 2026: 423 test Vitest superati, un test live Android opzionale saltato; TypeScript, lint, build web e runtime Node ESM superati. Le due nuove migrazioni passano su PostgreSQL 17 temporaneo con fixture e rollback. Quattro test Playwright con tutte le richieste finanziarie e di autenticazione intercettate verificano testi, badge, icone familiari, disconnessione per ID e previsione per categoria. Il layout viene controllato a 320, 768 e 1440 px, in italiano e inglese, nei temi chiaro e scuro: lo scorrimento orizzontale resta nella tabella. Queste prove locali precedono il rilascio descritto sotto.

Benchmark `node scripts/benchmark-insights.mjs`: 18.100 transazioni sintetiche, tre esecuzioni di riscaldamento, dieci campioni, mediana 573,59 ms, massimo 658,21 ms; Intel Core i3-10100F, 8 CPU logiche, 31,9 GiB RAM, Windows, Node 24.19.0, un thread e float64. Non è un confronto controllato con la misura precedente e non misura accuratezza statistica, rete o tempi del deployment.

### Rilascio del 1 novembre 2026

Applicate al progetto Supabase collegato `crqnfbahytzenisospcx` le migrazioni `20261101090000_actual_active_sessions` e `20261101091000_shared_expense_category_icon`. La precedente classificazione delle categorie era già installata. Dopo l'applicazione, il controllo preventivo non rileva altre migrazioni mancanti. La verifica delle definizioni conferma lettura da `auth.sessions`, nessun raggruppamento dei browser, accesso alla funzione negato agli anonimi e consentito agli autenticati, zero sessioni senza utente e filtro delle connessioni attive conservato nella view con `category_icon`.

Pubblicata su [www.savely.cc](https://www.savely.cc) la [build Vercel dpl_FjtpScptmeZ2PSqgbERsS9mfhbj5](https://vercel.com/gorynickel9s-projects/savely/FjtpScptmeZ2PSqgbERsS9mfhbj5), con compilazione remota e configurazione di produzione. La versione precedente `dpl_EUUGRqJ2yoLjuq8riPgHVSqfbNUM` resta il riferimento per un eventuale ripristino. Il pacchetto di sorgenti esclude file ambiente, credenziali, dati locali e output di test.

Prima della promozione passano quattro test browser sulla build ospitata con API e autenticazione sostituite da fixture. Dopo la promozione passano due controlli browser sul dominio pubblico per sessioni e previsione per categoria. Le cinque route principali rispondono 200 con lo stesso file di ingresso JavaScript, disponibile anch'esso con 200. L'endpoint previsionale risponde 405 a GET e 401 a POST senza sessione, mantenendo `no-store`.

Il controllo autenticato separato usa soltanto l'account QA già esistente: l'API risponde 200 e il decoder valida il dettaglio per categoria e le somme al centesimo. La funzione delle sessioni restituisce l'ID corrente corretto e REST riconosce la nuova colonna delle icone. Le sessioni QA create per le prove vengono chiuse con logout locale; non vengono inviate email o scritti dati finanziari. Queste prove non misurano l'accuratezza statistica della previsione sui conti reali.

## Media aritmetica nei budget e negli Insights

La versione pubblicata `weekday-history-mean-v2` conserva la media per categoria e giorno della settimana e sostituisce la mediana degli addebiti ricorrenti rilevati con la loro media aritmetica, inclusi gli eventuali ultimi addebiti diversi quando la cadenza viene mantenuta. Le ricorrenti configurate continuano a usare l'importo esplicitamente impostato. Anomalie, trend, rincari e suggerimenti di Insights usano medie; il confronto di un budget regolare con la spesa effettiva del mese resta un confronto con un importo registrato, non una stima statistica.

Lo schema di risposta resta 1. `modelVersion` distingue il nuovo comportamento; i decoder accettano entrambe le versioni. Il motore v1 e il campo `medianAmount` sono mantenuti per riprodurre le fixture e gli esperimenti precedenti, senza essere usati per i calcoli pubblicati aggiornati. I calcoli indipendenti del modulo Poker non fanno parte di questa modifica. Non sono richieste migrazioni del database.

Rilascio del 1 novembre 2026: pubblicata su [www.savely.cc](https://www.savely.cc) la build `dpl_J8qdX1cUsXgfMy3bXrb5wZs6pupm`; il riferimento per ripristino è `dpl_BeuF4GnMuzsGiveBumMio3u99BHP`. Passano 434 test Vitest, con un test live opzionale saltato, TypeScript, lint senza errori e il controllo Node ESM nativo. La build remota è completata. I nove casi browser verificati sulla build ospitata includono medie con mesi a zero, budget familiari, sessioni, previsione persistente e form modali. Tre controlli finali sul dominio pubblico passano. L'API autenticata restituisce il nuovo modello e un dettaglio per categoria valido sull'account QA; la sessione di prova viene chiusa. Nessuna scrittura finanziaria o email. GET anonimo restituisce 405, POST anonimo 401, entrambi con `no-store`.

Benchmark locale del nuovo modello: `node scripts/benchmark-insights.mjs weekday-history-mean-v2`, 18.100 transazioni sintetiche, tre esecuzioni di riscaldamento, dieci campioni, mediana 601,46 ms, massimo 629,08 ms. Intel Core i3-10100F a 3,60 GHz, 8 CPU logiche, 31,9 GiB RAM, Windows, Node 24.19.0, un thread, float64, fixture deterministica. Il benchmark misura previsione e segnali con Vite SSR, senza rete o database; non misura accuratezza statistica e non costituisce un confronto controllato con le misure precedenti.


## Finestre per categoria, schema 2

La web app e Android 1.0.10 richiedono `schemaVersion: 2`. Il modello `regular180-occasional730-mean-v3` usa 180 giorni per le categorie ordinarie e 730 per le saltuarie. La classificazione viene letta dalle categorie attive; categorie mancanti e spese senza categoria sono ordinarie. Non servono migrazioni del database.

`budgetSpending` restituisce le medie per tutte le categorie, anche senza budget, e le spese senza categoria. Ogni riga contiene classificazione, `historyDays`, inizio e fine effettivi, numero di mesi osservati, totale, media mensile, budget atteso ed esito del confronto. Budget web, Dashboard e avvisi Insights consumano questi stessi importi. I centesimi vengono sommati come interi; il confronto usa il rapporto non arrotondato, mentre gli importi restituiti hanno due decimali con arrotondamento half-up.

La media mensile divide la somma nella finestra per i mesi di calendario toccati dalla copertura disponibile, inclusi i mesi a zero e il mese corrente fino alla data del server. Il primo mese parziale non viene riproporzionato. Non sono divisori fissi di 6 o 24: 180 giorni possono toccare 7 mesi e 730 giorni 25. La copertura parte dalla prima transazione non cancellata dell'account, limitata alla finestra; tutte le categorie dello stesso tipo usano lo stesso denominatore. Futuro e movimenti cancellati sono esclusi; le valute usano il cambio storico registrato.

La previsione conserva interi gli importi gia' pagati. Le variabili ordinarie usano la media per giorno della settimana sui 180 giorni precedenti; le saltuarie usano la media mensile delle variabili nei 730 giorni precedenti, distribuita sui giorni del mese. L'apprendimento esclude il giorno corrente. Le ricorrenti configurate conservano gli importi impostati e non sono contate due volte; le saltuarie non generano ricorrenze automatiche. Le programmate sostituiscono la previsione variabile della stessa categoria e giornata fino al loro importo. Il dettaglio per categoria conserva i totali al centesimo. Il requisito minimo resta 56 giorni; uno storico parziale riduce la copertura, senza inventare mesi precedenti.

Le richieste schema 1 conservano il modello precedente e `occasionalSpending` a 12 mesi: il cambio del contratto non viene imposto alle vecchie installazioni. Lo schema 2 richiede `budgetSpending` e ammette `forecast.historyDays` fino a 730. Entrambi i decoder verificano periodi, classificazione, arrotondamenti ed esiti; non ricostruiscono localmente una previsione se il server non risponde.

Le fixture `spending-windows.json` sono generate da `node scripts/generate-spending-windows-reference.mjs` e condivise con Android. Coprono confini delle finestre, cambio di classificazione, mesi a zero, mese corrente, storico breve, cambio valuta, mezzo centesimo, anno bisestile e storico vuoto. I casi v1 archiviati restano verificati separatamente. Queste prove validano le formule e la parita' tra client, senza misurare l'accuratezza statistica sui conti reali.


### Rilascio delle finestre 180/730 — 1 novembre 2026

Pubblicata su [www.savely.cc](https://www.savely.cc) la build `dpl_3f8oGg4QZykX27SB1PTgbFopGNNM`. Riferimento per ripristino: `dpl_J8qdX1cUsXgfMy3bXrb5wZs6pupm`. Android [1.0.10 / code48](https://github.com/GoryNickel9/Savely-Android/releases/tag/v1.0.10) deriva dal commit `885c74a812c3127d8063184244b0083882574711`, con lo stesso certificato della 1.0.9. L'APK contiene 2.418.998 byte, SHA-256 `104bc9a8a48e3d9295183ec1251a2e28a19ff37bb19ec8421bf152802772de68`.

Verificati 441 test web, con un test live opzionale saltato. Due suite assenti dal rapporto aggregato finale sono state verificate separatamente e l'inventario dei test e' stato riconciliato senza casi mancanti o falliti. TypeScript, lint del progetto e caricamento Node ESM passano. Passano nove prove browser sulla build ospitata e tre sul dominio pubblico; le richieste finanziarie del browser sono intercettate con fixture. Il controllo autenticato separato sul solo account QA verifica modello, medie, contratto e somme, oltre alla risposta schema 1 compatibile con Android precedente.

Android supera 404 test JVM debug e 404 release, lint debug/release e otto prove native su emulatore API35, con italiano, inglese e testo ingrandito. Le destinazioni e i menu sono invariati. L'upgrade firmato da code47 a code48 e il successivo avvio anonimo sono verificati. Un avviso di System UI sull'emulatore e' stato chiuso prima di ripetere l'avvio; la ripetizione mostra la schermata di accesso senza avvisi. Non e' stata verificata la conservazione di una sessione autenticata durante l'upgrade ne' un telefono fisico.

La release stabile viene rilevata dal proxy pubblico. Il download anonimo restituisce 401; quello autenticato con l'account QA restituisce l'APK corretto, verificato per dimensione e SHA-256. Le sessioni QA create dai controlli vengono chiuse; nessuna email o scrittura finanziaria. Le modifiche Android gia' presenti prima di questa attivita' nei file delle notifiche restano nel workspace e non entrano nella release.

Benchmark `regular180-occasional730-mean-v3`, eseguito durante build ed emulazione concorrenti: 18.100 transazioni sintetiche, tre warmup e dieci campioni, mediana 1.586,85 ms, massimo 2.017,26 ms; Intel Core i3-10100F a 3,60 GHz, otto CPU logiche, 31,9 GiB RAM, Windows, Node 24.19.0, un thread e float64. Misura Vite SSR di previsione e segnali, senza rete o database; non e' un confronto controllato con i tempi precedenti e non misura l'accuratezza statistica.
