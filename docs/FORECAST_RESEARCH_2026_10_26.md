# Ricerca sulla previsione di spesa — 26 ottobre 2026

## Decisione

Conservare `weekday-history-v1` in produzione. Le varianti finora provate non hanno ridotto il MAE complessivo del confronto principale. Nessuna pubblicazione di un nuovo algoritmo è autorizzata da questa ricerca.

Il candidato prioritario è un modello probabilistico del residuo mensile: separare la probabilità di una spesa dall’importo quando avviene, simulare il totale fino a fine mese e usare la mediana del totale come previsione centrale. È una proposta da verificare, non un miglioramento già dimostrato. La release Android 1.0.7 distribuisce soltanto Categorie e conserva il backend attuale.

## Perché questa direzione

Il v1 usa già ricorrenze e movimenti pianificati separati, poi medie per categoria e giorno della settimana, includendo i giorni a zero. Anche v3 ordinario/straordinario distribuisce una media degli extra: cambiare la classificazione non risolve da solo l’asimmetria degli importi.

MAE e RMSE chiedono punti previsionali diversi: mediana per errore assoluto, media per errore quadratico. Le mediane non sono additive. Occorre simulare percorsi e sommare ciascun percorso prima di estrarre la mediana mensile; sommare mediane giornaliere può azzerare artificialmente categorie sporadiche. [Hyndman e Athanasopoulos, §§5.6, 5.8](https://otexts.com/fpp3/toolbox.html#scale-dependent-errors).

## Alternative da confrontare

| Metodo | Ruolo proposto | Limite |
|---|---|---|
| Bootstrap di blocchi settimanali del residuo | Primo riferimento probabilistico semplice: conserva giorni a zero e spese che si concentrano nella stessa settimana; aggregazione e mediana mensile | Circa 25 settimane in 180 giorni: poca informazione sugli eventi rari, nessuna buona stagionalità annuale |
| Due parti: probabilità + importo positivo | Candidato principale; categorie scarse regolarizzate verso lo stesso account, poche variabili di calendario | Molti parametri o categorie senza eventi rendono instabili le stime; servono ripieghi e simulazioni coerenti |
| Croston/SBA/TSB | Benchmark per categorie intermittenti; TSB aggiorna la probabilità anche durante periodi senza eventi | Non comprendono da soli calendario, spese già sostenute o cause degli straordinari; non sostituiscono gli impegni noti |
| Combinazione a pesi uguali prefissati | Controllo contro la selezione instabile di un singolo modello | Nessuna garanzia sul singolo account; pesi e candidati non vanno scelti dopo il risultato |

La struttura probabilistica di arrivi e importi ha precedenti nei modelli di rinnovo per serie intermittenti. La proposta iniziale per Savely usa una versione semplice, senza introdurre la rete neurale del paper. [Türkmen et al., 2021](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0259764).

Per Croston/SBA/TSB: [Teunter, Syntetos e Babai, 2011](https://pure.rug.nl/ws/portalfiles/portal/145394864/Intermittent_demand_Linking_forecasting_to_inventory_obsolescence.pdf). Per combinazioni e limiti della selezione: [Wang et al., 2023](https://fpp.robjhyndman.com/publications/combinations/). Condividere parametri fra categorie è un’ipotesi utile per serie corte, non un’autorizzazione a usare dati di altri clienti: [Montero-Manso e Hyndman, 2021](https://robjhyndman.com/publications/global-forecasting/).

## Spese ordinarie e straordinarie

Una spesa elevata vera non è un errore da eliminare. Tutto ciò che è già stato speso resta integralmente nel totale. Gli straordinari pianificati entrano fra gli impegni noti; quelli futuri sconosciuti richiedono una probabilità e un intervallo, senza inventarne data e importo. La classificazione deve dipendere solo dai dati noti alla data simulata. I consuntivi includono tutte le spese vere. [FPP3, §13.9](https://otexts.com/fpp3/practical.html#dealing-with-outliers-and-missing-values).

## Protocollo prima di scegliere

1. Congelare candidati, pochi parametri e origini 7/14/21/26. MAE del totale mensile primario; RMSE, bias e risultati per origine secondari. I mesi già visti restano sviluppo, anche se lo script li chiama holdout.
2. Usare rolling-origin cronologico interno per scegliere parametri e mesi successivi mai usati per la valutazione esterna. Le quattro origini dello stesso mese sono correlate: raggruppare confronti e incertezza per mese, senza trattarle come osservazioni indipendenti. [FPP3, §5.10](https://otexts.com/fpp3/toolbox.html#time-series-cross-validation).
3. Confrontare anche intervalli 80%/95%, copertura, ampiezza e punteggio dei quantili. Non sommare estremi o mediane giornalieri. Una calibrazione empirica non garantisce il singolo risultato futuro.
4. Conservare snapshot delle previsioni e degli input noti allora. Importazioni e modifiche successive impediscono oggi un replay esatto: filtrare `updated_at` non recupera la vecchia versione. Distinguere registrazioni incomplete da giorni realmente a zero.
5. Adottare solo dopo un miglioramento esterno documentato del criterio primario, controllando che il risultato non dipenda da un solo mese eccezionale. Fino ad allora il v1 resta riferimento e modello pubblicato.

## Stato delle verifiche

Due analisi indipendenti tramite subagent, consultazione delle fonti primarie e lettura del codice/report esistenti. Nessun nuovo backtest, accesso ad altri account, modifica al modello, scrittura a dati personali o deploy. Questa ricerca non fornisce nuove percentuali di miglioramento: mancano risultati su dati non usati per scegliere i candidati.
