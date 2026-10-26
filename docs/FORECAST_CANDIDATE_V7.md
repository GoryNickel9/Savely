# Candidato v7 — probabilità e importo

Esperimento locale `probability-amount-v7`, senza pubblicazione. Parametri fissati prima dell’esecuzione sul dataset personale.

## Specifica

Gli impegni e il già speso mantengono la contabilità comune. Lo storico variabile osservato è `[max(primo_movimento, origine−180 giorni), origine)`: il giorno di origine entra nel già speso ma non nell’addestramento. I movimenti vengono aggregati in centesimi per categoria e giorno. Giorni a zero e più acquisti nello stesso giorno sono trattati esplicitamente.

Per categoria `c`, `n_c` è il numero di giorni positivi su `D` osservati; `K` è il numero di categorie con almeno un giorno positivo. Il tasso medio del conto è `p_pool = sum(n_c)/(D*K)`. Il tasso della categoria è `(n_c + 28*p_pool)/(D+28)`. Per weekday `w`, la probabilità diventa `(n_cw + 4*p_c)/(D_w+4)`. Non vengono inventate categorie mai osservate.

L’importo positivo giornaliero segue una lognormale in centesimi. La media dei log della categoria è regolarizzata con quattro eventi equivalenti della media dei log dell’account: `(n_c*mu_c + 4*mu_pool)/(n_c+4)`. La varianza è `(SS_c + 8*var_pool)/(max(n_c−1,0)+8)`, con `SS_c` centrato sulla media locale. `var_pool` usa i residui entro categoria e i relativi gradi di libertà; senza ripetizioni in alcuna categoria usa `log(2)^2`. Si tratta di stime plug-in regolarizzate, non di una posterior predictive bayesiana completa.

Si simulano indipendentemente categoria e giorno, prima Bernoulli per l’evento, poi Box–Muller per il log-importo positivo. L’importo viene arrotondato al centesimo, con minimo un centesimo per l’evento positivo. Le pianificate variabili sostituiscono la quota campionata dello stesso giorno/categoria in ciascun percorso; gli impegni noti vengono aggiunti separatamente. Si usa la mediana del totale residuo, non la somma delle mediane giornaliere.

4.096 percorsi; Mulberry32, seed base `0x5a172027` combinato con la data. Prior di probabilità 28 giorni, weekday quattro osservazioni, media log quattro eventi, varianza otto eventi. Nessun parametro viene scelto leggendo il risultato. La disponibilità minima di 56 giorni rimane quella del riferimento.

## Valutazione prefissata

Stesso snapshot, SHA-256, 38 mesi e date 7/14/21/28 del candidato v6; riferimento ricalcolato e verificato su tutte le 152 date. Il dettaglio 2026 comprende nove mesi e 36 date. MAE primario, RMSE/bias/WAPE e risultati per origine/mese secondari. La media degli stessi percorsi è solo diagnostica; non viene selezionata successivamente come vincitore.

Si conserva il replay prudente che considera creazione/ultima modifica e pianificate già note. I mesi sono già stati osservati e non costituiscono un holdout indipendente. Gli intervalli empirici non sono calibrati.

## Limiti

L’indipendenza fra categorie e giorni perde la concentrazione delle spese nella stessa settimana. La lognormale è un’ipotesi distributiva, non una classificazione certa di spese ordinarie/straordinarie. La regolarizzazione può sottostimare categorie rare costose o sovrastimarne la frequenza. Non viene simulata l’incertezza dei parametri stimati. Le revisioni storiche e le cancellazioni non ricostruibili limitano il backtest. Nessuna spesa reale è rimossa dai consuntivi.

## Esecuzione ed esito

Comando locale:

```sh
node scripts/evaluate-probabilistic-spending.mjs .vercel/forecast-evaluation/private-dataset.json .vercel/forecast-evaluation/v7-comparison-7-14-21-28.json probability-amount-v7
```

Il vecchio ingresso `evaluate-weekly-bootstrap.mjs` continua a usare v6 come default e delega al medesimo protocollo. Lo snapshot deve coincidere con il suo hash precedente. Dataset, importi e rapporti personali rimangono nella directory ignorata da Git.

Il candidato migliora il MAE sull’intero storico ma peggiora MAE, RMSE e bias sui nove mesi recenti e nel replay prudente. Le bande empiriche non raggiungono la copertura nominale. Nessuna adozione: il v1 rimane il riferimento e il modello pubblicato. I dettagli sono nel rapporto privato locale; nessun parametro è stato ritoccato dopo averli letti.

## Verifiche

Otto nuovi test e suite completa: 374 passati, un live opzionale saltato. Typecheck, lint, runtime Node ESM nativo e build completati. La build conserva l’avviso sulle dimensioni dei chunk. MAE e RMSE sono stati ricomputati indipendentemente in Python. L’estrazione dei helper comuni PRNG/quantili non cambia nessuna delle 152 previsioni v6, le metriche né il replay prudente.

Benchmark sintetico forecast + Insights: 18.100 transazioni, tre riscaldamenti e dieci misure, mediana 1.052,69 ms e massimo 1.900,12 ms. Intel Core i3-10100F, 8 CPU logiche, 31,9 GiB RAM, Windows, Node 24.19.0, float64 con percorsi in centesimi interi, un thread. Durante altre verifiche: misura informativa, senza rete/database, non un confronto controllato di velocità.

Codice conservato su branch locale, senza push, merge in main o deploy.
