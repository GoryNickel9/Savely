# Candidato v4 — mesi analoghi e spesa residua

Il candidato `monthly-analogue-v4` cerca di ridurre il MAE sull’insieme delle date 7, 14, 21 e 26, non su una sola data. Rimane offline e il modello pubblicato non cambia. Le regole qui sotto sono fissate prima di eseguire il confronto nuovo; non vengono esplorate griglie di parametri sul conto di esempio.

Si confronta la spesa variabile già registrata nel mese con quella dei mesi precedenti, fermando ciascun mese allo stesso giorno del mese. Si escludono le ricorrenze già gestite dal motore comune. Sono ammessi soltanto mesi interamente compresi nei 180 giorni di storico, con almeno un giorno residuo, fino a sei mesi. Servono almeno tre mesi confrontabili; altrimenti si usa la stima weekday del v1.

La distanza fra mese corrente e mese passato è la media di due quantità: differenza assoluta fra i totali già spesi e somma delle differenze assolute per categoria, entrambe divise per `totale passato + totale corrente + 1 EUR`. Il dato del giorno corrente è utilizzabile perché la previsione rappresenta il termine della giornata. Nessuna spesa successiva alla data simulata entra nelle caratteristiche del mese corrente.

Si scelgono i tre mesi più vicini, con parità risolta in favore del più recente. Per ognuno si divide la spesa effettiva successiva al giorno di origine per il numero dei suoi giorni residui, per confrontare mesi di diversa lunghezza. La stima giornaliera è `75% mediana dei residui giornalieri dei tre vicini + 25% media dei residui giornalieri di tutti i mesi confrontabili`. La mediana mira all’errore assoluto; la quota media conserva parte del rischio degli eventi rari. Non è una media condizionata teoricamente non distorta.

La distribuzione per categoria usa la stessa combinazione 75/25 delle medie di categoria, riscalata al totale giornaliero appena calcolato. La quota futura è uniforme nei giorni restanti; non si inventa un effetto weekday con pochi mesi. Il motore comune mantiene speso effettivo, pianificate, deduplicazione delle ricorrenze e sostituzione della stima per giorno/categoria in presenza di movimenti futuri registrati.

Il confronto usa lo stesso snapshot e gli stessi consuntivi dei tentativi precedenti. Questi mesi 2026 sono già stati osservati: il confronto è esplorativo, non un nuovo test indipendente. Il rapporto privato mostrerà MAE, RMSE, bias, WAPE e risultati per tutte le date, oltre al replay conservativo dei timestamp. Dati e rapporti personali sono esclusi da Git. Nessun deploy o nuova release è previsto per il candidato.

## Esito e controlli

La prova sui mesi conclusi già usati non riduce il MAE complessivo. Il candidato non viene attivato. I risultati personali restano nel rapporto locale escluso da Git. I parametri non vengono cambiati dopo aver letto questa prova.

Suite completa: 358 test superati, un test live opzionale saltato. Typecheck, lint, build e caricamento della funzione con Node ESM nativo completati. Il modello v1 mantiene esattamente le fixture approvate.

Benchmark sintetico già esistente, 18.100 transazioni e dieci campioni dopo tre riscaldamenti: mediana 2.147,95 ms, massimo 2.717,61 ms. Intel Core i3-10100F, 8 CPU logiche, 31,9 GiB RAM, Windows, Node 24.19.0, float64, un thread. Misura durante altre build, senza rete/database e senza confronto controllato delle prestazioni.
