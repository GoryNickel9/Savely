# Insights e previsione delle spese

La pagina mette la previsione di fine mese prima dei segnali. Il budget mensile è la somma dei budget delle categorie: la previsione totale comprende anche le spese senza un budget di categoria. Il margine è `somma dei budget − spesa totale prevista`.

## Previsione

`forecastSpending` in `server/spending-forecast.ts` è il motore unico, eseguito dal backend. Web e Android ricevono il risultato da `POST /api/spending-forecast`; il browser e l’APK non includono un secondo motore. [Contratto, autenticazione e limiti](FORECAST_API.md). La data di riferimento indica la fine del giorno locale; le transazioni successive sono programmate, non già spese.

La finestra di apprendimento contiene i 180 giorni precedenti, escluso il giorno di riferimento. Se il primo movimento disponibile è più recente, il calcolo usa la finestra più corta e ne mostra la durata. Servono almeno 56 giorni. Si assume che lo storico importato sia completo nell'intervallo tra il primo movimento e la data corrente: il sistema non può distinguere un giorno senza acquisti da un'importazione mancante.

Per ogni categoria e giorno della settimana, il modello divide la somma delle spese variabili per il numero di occorrenze di quel giorno nella finestra. Il denominatore comprende i giorni a zero. Per i giorni restanti del mese somma queste aspettative, le ricorrenti attese e le transazioni future già registrate.

Le ricorrenti configurate prevalgono su quelle rilevate automaticamente. Gli importi delle ricorrenti rilevate sono la media aritmetica degli addebiti osservati. Il rilevatore usa solo dati storici; le descrizioni normalizzate delle ricorrenti sono escluse dal modello variabile. Le ricorrenti disattivate non vengono riproposte dal rilevatore. Per una scadenza, un pagamento o movimento programmato con descrizione e categoria compatibili, successivo alla scadenza precedente e non oltre quella attuale, soddisfa l'occorrenza una sola volta. Gli addebiti anticipati sono quindi conteggiati nello speso. Gli intervalli settimanali e i mesi corti usano la data locale selezionata dal server e aritmetica di calendario indipendente dal fuso del processo, mantenendo il giorno dell'ancoraggio originale.

Per la sola previsione, una ricorrenza con almeno tre addebiti precedenti coerenti può mantenere la propria cadenza dopo un ultimo addebito di importo diverso; anche in quel caso la versione pubblicata usa la media degli addebiti osservati per stimare l'importo. I suggerimenti standard conservano la soglia originaria di stabilità dei prezzi.

Una transazione variabile programmata sostituisce, fino al proprio importo, l'aspettativa per la stessa categoria e lo stesso giorno. Non viene aggiunta integralmente una seconda previsione della stessa spesa.

### Dettaglio per categoria

Il titolo con la freccia è un pulsante che nasconde o mostra la tabella, utilizzabile anche da tastiera. Il titolo resta visibile quando la sezione è chiusa. La scelta viene salvata nel browser per account e ripristinata tornando nella pagina o ricaricandola; in assenza di una preferenza la tabella è aperta. La preferenza non viene sincronizzata su altri dispositivi. Se lo storage del browser non è disponibile, il pulsante continua a funzionare nella visita corrente.

Modifica pubblicata il 1 novembre 2026 nella build Vercel `dpl_BQfGupXpwfNNqaaKKrM6f4KX9eDM`. Passano gli otto test della pagina, TypeScript, lint e build remota. Le prove browser con fixture verificano chiusura e riapertura da tastiera, desktop/mobile, italiano/inglese e temi chiaro/scuro; il controllo finale sul dominio pubblico passa. Il cambiamento riguarda la visualizzazione e non richiede migrazioni.

L'aggiornamento successivo del 1 novembre 2026, build `dpl_BeuF4GnMuzsGiveBumMio3u99BHP`, aggiunge la preferenza persistente per account, rinomina “Ancora previsto” in “Previsto”, rimuove “Fine mese” e colora di verde gli scostamenti negativi. Il selettore categorie nei form modali ora occupa spazio nel form: la finestra cresce fino al limite dello schermo e la lista scorre al suo interno. Le prove coprono anche ricerca, selezione da tastiera con importo già compilato, Escape e i selettori dei form Transazioni e Ricorrenti. Passano 425 test unitari e di integrazione, con un test live opzionale saltato, TypeScript, lint e build remota; sei prove browser sulla build ospitata e due controlli finali sul dominio pubblico usano fixture senza scrivere dati finanziari.

La tabella “Previsione per categoria” mostra Già speso, Previsto, Budget e Scostamento. “Previsto” indica le ricorrenti, le programmate e le variabili ancora attese nel mese; la colonna “Fine mese” è rimossa. Lo scostamento è `già speso + previsto − budget`: un valore positivo indica uno sforamento previsto ed è rosso; un valore negativo è verde, mentre zero e valori mancanti sono neutri. Una categoria senza budget mostra il trattino nelle due colonne di confronto. Le spese senza categoria hanno una riga separata; entrano anche le categorie con budget senza movimenti nel mese. Le righe sono ordinate per spesa totale prevista decrescente. La tabella scorre orizzontalmente sui display stretti.

Il backend conserva i contributi per categoria della stessa traversata che calcola il totale. Per ciascuna componente, l'arrotondamento con il metodo dei maggiori resti distribuisce gli eventuali centesimi residui; la somma delle righe coincide con i totali già pubblicati. Ricorrenti e programmate seguono le stesse regole di deduplicazione della previsione complessiva. Il client formatta gli importi e calcola lo scostamento, senza riaddestrare o estrapolare una previsione locale.

Con storico insufficiente o valute non supportate, il dettaglio conserva lo speso ma mostra il trattino per previsione e scostamento. Le vecchie risposte senza `forecast.categories` restano leggibili e non mostrano la tabella. “Spesa saltuaria” riporta la scelta manuale della categoria: la media su 12 mesi usata per confrontare il budget non sostituisce la previsione di fine mese. Il modello conserva i limiti descritti sotto; non è stata misurata l'accuratezza per categoria.

Gli importi delle transazioni sono convertiti in euro con il cambio registrato. Budget e ricorrenti non hanno un cambio memorizzato: se utilizzano altre valute, il totale previsionale non viene mostrato. Input non finiti, date non valide e budget duplicati per categoria producono uno stato di errore esplicito. L’endpoint esegue soltanto letture con il JWT dell’utente. La classificazione delle categorie richiede la migrazione descritta in FORECAST_API.md; il calcolo non scrive dati finanziari.

## Riferimenti medi dei budget

Budget personali e widget Dashboard usano la media aritmetica dei totali mensili negli ultimi 730 giorni, limitata allo storico disponibile. I mesi senza spese della categoria valgono zero dalla prima transazione non cancellata dell'account, entro la finestra. I mesi iniziale e corrente entrano con gli importi osservati, senza proiezione o riproporzionamento. Movimenti futuri e cancellati sono esclusi; le transazioni personali vengono convertite in EUR con il cambio registrato prima della somma. I centesimi vengono sommati come interi, con controlli di overflow, e la media viene arrotondata soltanto nella visualizzazione.

Tutte le categorie regolari usano la stessa copertura temporale, anche quando una viene esclusa dal totale: la somma delle medie resta coerente con la media globale. Le categorie saltuarie conservano il confronto su 12 mesi restituito dal server. Budget Familiare usa la media delle quote mensili su tutto lo storico condiviso disponibile, includendo i mesi a zero e il mese corrente. Uno storico incompleto può sottostimare la media perché un periodo senza acquisti non si distingue da un'importazione mancante.

## Segnali

Anomalie e trend aggregano le transazioni per mese prima di calcolare la media aritmetica. Le anomalie confrontano soltanto gli stessi giorni trascorsi; i trend confrontano mesi conclusi. I mesi completi senza spese valgono zero. Un mese iniziale coperto solo in parte non entra nel confronto. Le transazioni future e cancellate sono escluse.

Budget, anomalia e trend della stessa categoria diventano una sola scheda, con precedenza al superamento del budget e dettagli conservati. L'ordinamento usa gravità e tipo di segnale, senza confrontare euro con percentuali. I rincari confrontano l'ultimo addebito con una ricorrenza rilevata prima di quell'addebito, anche se il suggerimento di ricorrenza è già stato accettato.

Le schede mostrano titolo, messaggio e gravità. La pagina non mostra il controllo «Vedi confronto», i dettagli espandibili o i collegamenti «Apri…», nemmeno nello stato senza transazioni. I dati dei segnali restano disponibili nel modello.

Le categorie di spesa possono essere regolari o saltuarie. Quelle esistenti restano regolari. Per le saltuarie, il backend restituisce la media delle spese nei 12 mesi di calendario, incluso il mese corrente fino a oggi e i mesi a zero, e la confronta con il budget mensile atteso. Web e Android leggono lo stesso risultato. Non generano per queste categorie i segnali di anomalia mensile o trend delle categorie regolari. Pagina Budget e widget della dashboard web mostrano la media ricevuta dal server; la pagina Budget identifica queste categorie con il badge “Spesa saltuaria”. I sottotitoli con le formule sono rimossi dalle schede Budget, dal widget per le categorie saltuarie e dai form Categorie. La sintesi della pagina Budget somma la media globale delle spese regolari e le medie delle categorie saltuarie.

Tre spese da 100 EUR nella finestra producono una media di 25 EUR/mese; una sola produce 8,33 EUR/mese. La spesa effettiva resta 100 EUR nel mese del pagamento. I mesi senza movimenti valgono zero anche quando lo storico importato è più corto: occorre importare i 12 mesi per evitare una sottostima. Contratto, precisione e ordine di rilascio sono in [FORECAST_API.md](FORECAST_API.md#confronto-delle-categorie-saltuarie).

## Verifica e limiti

I test coprono somme dei budget, giorni a zero, giorni della settimana, anticipi, transazioni programmate, rilevamento automatico, disattivazione, intervalli settimanali, mesi corti, cambi valuta, storico insufficiente, fine mese, determinismo, errori delle fonti e interazioni della pagina.

Verifica locale del 26 ottobre 2026: suite completa `node node_modules/vitest/vitest.mjs run --pool=threads --maxWorkers=2`, 324 test superati e 1 test live Android opzionale saltato. Controllo browser sulla pagina reale con API e autenticazione sostituite da fixture locali: grafico, somma dei budget, filtri, dettagli, italiano/inglese e temi chiaro/scuro; nessun overflow orizzontale alle larghezze 320, 375, 736, 1024 e 1440 px. Questi controlli non verificano i dati o la sessione di un conto reale.

Il modello produce una stima puntuale. Non è ancora calibrato su uno storico reale con backtest: la pagina non mostra una fascia di confidenza né un punteggio di accuratezza. Non riconosce automaticamente spese straordinarie o stagionalità annuali. Eventi insoliti ancora presenti nella finestra possono influenzare la media. Scadenze passate non pagate non vengono automaticamente riportate nei giorni futuri. La normalizzazione delle descrizioni non identifica con certezza due abbonamenti diversi con lo stesso nome.

I tre paragrafi esplicativi esclusi dalla proposta approvata non sono presenti nell'interfaccia. Il footer indica soltanto finestra e durata dello storico.

## Benchmark riproducibile

Eseguire `node scripts/benchmark-insights.mjs`. Lo script costruisce 18.100 transazioni su 181 giorni, verifica gli importi attesi, esegue tre riscaldamenti e misura dieci calcoli completi di previsione e segnali. Non effettua richieste al database. Fixture deterministica, calcolo in float64, un thread.

Misura locale del 26 ottobre 2026: mediana 1.801,02 ms, massimo 2.284,35 ms. Hardware Intel Core i3-10100F a 3,60 GHz, 8 processori logici, 31,9 GiB di RAM, Windows, Node v24.19.0. Il comando carica il TypeScript con il runner SSR di Vite, senza build ottimizzata; questi tempi non sono un benchmark del bundle browser in produzione. Non sono state applicate ottimizzazioni basate su questa singola misura.


## Regole attuali: ordinarie 180 giorni, saltuarie 730 giorni

Lo schema 2 sostituisce le finestre precedenti nei Budget web, nel widget Dashboard e nei confronti con il budget degli Insights web e Android. La media mensile include i mesi a zero e il mese corrente fino a oggi, nella copertura disponibile, senza extrapolare i mesi parziali. La finestra cambia per categoria: 180 giorni ordinaria, 730 saltuaria. Il server restituisce gli stessi importi e gli stessi flag di superamento ai due client. Con soli pochi mesi importati si usano quei mesi; lo storico mancante non viene ricostruito.

Per Budget Familiare la categoria personale con lo stesso nome determina la classificazione; in assenza di corrispondenza si usa ordinaria. Si confrontano le quote personali condivise nelle rispettive finestre, conservando mesi a zero e mese corrente. Il totale somma le medie dei gruppi, comprese le spese senza categoria.

La previsione usa la media per giorno della settimana sui 180 giorni per le ordinarie e la media mensile sui 730 giorni per le variabili saltuarie. Le spese effettive del mese non vengono smussate. L'apprendimento esclude oggi, mentre il confronto del budget include lo speso fino a oggi. Il primo giorno del mese entra quindi come mese parziale nel denominatore, come per i Budget.

Anomalie e trend restano segnali per le categorie ordinarie: usano medie, con riferimento storico di 180 giorni. Le anomalie confrontano gli stessi giorni trascorsi dei mesi conclusi; il trend confronta gli ultimi tre mesi conclusi con i mesi completi osservati nei 180 giorni. Le saltuarie usano il confronto del budget su 730 giorni, evitando avvisi causati dalla cadenza irregolare. Risparmio globale e patrimonio mantengono le proprie metriche, indipendenti dal riferimento del budget di categoria.

Android mantiene le destinazioni esistenti e non aggiunge una pagina Budget. Le notifiche riutilizzano i segnali della schermata e le nuove medie, con gli stessi consensi e la stessa deduplicazione.
