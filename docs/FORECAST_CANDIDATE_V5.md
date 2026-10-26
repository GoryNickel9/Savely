# Candidato v5 — storico con correzione del ritmo mensile

Dopo l’esito negativo del candidato per mesi analoghi si prova un riferimento più semplice, senza una ricerca di parametri: `pace-shrink-v5`. Nessun modello viene pubblicato. Anche questo confronto è esplorativo: gli stessi mesi sono già stati esaminati in precedenza.

Per categoria e weekday si conserva la stima media del v1 sui giorni osservati dei 180 precedenti, inclusi gli zeri e con ricorrenze escluse. La si combina con la media giornaliera della variabile già spesa dal primo del mese fino alla data di origine, inclusa. Il peso del mese corrente è `d/(d+28)`, con `d` giorno del mese; lo storico pesa `28/(d+28)`. Le quattro settimane equivalenti sono un parametro fisso, scelto prima di eseguire questa variante. Non è una stima bayesiana con campioni indipendenti, perché le osservazioni correnti compaiono anche nello storico.

Quindi `r(c,w) = 28/(d+28)*r_storico(c,w) + d/(d+28)*speso_variabile_corrente(c)/d`. Si conserva la struttura comune per già speso, scadenze e pianificate, compresa la sostituzione della quota variabile dello stesso giorno/categoria. Anche una categoria comparsa nel solo giorno corrente può contribuire, con la regolarizzazione descritta. Non si apprende dai giorni successivi alla data simulata.

Si confrontano gli stessi 152 punti in 38 mesi e, in particolare, tutte le 36 date 7/14/21/26 dei nove mesi conclusi del 2026. Sono riportati MAE, RMSE, WAPE e bias: un miglioramento del solo giorno 26 non basta. Snapshot e importi restano esclusi da Git. Parametri alternativi non verranno scelti in base al risultato di questa prova.

## Esito e controlli

La prova riduce il RMSE, ma non il MAE del confronto complessivo. Il replay conservativo migliora leggermente il MAE. Il risultato è misto e non comporta un cambio del modello pubblicato. I risultati personali restano nel rapporto locale escluso da Git. I parametri non vengono cambiati dopo aver letto questa prova.

Suite completa: 358 test superati, un test live opzionale saltato. Typecheck, lint, build e caricamento della funzione con Node ESM nativo completati. Il modello v1 mantiene esattamente le fixture approvate.

Stesso benchmark sintetico da 18.100 transazioni, dieci campioni dopo tre riscaldamenti: mediana 1.013,38 ms, massimo 1.192,51 ms. Intel Core i3-10100F, 8 CPU logiche, 31,9 GiB RAM, Windows, Node 24.19.0, float64, un thread. Misura durante altre build, senza rete/database: non dimostra un vantaggio di velocità in produzione.
