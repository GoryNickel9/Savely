# Candidato v11 — pesi 55/45 e 45/55

Confronto offline richiesto, con pesi nell’ordine attuale/ricampionamento settimanale. Nessuna registrazione nel motore o nell’API pubblicata.

## Metodo

Si aggiungono soltanto `(11*v1 + 9*v6)/20` e `(9*v1 + 11*v6)/20`, confrontati con attuale e 50/50. Si combinano esattamente le previsioni delle componenti già verificate per ogni data, senza estrarre nuovi percorsi o cambiare il seed del ricampionamento settimanale. Già speso e impegni noti sono contati una sola volta.

I totali delle componenti sono in centesimi interi. Numeratori e resti interi determinano l’unico arrotondamento finale, mantenendo il mezzo centesimo positivo verso l’alto. I controlli di input e overflow rimangono condivisi con i pesi precedenti. I metadati rappresentano entrambe le percentuali come frazioni del denominatore, evitando il rumore di `1−0,55` nella serializzazione.

Non si provano altri pesi, non si adattano pesi per mese/origine e non si costruiscono bande previsionali dalla media degli estremi di quelle dei componenti.

## Esecuzione

```sh
node scripts/evaluate-forecast-combination.mjs --twentieth-weights
```

Gli ingressi precedenti restano disponibili: nessuna opzione per 50/50, `--quarter-weights` per 75/25 e 25/75, `--fifth-weights` per 60/40 e 40/60. Gli SHA-256 del dataset e del rapporto delle componenti devono coincidere con quelli della prova precedente. Previsioni e metriche del 50/50 devono restare identiche in tutte le 152 date e nelle 36 del replay prudente.

Stessi 38 mesi e giorni 7/14/21/28. Il dettaglio 2026 contiene nove mesi e 36 origini. Si conserva il replay prudente con record creati/non modificati entro l’origine e pianificate già note. Importazioni, revisioni e cancellazioni non ricostruibili restano un limite. Dataset e rapporti personali rimangono nella directory locale ignorata da Git.

## Esito e limiti

Il 45/55 riduce di poco il MAE della ricostruzione principale rispetto al 50/50, peggiorando RMSE e sottostima. Il 55/45 contiene RMSE e sottostima ma ha MAE leggermente superiore. Il MAE del replay prudente differisce soltanto di uno o due centesimi rispetto al 50/50, senza valore pratico rispetto alla scala degli errori.

Non emerge un vantaggio sostanziale o uniforme rispetto al 50/50. Gli intervalli descrittivi delle differenze MAE, ricampionando nove mesi come blocchi, includono zero per tutte le combinazioni. Non sono corretti per confronti multipli. L’affinamento successivo sui medesimi mesi già osservati non costituisce un holdout indipendente: serve una verifica su dati nuovi prima di scegliere un peso per l’adozione.

## Verifiche

Quattro nuovi test portano a 18 quelli mirati sulle combinazioni: orientamento 55/45 e 45/55, arrotondamenti dei ventesimi di centesimo, impegni condivisi, simmetria, input e overflow. Tutti i 18 test passano. Typecheck del modulo e lint dei sorgenti/test modificati sono superati. Non si ripete la suite dell’intera app durante le modifiche parallele alle altre funzioni del worktree.

Tutte le combinazioni delle 152 date e delle 36 del replay sono verificate indipendentemente con Decimal in Python; MAE e RMSE sono ricalcolati sui residui, insieme ai metadati dei pesi. Dopo l’aggiunta dei nuovi pesi, previsioni e metriche dei precedenti confronti per quarti e quinti restano esattamente identiche.

Nessun nuovo accesso al database, benchmark dei motori o build del prodotto: si riusano le previsioni già memorizzate. Nessun push, merge in main, release o deploy. Le modifiche parallele ad altre funzioni non fanno parte del commit di questo esperimento.
