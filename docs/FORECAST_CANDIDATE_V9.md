# Candidato v9 — pesi 75/25 e 25/75

Confronto locale richiesto dopo la prova 50/50. Tutti i pesi sono nell’ordine attuale/ricampionamento settimanale. Nessuna registrazione nel motore o nell’API, nessuna pubblicazione.

## Metodo

Si aggiungono soltanto i pesi richiesti: `(3*v1 + v6)/4` e `(v1 + 3*v6)/4`. Restano il riferimento v1 e la combinazione 50/50. I totali delle componenti sono già arrotondati ai centesimi: il numeratore usa centesimi interi, il denominatore è 4 e si arrotonda il risultato una sola volta. Si conserva il mezzo centesimo positivo verso l’alto. Per il 50/50 si riduce 2/4 a 1/2, conservando anche il precedente limite di precisione.

Non si adattano pesi per mese o origine e non si prova una griglia ulteriore. Il confronto fra questi pesi è comunque una selezione successiva su mesi già osservati: non è un holdout indipendente e non certifica il peso che ottiene il MAE minimo.

## Esecuzione

```sh
node scripts/evaluate-forecast-combination.mjs --quarter-weights
```

L’ingresso senza opzione conserva il confronto 50/50. Lo snapshot e il rapporto v6 devono avere gli stessi SHA-256 della precedente prova; si richiede anche il rapporto v8 originale. Tutte le previsioni 50/50 e le relative metriche devono rimanere identiche. Si usano esattamente gli stessi 38 mesi e i giorni 7/14/21/28; la parte 2026 contiene nove mesi e 36 origini.

Si riusano le previsioni delle componenti già verificate, senza nuovi campioni, seed o accessi al database. Dataset, importi e rapporti rimangono nella directory locale ignorata da Git. Gli impegni noti e il già speso non vengono duplicati. Non si costruiscono intervalli previsionali dalla media degli estremi delle bande.

## Esito e limiti

Il 25/75 ha il MAE minimo della ricostruzione principale fra queste quattro alternative, ma peggiora RMSE e sottostima rispetto al 50/50. Il 75/25 ha RMSE inferiore e contiene la sottostima, ma perde sul MAE. Nel replay prudente il 50/50 conserva il MAE minimo. Non emerge quindi un peso uniformemente migliore.

Gli intervalli descrittivi delle differenze MAE ricampionando nove mesi come blocchi includono zero per tutte le combinazioni. Non sono corretti per confronti multipli e non costituiscono una verifica confermativa. Il limite delle importazioni, revisioni e cancellazioni storiche non ricostruibili resta invariato. Serve una verifica su dati indipendenti prima di scegliere un peso per l’adozione.

## Verifiche

Quattro nuovi test, più i sei precedenti sulle combinazioni: orientamento dei pesi, arrotondamenti dei quarti di centesimo, impegni condivisi, compatibilità del 50/50 e rifiuto di pesi/valori non sicuri. Suite completa: 384 test passati, un live opzionale saltato. Typecheck e lint completati.

Tutte le combinazioni delle 152 date e delle 36 del replay sono verificate con Decimal in Python; MAE e RMSE sono ricalcolati indipendentemente sui residui. V1, v6 e 50/50 mantengono esattamente i valori precedenti. Non si ripetono benchmark o build del prodotto: il cambiamento riguarda esclusivamente il calcolo offline dei pesi richiesti.

Nessun push, merge in main, release o deploy. Il modello attuale in produzione rimane invariato.
