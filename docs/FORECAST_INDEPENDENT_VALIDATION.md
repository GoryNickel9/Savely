# Verifica indipendente del candidato 50/50 — audit del 26 ottobre 2026

## Stato

L’audit dei dati è completato; la verifica indipendente delle prestazioni resta in attesa di un campione utilizzabile. Il candidato non viene dichiarato il migliore sulla base di questa attività. Nessuna pubblicazione.

La lettura live è limitata all’account già autorizzato, con una query SELECT che restituisce soltanto conteggi mensili e metadati. I mesi storici con disponibilità piena sono già stati usati per scegliere i modelli. I primi due mesi esclusi non offrono un confronto utile: sette origini non raggiungono lo storico minimo e nell’ottava il ricampionamento ripiega sul riferimento, rendendo il 50/50 identico a v1.

Ottobre è ancora aperto. Le righe future già registrate non sono consuntivi completi. Cambiare ripartizione o giorni sugli stessi mesi già esaminati non crea una verifica indipendente dalla precedente selezione.

## Artefatti congelati

`scripts/audit-forecast-independence.mjs` conserva una copia dei sorgenti dal commit selezionato, il lockfile, gli hash per file, un archivio ZIP e il protocollo. Le modifiche parallele del worktree sono escluse. I sorgenti git-show usano LF, l’archivio Git nativo CRLF: sono verificate sia le impronte individuali sia l’uguaglianza dei contenuti normalizzati.

Sono congelati otto modelli di base e sette combinazioni già provati. Il candidato primario resta 50/50, il riferimento è v1. Pesi, parametri e origini 7/14/21/28 non possono essere adattati dopo aver visto i risultati del nuovo campione. Il MAE è primario, RMSE e bias sono controlli secondari. La valutazione usa confronti appaiati, raggruppa l’incertezza per mese e considera i confronti multipli per una graduatoria fra tutti i rivali.

Il protocollo esistente non viene sovrascritto: un secondo avvio viene rifiutato. I file personali, i risultati e gli artefatti congelati rimangono nella directory ignorata `.vercel/forecast-evaluation/independent-validation-20261026`.

## Percorsi ancora possibili

- Account mai usato nella selezione, indicato e autorizzato dall’utente; scegliere i mesi per data e disponibilità prima di leggere gli importi.
- Stesso account, previsioni prospettiche registrate prima del consuntivo. Il 28 ottobre è un possibile pilota; novembre 2026 è il primo mese completo. Il protocollo principale prospettico mantiene nove mesi fino a luglio 2027, senza fermarsi o ritoccare i pesi in base ai risultati intermedi.

La scelta dell’account è in attesa della risposta dell’utente. Non vengono letti altri account e non è stata attivata una raccolta automatica o pianificazione.

## Controlli eseguiti

Audit live mensile in sola lettura; otto prove sulle origini iniziali con i sorgenti congelati; verifica indipendente Python degli hash, dell’archivio e della disponibilità; test del rifiuto di sovrascrittura del protocollo; controllo sintattico Node dello script. Non si riesegue la suite dell’app, poiché non cambiano algoritmi o percorsi applicativi e sono in corso modifiche parallele estranee a questo lavoro.

La sensibilità sui nove mesi già visti resta favorevole togliendo un mese alla volta. È esplicitamente etichettata come analisi interna, non come cross-validation o verifica indipendente. Nessun nuovo backtest viene presentato come confermativo.

Nessuna modifica ai dati, push, merge in main, release o deploy.

## Ricevuta del congelamento

Commit dei sorgenti: `0dc3cf41e168e7534e133a1ceffa7bb3fd8ea0f6`.

SHA-256 protocollo: `7cd8be5414815f4b3296bfea965584010e86099001a67d32bb2fb44d6fbdd271`.

SHA-256 archivio: `fd345038941899c8cb6ba398815005ea5511e44a23b1b1ae4983f70d7cab0b3f`.
