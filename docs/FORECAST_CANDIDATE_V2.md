# Candidato previsionale v2 — valutazione offline

Il backend continua a pubblicare `weekday-history-v1`. Le varianti nuove sono esplicite opzioni del motore per test e confronto; non esistono una scelta del modello nel client o un percorso che le attivi per un utente reale. La contabilità di speso, pianificate, ricorrenze e budget resta nel solo motore condiviso.

## Formula e parametri fissati

`recent-weekday-v2` usa la stessa finestra massima di 180 giorni e lo stesso minimo di 56 giorni. Per ogni categoria e giorno osservato, comprese le giornate a zero, si aggregano le uscite variabili in EUR. Ricorrenze e transazioni future mantengono la gestione comune del motore attuale.

Il peso di un giorno vecchio di `a` giorni è `w(a) = 2^(-(a-1)/56)`: il giorno precedente ha peso 1; dopo altre otto settimane il peso si dimezza. La media giornaliera della categoria è `mu = somma(w*x) / somma(w)`. Per ciascun giorno della settimana la stima è:

```text
r(categoria, weekday) = (somma(w*x nel weekday) + 4*mu) / (somma(w nel weekday) + 4)
```

Le quattro osservazioni equivalenti riportano stime con pochi dati verso la media della categoria. Non introducono spese di altre categorie. I giorni senza uscite entrano nel denominatore: la media non è quella dei soli acquisti.

`robust-recent-weekday-v2` aggiunge un limite ai soli valori giornalieri usati per stimare la componente variabile: `Q3 + 3*(Q3-Q1)`. Lo applica solo con almeno 12 giorni a spesa positiva in almeno 8 settimane distinte. I quartili usano interpolazione lineare. Lo speso effettivo non viene ridotto o riscritto; neppure i pagamenti programmati vengono tagliati. Il criterio non dimostra che un pagamento sia straordinario e non sostituisce un’informazione esplicita dell’utente.

Per ogni giorno futuro, la previsione mantiene `speso + scadenze non già pagate + variabile residua`. Le transazioni programmate sostituiscono la quota variabile dello stesso giorno e categoria secondo le regole esistenti. Le due varianti conservano il formato della risposta, ma non sono ancora il modello pubblicato.

## Confronto temporale

`scripts/evaluate-spending-forecast.mjs` legge uno snapshot JSON locale. Non contiene chiamate di rete o scritture al database. L’estrazione deve essere autorizzata e limitata all’account richiesto; snapshot e rapporti restano in `.vercel/forecast-evaluation`, esclusa da Git. Non inserire nella repository email, UUID, movimenti o report finanziari reali.

```text
node scripts/evaluate-spending-forecast.mjs <snapshot-locale.json> .vercel/forecast-evaluation/comparison.json 2026-10-26
```

Il protocollo usa le date 7, 14, 21 e 26 di ciascun mese concluso, con almeno 56 giorni di storico. Ogni previsione retrospettiva riceve soltanto movimenti con data non successiva al giorno simulato; la configurazione attuale delle ricorrenti e le transazioni future sono escluse per non introdurre informazioni future. Le ricorrenze possono essere inferite solo dal passato. Le mensilità fino a dicembre 2025 sono separate da gennaio–settembre 2026; i parametri sono stati fissati prima di valutare quest’ultimo periodo.

Le metriche sono MAE, RMSE, errore medio con segno e WAPE. Le quattro previsioni dello stesso mese sono correlate: non rappresentano quattro mesi indipendenti. La previsione del mese in corso non ha ancora un totale finale con cui confrontarsi. Il confronto sui dati oggi disponibili non ricostruisce necessariamente ciò che era noto allora, soprattutto in presenza di importazioni retroattive.

Il secondo replay esclude record creati o modificati dopo il termine della giornata locale simulata in Europe/Rome, tenendo conto di DST. È un controllo conservativo, non una ricostruzione delle versioni precedenti: senza un audit storico non è possibile recuperare importi o configurazioni sovrascritti. Anche il totale finale dei mesi passati riflette lo snapshot disponibile oggi.

Il rapporto calcola inoltre una fascia empirica da errori di mesi già conclusi, per la stessa data di origine, con almeno 12 e al massimo 24 mesi di calibrazione. La copertura viene verificata sui mesi successivi. Il numero 80% è un obiettivo di verifica, non una copertura garantita. Queste fasce non entrano nell’API o nell’interfaccia.

Riferimento metodologico: [Forecasting: Principles and Practice, validazione temporale](https://otexts.com/fpp3/tscv.html). La scelta di pesi e regolarizzazione è una proposta specifica di questo progetto, non una formula prescritta dalla fonte.

## Esito e criterio di adozione

La prima verifica su dati reali non giustifica la sostituzione del modello attuale: le varianti aumentano l’errore nel periodo tenuto separato. I risultati personali restano nel rapporto locale. Il modello pubblicato rimane v1. Una stima diversa non è automaticamente più accurata; una riduzione dell’errore su un account non dimostrerebbe un miglioramento per tutti.

Prima di promuovere una revisione servono dati di verifica ulteriori e una distinzione verificabile tra spese ordinarie e straordinarie future. Eventuali parametri scelti dopo aver visto il periodo di verifica richiedono un nuovo periodo indipendente. Non si deve ottimizzare la variante finché vince sul solo account d’esempio e poi riutilizzare quel confronto come prova indipendente.

## Verifica del codice

`recentSpending.test.ts` copre adattamento al regime recente, giornate a zero, categorie sparse, conservazione dello speso, limite robusto, non mutazione degli input e assenza di apprendimento dai movimenti futuri. Le fixture v1 restano esatte per tutti i 48 casi e 1.464 punti.

Eseguire typecheck, lint, suite completa, `npm run test:forecast-runtime` e build. Per il benchmark sintetico già esistente: `node scripts/benchmark-insights.mjs recent-weekday-v2` oppure `robust-recent-weekday-v2`; i tempi non comprendono rete o database.
