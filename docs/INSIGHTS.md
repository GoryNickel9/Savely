# Insights e previsione delle spese

La pagina mette la previsione di fine mese prima dei segnali. Il budget mensile è la somma dei budget delle categorie: la previsione totale comprende anche le spese senza un budget di categoria. Il margine è `somma dei budget − spesa totale prevista`.

## Previsione

`forecastSpending` in `server/spending-forecast.ts` è il motore unico, eseguito dal backend. Web e Android ricevono il risultato da `POST /api/spending-forecast`; il browser e l’APK non includono un secondo motore. [Contratto, autenticazione e limiti](FORECAST_API.md). La data di riferimento indica la fine del giorno locale; le transazioni successive sono programmate, non già spese.

La finestra di apprendimento contiene i 180 giorni precedenti, escluso il giorno di riferimento. Se il primo movimento disponibile è più recente, il calcolo usa la finestra più corta e ne mostra la durata. Servono almeno 56 giorni. Si assume che lo storico importato sia completo nell'intervallo tra il primo movimento e la data corrente: il sistema non può distinguere un giorno senza acquisti da un'importazione mancante.

Per ogni categoria regolare e giorno della settimana, il modello divide la somma delle spese variabili per il numero di occorrenze di quel giorno nella finestra. Il denominatore comprende i giorni a zero. Per i giorni restanti del mese somma queste aspettative, le ricorrenti attese e le transazioni future già registrate.

Per le categorie saltuarie il modello usa la media variabile del mese corrente e degli 11 precedenti, con divisore 12, ripartita sui giorni restanti del mese. Le programmate variabili della categoria sostituiscono questa attesa residua su tutto il mese. Le ricorrenti configurate restano prioritarie; il rilevatore automatico non deduce ricorrenze dalle categorie saltuarie. Lo speso resta sempre integrale. Formula, ipotesi e fixture condivisa tra web e Android sono in [FORECAST_API.md](FORECAST_API.md#previsione-per-le-categorie-saltuarie).

Le ricorrenti configurate prevalgono su quelle rilevate automaticamente. Il rilevatore usa solo dati storici; le descrizioni normalizzate delle ricorrenti sono escluse dal modello variabile. Le ricorrenti disattivate non vengono riproposte dal rilevatore. Per una scadenza, un pagamento o movimento programmato con descrizione e categoria compatibili, successivo alla scadenza precedente e non oltre quella attuale, soddisfa l'occorrenza una sola volta. Gli addebiti anticipati sono quindi conteggiati nello speso. Gli intervalli settimanali e i mesi corti usano la data locale selezionata dal server e aritmetica di calendario indipendente dal fuso del processo, mantenendo il giorno dell'ancoraggio originale.

Per la sola previsione, una ricorrenza con almeno tre addebiti precedenti coerenti può mantenere la propria cadenza dopo un ultimo addebito di importo diverso; in quel caso il nuovo importo diventa la stima della prossima scadenza. I suggerimenti standard conservano la soglia originaria di stabilità dei prezzi.

Una transazione variabile programmata sostituisce, fino al proprio importo, l'aspettativa della stessa categoria: sul singolo giorno per le regolari, sul residuo del mese per le saltuarie. Non viene aggiunta integralmente una seconda previsione della stessa spesa.

Gli importi delle transazioni sono convertiti in euro con il cambio registrato. Budget e ricorrenti non hanno un cambio memorizzato: se utilizzano altre valute, il totale previsionale non viene mostrato. Input non finiti, date non valide e budget duplicati per categoria producono uno stato di errore esplicito. L’endpoint esegue soltanto letture con il JWT dell’utente. La classificazione delle categorie richiede la migrazione descritta in FORECAST_API.md; il calcolo non scrive dati finanziari.

## Segnali

Anomalie e trend aggregano le transazioni per mese prima di calcolare la mediana. Le anomalie confrontano soltanto gli stessi giorni trascorsi; i trend confrontano mesi conclusi. I mesi completi senza spese valgono zero. Un mese iniziale coperto solo in parte non entra nel confronto. Le transazioni future e cancellate sono escluse.

Budget, anomalia e trend della stessa categoria diventano una sola scheda, con precedenza al superamento del budget e dettagli conservati. L'ordinamento usa gravità e tipo di segnale, senza confrontare euro con percentuali. I rincari confrontano l'ultimo addebito con una ricorrenza rilevata prima di quell'addebito, anche se il suggerimento di ricorrenza è già stato accettato.

Le schede mostrano titolo, messaggio e gravità. La pagina non mostra il controllo «Vedi confronto», i dettagli espandibili o i collegamenti «Apri…», nemmeno nello stato senza transazioni. I dati dei segnali restano disponibili nel modello.

Le categorie di spesa possono essere regolari o saltuarie. Quelle esistenti restano regolari. Per le saltuarie, il backend restituisce la media delle spese nei 12 mesi di calendario, incluso il mese corrente fino a oggi e i mesi a zero, e la confronta con il budget mensile atteso. Web e Android leggono lo stesso risultato. Non generano per queste categorie i precedenti segnali di anomalia mensile o trend basati sulla mediana. Pagina Budget e widget della dashboard web mostrano la media ricevuta dal server, con un'etichetta distinta dalla mediana delle spese regolari. La sintesi della pagina Budget somma la mediana globale delle spese regolari e le medie delle categorie saltuarie.

Tre spese da 100 EUR nella finestra producono una media di 25 EUR/mese; una sola produce 8,33 EUR/mese. La spesa effettiva resta 100 EUR nel mese del pagamento. I mesi senza movimenti valgono zero anche quando lo storico importato è più corto: occorre importare i 12 mesi per evitare una sottostima. Contratto, precisione e ordine di rilascio sono in [FORECAST_API.md](FORECAST_API.md#confronto-delle-categorie-saltuarie).

## Verifica e limiti

I test coprono somme dei budget, giorni a zero, giorni della settimana, anticipi, transazioni programmate, rilevamento automatico, disattivazione, intervalli settimanali, mesi corti, cambi valuta, storico insufficiente, fine mese, determinismo, errori delle fonti e interazioni della pagina.

Il modello v2 aggiunge dieci test per le categorie saltuarie: finestra di calendario, divisore fisso, conservazione dello speso, programmate sul residuo del mese, ricorrenti configurate, assenza di ricorrenze dedotte, categorie miste, febbraio bisestile e fixture condivisa con Android. Verifica locale del 26 ottobre 2026: 357 test superati, un test live opzionale saltato, TypeScript, lint, runtime ESM e build superati; 11 test Playwright pubblici superati. Le prove locali Playwright non usano credenziali di un conto reale.

Verifica locale del 26 ottobre 2026: suite completa `node node_modules/vitest/vitest.mjs run --pool=threads --maxWorkers=2`, 324 test superati e 1 test live Android opzionale saltato. Controllo browser sulla pagina reale con API e autenticazione sostituite da fixture locali: grafico, somma dei budget, filtri, dettagli, italiano/inglese e temi chiaro/scuro; nessun overflow orizzontale alle larghezze 320, 375, 736, 1024 e 1440 px. Questi controlli non verificano i dati o la sessione di un conto reale.

Il modello produce una stima puntuale. Non è ancora calibrato su uno storico reale con backtest: la pagina non mostra una fascia di confidenza né un punteggio di accuratezza. Non riconosce automaticamente spese straordinarie o stagionalità annuali. Eventi insoliti ancora presenti nella finestra possono influenzare la media. Scadenze passate non pagate non vengono automaticamente riportate nei giorni futuri. La normalizzazione delle descrizioni non identifica con certezza due abbonamenti diversi con lo stesso nome.

I tre paragrafi esplicativi esclusi dalla proposta approvata non sono presenti nell'interfaccia. Il footer indica soltanto finestra e durata dello storico.

## Benchmark riproducibile

Eseguire `node scripts/benchmark-insights.mjs`. Lo script costruisce 18.100 transazioni su 181 giorni, verifica gli importi attesi, esegue tre riscaldamenti e misura dieci calcoli completi di previsione e segnali. Non effettua richieste al database. Fixture deterministica, calcolo in float64, un thread.

Per verificare anche la componente saltuaria eseguire `node scripts/benchmark-insights.mjs --mixed`: cinque categorie regolari e cinque saltuarie, con importi attesi controllati da assert (2.000 EUR spesi, 817,61 EUR residui, totale 2.817,61 EUR). Con il modello v2, sullo stesso hardware e runtime descritti sotto, la mediana è 1.312,99 ms per sole regolari (massimo 1.935,91 ms) e 1.277,21 ms per il caso misto (massimo 1.807,78 ms). Queste misure non dimostrano un miglioramento di accuratezza né un confronto controllato delle prestazioni.

Misura locale del 26 ottobre 2026: mediana 1.801,02 ms, massimo 2.284,35 ms. Hardware Intel Core i3-10100F a 3,60 GHz, 8 processori logici, 31,9 GiB di RAM, Windows, Node v24.19.0. Il comando carica il TypeScript con il runner SSR di Vite, senza build ottimizzata; questi tempi non sono un benchmark del bundle browser in produzione. Non sono state applicate ottimizzazioni basate su questa singola misura.
