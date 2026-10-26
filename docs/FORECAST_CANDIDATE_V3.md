# Candidato v3 — ordinarie e potenzialmente straordinarie

Questo esperimento confronta `ordinary-extra-v3` con il modello pubblicato `weekday-history-v1`. Rimane offline e non modifica l’API attiva. Le regole seguenti sono fissate prima di eseguire il nuovo confronto. I risultati 2026 sono già stati osservati per il candidato v2: il nuovo confronto è esplorativo e non costituisce un nuovo test indipendente.

## Definizione

Si mantengono 180 giorni massimi di storico, almeno 56 giorni osservati, conversione EUR registrata e la contabilità comune di speso, ricorrenze e movimenti programmati. I giorni senza spese sono osservazioni. Le ricorrenze già trattate dal motore non entrano nella variabile.

Una categoria è classificata abituale con almeno 12 giorni di spesa positiva e attività in almeno metà delle settimane complete osservate. Le settimane sono blocchi di sette giorni a ritroso dal giorno di riferimento, escluso; il primo blocco incompleto non decide la frequenza. Le altre categorie sono trattate come occasionali. È una classificazione statistica, non una dichiarazione certa della natura di un acquisto.

Per una categoria abituale, il limite giornaliero della componente ordinaria è `max(3*mediana, Q3+3*(Q3-Q1))`, calcolato sui giorni a spesa positiva e arrotondato ai centesimi. L’importo oltre il limite entra nella componente occasionale. Per le categorie occasionali, tutto l’importo entra in tale componente. La somma storica delle due componenti conserva lo speso originale.

Le ordinarie future partono dalla mediana dei totali delle settimane complete, divisa per sette. Il profilo del giorno della settimana conserva metà della variazione storica del weekday e metà di un profilo uniforme; i sette fattori hanno media uno. Questa è una stima robusta della spesa abituale, non una media condizionata teoricamente non distorta.

Le occasionali future usano `frequenza dei giorni con evento * importo medio dell’evento`: la probabilità giornaliera è il numero di giorni con extra diviso per i giorni osservati; l’importo è la media degli extra in quei giorni. La quota è distribuita uniformemente sui giorni futuri, senza inventare una data certa per un acquisto raro. Un evento da 600 EUR osservato una volta in 180 giorni contribuisce quindi 3,33 EUR/giorno in media, non un nuovo pagamento certo da 600 EUR.

Il totale finale è `già speso + programmato non già pagato + ordinarie residue stimate + extra residui attesi`. Le future transazioni registrate sostituiscono la stima della loro categoria/giorno secondo la regola comune: nel solo dettaglio diagnostico si sottraggono prima dalle ordinarie, poi dagli extra. Non si modificano o eliminano transazioni. Le stime giornaliere non vengono arrotondate prima dell’accumulo; il riepilogo conserva i centesimi della quota variabile complessiva.

## Valutazione

Si riutilizzano le date 7, 14, 21 e 26 e i consuntivi dei mesi conclusi. Nessuna categoria viene classificata usando i movimenti successivi alla data simulata; la classificazione viene rifatta a ogni previsione. Le configurazioni attuali delle ricorrenti non entrano nel confronto retrospettivo. I mesi importati retroattivamente non ricostruiscono quanto era noto all’epoca; il replay conservativo con timestamp resta un controllo aggiuntivo, senza recupero delle revisioni perdute.

Si confrontano MAE, RMSE, bias, WAPE e risultati per mese e data di origine. Il report contiene anche il confronto al giorno 26 contro il consuntivo vero, non solo una previsione del mese ancora aperto. I mesi del 2026 già esaminati non sono presentati come un campione indipendente dopo aver visto i risultati v2.

Dati personali e rapporti restano in `.vercel/forecast-evaluation`, esclusa da Git. Nessun deploy o invio di notifiche è necessario. Il candidato non genera intervalli predittivi certificati e non conosce in anticipo le spese occasionali non registrate.

Riferimento per il protocollo temporale: [Forecasting: Principles and Practice](https://otexts.com/fpp3/tscv.html). La separazione, le soglie e la formula del candidato sono scelte specifiche di questo progetto.

## Risultato e verifiche della candidata

Il confronto reale è misto: un piccolo miglioramento al giorno 26 non si conferma sull’insieme delle quattro date simulate del 2026. Il replay conservativo non sostiene un miglioramento complessivo. Il modello resta offline; tabelle e importi personali sono nel rapporto locale, non nella repository. Non sono stati provati altri valori delle soglie per far vincere questo confronto.

Verifica locale: 349 test superati, un test live opzionale saltato; typecheck, lint, build e caricamento nativo Node ESM riusciti. Le fixture v1 restano identiche. I nuovi test includono quaranta archivi sintetici deterministici, conservazione di speso e programmate, separazione dei picchi, isolamento dei movimenti futuri, conversione valutaria, classificazione e somma delle componenti.

Benchmark sintetico `node scripts/benchmark-insights.mjs ordinary-extra-v3`: 18.100 transazioni, tre riscaldamenti, dieci misure; mediana 616,00 ms, massimo 693,18 ms. Intel Core i3-10100F, 8 CPU logiche, RAM 31,9 GiB, Windows, Node 24.19.0, float64 e un thread. Il comando comprende anche i segnali, senza rete o database. La misura non è un confronto controllato di velocità né una prova dell’accuratezza statistica.
