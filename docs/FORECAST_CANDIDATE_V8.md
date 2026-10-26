# Candidato v8 — combinazione puntuale 50/50

Esperimento locale `equal-current-weekly-v8`, non registrato nel motore o nell’API pubblicata. Il v1 in produzione resta invariato.

## Metodo fissato prima della prova

Si combina ogni previsione puntuale dell’attuale `weekday-history-v1` con quella del `weekly-block-bootstrap-v6`: `totale = round_centesimi((totale_v1 + totale_v6)/2)`. I componenti sono già in centesimi; l’arrotondamento finale porta il mezzo centesimo positivo verso l’alto. I pesi sono esattamente 0,5 e 0,5: nessuna ricerca di pesi per giorno, mese o risultato.

Già speso e impegni noti sono condivisi: la media dei due totali li conta una sola volta. È una combinazione di punti previsionali, non una nuova distribuzione e non la somma o la media di estremi di intervalli. Nessuna nuova banda d’incertezza viene attribuita al candidato.

Si riusano esattamente le previsioni v1/v6 precedentemente conservate. Il ricampionamento settimanale rimane quello con 4.096 percorsi, seed e specifica già fissati. Non si scelgono nuovi campioni per favorire la combinazione. Il dataset e il rapporto delle componenti sono identificati tramite SHA-256.

## Esecuzione e controlli

```sh
node scripts/evaluate-forecast-combination.mjs
```

Richiede gli artefatti locali ignorati `.vercel/forecast-evaluation/private-dataset.json` e `v6-comparison-7-14-21-28.json`. Non apre database o sessioni. Anche i rapporti di uscita rimangono nella directory ignorata; gli importi personali non sono inclusi nei file tracciati.

Sono gli stessi 38 mesi e le date 7/14/21/28. La parte principale 2026 comprende nove mesi e 36 origini. Il protocollo conserva sia la cronologia per data del movimento sia il replay prudente dei record creati/non modificati entro l’origine. Le metriche originali delle componenti devono coincidere integralmente prima di valutare la combinazione.

I controlli verificano cardinalità, date uniche, importi finiti, bound di già speso/impegni e totale compreso fra i componenti. Input non validi, centesimi frazionari e somme oltre la precisione intera sicura producono errori espliciti.

## Esito e limiti

Nel confronto principale e nel replay prudente la combinazione riduce MAE e RMSE rispetto all’attuale. Aumenta però la sottostima media e il vantaggio non si ripete in tutte le origini o tutti i mesi. I risultati dettagliati sono nel rapporto privato locale.

I mesi erano già stati usati nello sviluppo; non costituiscono un holdout indipendente. Il ricampionamento descrittivo dei nove mesi come blocchi produce un intervallo della differenza MAE che include zero. Le importazioni e le revisioni storiche non ricostruibili restano un limite. Non si ritoccano i pesi dopo la prova: serve una verifica su dati indipendenti prima dell’adozione.

Sei nuovi test, suite completa con 380 passati e un live opzionale saltato; typecheck e lint completati. Le 152 combinazioni e le 36 del replay sono verificate indipendentemente con Decimal in Python, insieme al ricalcolo di MAE e RMSE. Non si ripetono benchmark o build del prodotto: l’esperimento è una media di previsioni già disponibili e non modifica percorsi applicativi. Nessuna nuova misura di latenza in produzione è dichiarata.

Codice su branch locale, senza push, merge in main, release o deploy.
