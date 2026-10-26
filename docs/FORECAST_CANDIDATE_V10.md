# Candidato v10 — pesi 60/40 e 40/60

Confronto locale richiesto, con pesi nell’ordine attuale/ricampionamento settimanale. Il modello in produzione resta invariato; nessuna modifica a percorsi applicativi o API.

## Metodo

Si aggiungono i soli pesi richiesti: `(3*v1 + 2*v6)/5` e `(2*v1 + 3*v6)/5`. I riferimenti sono attuale e 50/50. Le componenti sono le stesse previsioni già verificate per ciascuna data: non si estraggono nuovi percorsi settimanali e non si cambiano i seed. Già speso e impegni noti vengono contati una sola volta.

I totali delle componenti sono in centesimi interi. Si calcola il numeratore intero, si divide per cinque e si arrotonda una sola volta. La scelta dell’arrotondamento usa il resto intero: su somme molto grandi la rappresentazione floating point di `n/5` può spostare una frazione 0,4 a 0,5. Un test riproduce questo caso limite e ne verifica la correzione; i risultati dell’account non cambiano.

Le funzioni esistenti per 50/50 e quarti riusano lo stesso controllo monetario; conservano risultati e limiti precedenti. Input non validi e somme ponderate oltre la precisione intera sicura generano errori espliciti. Non si costruiscono nuove distribuzioni o intervalli dalla media di bande dei componenti.

## Esecuzione

```sh
node scripts/evaluate-forecast-combination.mjs --fifth-weights
```

L’ingresso senza opzione conserva il confronto 50/50; `--quarter-weights` conserva 75/25 e 25/75. Dataset e rapporto delle componenti devono avere gli stessi SHA-256 della prova precedente, e si richiede il rapporto v8 originale. Previsioni e metriche del 50/50 devono coincidere in tutte le date.

Il campione rimane di 38 mesi, date 7/14/21/28 e 152 previsioni; il dettaglio 2026 contiene nove mesi e 36 origini. Il replay prudente considera record creati/non modificati entro ciascuna data e pianificate già note. Le vecchie revisioni e alcune importazioni/cancellazioni non sono ricostruibili.

## Esito e limiti

Il 40/60 ha MAE leggermente inferiore al 50/50 nella ricostruzione principale, ma RMSE e sottostima peggiorano. Il 60/40 migliora RMSE e contiene la sottostima rispetto al 50/50, ma aumenta il MAE. Il 50/50 conserva il MAE più basso nel replay prudente, con differenze trascurabili rispetto al 40/60.

Non emerge un peso uniformemente migliore. Gli intervalli descrittivi della differenza MAE, ricampionando i nove mesi come blocchi, includono zero per tutte le combinazioni. Non sono corretti per confronti multipli. La successione di confronti sugli stessi mesi già osservati è esplorativa: serve una verifica indipendente prima di scegliere un peso per l’adozione.

Dataset, importi e rapporti personali rimangono nella directory locale ignorata da Git. Non si effettuano nuovi accessi al database, benchmark dei motori o build del prodotto: si combinano previsioni già memorizzate. Nessun peso ulteriore viene cercato o ottimizzato.

## Verifiche

Quattro nuovi test portano a 14 i test sulle combinazioni: orientamento dei pesi, arrotondamenti dei quinti di centesimo, impegni condivisi, simmetria e input/overflow. È incluso il caso limite di arrotondamento su somme grandi, osservato prima della correzione e coperto da un test permanente.

Le 152 date e le 36 del replay sono verificate indipendentemente con Decimal in Python; MAE e RMSE sono ricalcolati dai residui. Previsioni e metriche del precedente confronto 75/25 e 25/75 restano identiche. Anche i risultati 60/40 e 40/60 rimangono identici dopo la correzione del caso limite numerico. Typecheck e lint sono superati.

Una prima riesecuzione completa ha avuto un timeout a 5 secondi in `BudgetsWidget.test.tsx`, non modificato da questo esperimento. Il test è passato ripetendolo con un solo worker, insieme ai 14 test delle combinazioni, senza cambiare soglie o sorgenti della dashboard. I log conservano entrambi gli esiti. Modifiche parallele a Insights presenti nel worktree non fanno parte di questo commit.

Nessun push, merge in main, release o deploy. Il modello attuale in produzione rimane invariato.

La riesecuzione completa finale con due worker è passata: 388 test superati e un live opzionale saltato, mantenendo il timeout originale.
