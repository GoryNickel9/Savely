# Candidato v6 — ricampionamento di settimane complete

Esperimento offline `weekly-block-bootstrap-v6`, senza attivazione o deploy. `weekday-history-v1` resta il modello predefinito del backend. Il confronto richiesto usa soltanto le date 7, 14, 21 e 28, ricalcolando anche il riferimento; il giorno 26 non entra nelle metriche.

## Metodo fissato prima della prova

Si conserva la contabilità comune: già speso, ricorrenze rilevate/configurate, movimenti pianificati e disponibilità dello storico. La componente sostituita è solo la previsione variabile residua.

1. Della finestra di 180 giorni si usano settimane lunedì–domenica interamente precedenti alla data di origine. I giorni a zero rimangono osservazioni; le settimane parziali vengono escluse.
2. Per ciascuna settimana futura di calendario si estrae uniformemente una settimana storica, con reinserimento. Tutte le categorie e i giorni del blocco condividono la stessa estrazione. La prima e l’ultima settimana futura possono usare soltanto alcuni giorni del blocco.
3. Per ogni percorso e giorno/categoria si calcola `max(0, spesa_campionata - pianificata_variabile)`. Si sommano gli importi residui fino a ciascuna data futura. Solo dopo si ricavano mediana e quantili: non si sommano mediane di giorni o categorie.
4. La previsione mensile è `già_speso + impegni_noti + mediana(residuo_totale)`. Si usano 4.096 percorsi, PRNG Mulberry32 e seed base `0x5a172026` combinato con la data. Nessuna ricerca di seed, numero di percorsi o ampiezza del blocco in funzione dei risultati.
5. Con meno di otto settimane complete si conserva v1. Le proiezioni sono deterministiche dato l’input, ma la distribuzione è un’approssimazione Monte Carlo dello schema empirico, non un calcolo esatto.

La media dei medesimi percorsi viene registrata come diagnostica prefissata. Il range 10°–90° percentile non è calibrato e non garantisce copertura all’80%.

## Valutazione

`node scripts/evaluate-weekly-bootstrap.mjs` legge soltanto lo snapshot autorizzato già presente in `.vercel/forecast-evaluation/private-dataset.json` e il riferimento `v5-comparison.json`. Richiede lo stesso SHA-256 del dataset e gli stessi mesi; tutti i dati personali e i rapporti restano ignorati da Git. Non accede a database o sessioni.

Il confronto per data del movimento esclude movimenti futuri e le configurazioni odierne delle ricorrenti. Le previsioni del riferimento sulle date comuni 7/14/21 devono coincidere esattamente con la precedente prova. Il controllo prudente usa invece timestamp di creazione/ultima modifica entro fine giornata a Roma e può includere pianificate future già note; quelle righe non entrano nello storico di addestramento. Le revisioni storiche perdute e le cancellazioni non vengono ricostruite.

Il MAE è il criterio primario; RMSE, bias, WAPE e risultati per origine/mese sono controlli secondari. I mesi sono già stati esaminati: nessuna porzione viene presentata come un test indipendente. Una diagnostica di ricampionamento dei mesi raggruppa le quattro origini, evitando di considerarle indipendenti.

## Esito

Il candidato riduce il MAE nella ricostruzione principale, ma peggiora RMSE e bias. Il miglioramento non si ripete nel controllo prudente. Le bande empiriche sono troppo strette rispetto alla copertura nominale. Nessuna adozione: gli importi e i risultati dettagliati sono nel rapporto privato locale, non in questo documento tracciato.

## Verifiche e benchmark

Otto nuovi test coprono ricampionamento congiunto, mediana dopo aggregazione, calendario/anno bisestile, assenza di dati futuri nei donatori, settimane parziali, riproducibilità, conservazione delle pianificate/ricorrenze, ripiego, quantili e overflow. Suite completa: 366 test passati e un live opzionale saltato. Typecheck, lint, runtime Node ESM e build completati; la build conserva l’avviso sulla dimensione dei chunk.

Benchmark sintetico comune forecast + Insights: 18.100 transazioni, tre riscaldamenti e dieci misure sequenziali per modello. Mediana v1 706,42 ms, massimo 818,83 ms; v6 765,32 ms, massimo 809,24 ms. Intel Core i3-10100F, 8 CPU logiche, 31,9 GiB RAM, Windows, Node 24.19.0, float64 con accumulo dei percorsi in centesimi interi, un thread. Nessuna rete/database nel benchmark; non è una misura di latenza in produzione né un confronto controllato su altri hardware.
