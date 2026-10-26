# Raccolta prospettica della previsione — attivata il 26 ottobre 2026

## Scelta e calendario

L’utente ha scelto lo stesso account e mesi futuri. La raccolta è attiva come heartbeat collegato alla chat, con fuso Europe/Rome. Non pubblica un nuovo algoritmo e non cambia le applicazioni.

- Pilota: 28 ottobre 2026 alle 23:45. È escluso dalle metriche principali.
- Periodo principale: novembre 2026–luglio 2027, con date 7, 14, 21 e 28 alle 23:45: 36 origini.
- Finestra valida: 23:45–23:59 nella data di origine. Sono registrati l’orario effettivo dello snapshot e il runtime utilizzato.
- Consuntivo primario: acquisizione e blocco il 7 del mese successivo, nella stessa finestra, lasciando sette giorni alle registrazioni tardive. Primo report pilota il 7 novembre; primo mese completo (novembre) valutabile il 7 dicembre.
- Ultimo passaggio: 7 agosto 2027, con il consuntivo di luglio e un controllo separato di sensibilità alle revisioni dei mesi precedenti.

I risultati intermedi sono provvisori. Non si cambiano pesi, modelli, durata o criteri dopo averli letti.

## Collocazione e modelli

La cartella canonica privata è `$CODEX_HOME/private-data/savely-forecast-validation-20261026`, fuori dal repository e dai file di build. Contiene protocollo originale, sorgenti e JavaScript compilato congelati, ricevute SHA-256, iscrizione dell’account e collector. I file di acquisizione rimangono locali; non vengono inclusi nei commit.

Il protocollo originale non viene modificato. `ENROLLMENT.json` registra la scelta dell’utente; `SCHEDULE.json` registra la pianificazione attiva. Gli hash dei sorgenti, del runtime e del collector vengono verificati prima della raccolta. Si usa codice congelato, senza dipendere dal branch attivo o dal motore in corso di modifica nella web app. Il riferimento v1 è quello congelato al momento della selezione, non un bersaglio aggiornato durante il test.

Sono eseguiti gli otto modelli e le sette combinazioni già registrati. Il 50/50 resta il candidato primario; nessun algoritmo viene attivato automaticamente dopo il confronto.

## Integrità e dati mancanti

Il database viene letto con SELECT limitate all’ID e all’email iscritti. Tutte le collezioni del risultato verificano il proprietario. Non si modificano dati o migrazioni. I salvataggi primari usano creazione atomica senza sovrascrittura: retry e doppie esecuzioni non rimpiazzano snapshot o previsioni precedenti.

Uno snapshot perso nella finestra viene registrato come mancante. Non viene ricostruito con dati successivi. Se lo snapshot era già stato salvato in tempo, un risultato interrotto può essere ricalcolato soltanto da quello snapshot e con lo stesso codice congelato; il recupero rimane esplicito. La stessa regola vale per i consuntivi.

I consuntivi del settimo giorno rimangono immutabili. Il confronto finale con i dati revisionati è una sensibilità separata, non una sostituzione dei consuntivi primari. Dati mancanti, modelli indisponibili, sottostima e incertezza restano visibili nei rapporti.

## Esecuzione e resoconti

Il collector nella cartella canonica viene avviato con `node collect-prospective-forecasts.mjs --run`. `--dry-run` verifica stato e sorgenti senza leggere il database; `--check-db` controlla l’accesso all’account senza registrare una previsione valida.

Le acquisizioni ordinarie senza nuovi consuntivi non producono resoconti ripetitivi. Nuovi consuntivi, errori, dati indisponibili e date perse richiedono un aggiornamento. Il rapporto cumulativo si trova in `prospective/REPORT.json`. Le metriche principali escludono il pilota e mostrano le origini mancanti. La classifica puntuale non viene presentata da sola come prova di superiorità: al termine si confrontano differenze appaiate per mese, bootstrap mensile con 20.000 estrazioni e seed 20261026, considerando i 14 confronti con i rivali e i limiti di nove blocchi mensili.

Il computer deve rimanere acceso, l’app deve essere in esecuzione e il progetto con l’accesso Supabase deve restare disponibile. La raccolta locale non è una garanzia di esecuzione mentre il computer è spento o sospeso. [OpenAI Docs: attività programmate](https://learn.chatgpt.com/docs/automations?surface=app).

## Verifiche di attivazione

Tredici test Node passati: calendario/DST, finestre valide, proprietario, scrittura atomica, retry, dati mancanti, isolamento del pilota, recupero senza dati successivi e funzionamento dei quindici modelli congelati su dati sintetici. Runtime compilato con TypeScript strict e verificato tramite hash. Accesso live in sola lettura all’account verificato; nessuna previsione del 26 ottobre viene conteggiata nel test prospettico.

Heartbeat `verifica-prospettica-savely-50-50` verificato attivo e collegato a questa chat. Calendario salvato e offset locali inverno/estate verificati. Il collector durevole passa il dry-run. Le modifiche parallele alla web app non sono incluse in questo lavoro. Nessun push, deploy, release o modifica al modello in produzione.
