# Saldo completo e barre budget

## Calcolo del saldo

`public.get_transaction_balance(p_date, p_previous_date)` restituisce una sola riga con il saldo cumulato alle due date, estremi inclusi. La Dashboard usa il primo importo per la card e il secondo per il confronto con il periodo precedente.

Per ogni movimento attivo dell'utente autenticato, il contributo è `amount * exchange_rate_eur`, positivo per le entrate e negativo per le uscite. Il database somma in `NUMERIC` e arrotonda il risultato finale ai centesimi. Esclude i movimenti con `deleted_at` valorizzato e quelli successivi alla data richiesta. Non aggiunge il valore del portafoglio: il saldo rappresenta il flusso di cassa registrato.

La funzione usa `SECURITY INVOKER`, rispetta la RLS e filtra esplicitamente su `auth.uid()`. Non accetta un ID utente dal client. L'esecuzione è concessa al ruolo `authenticated` e revocata ad `anon` e `PUBLIC`. Date nulle producono un errore.

`useTransactionBalance` usa una chiave di cache con prefisso `transactions`, utente e date. Le invalidazioni del CRUD, degli import Revolut e degli import bancari ricaricano anche il saldo. Un risultato assente o non finito produce un errore; la card mostra un trattino durante il caricamento e un messaggio in caso di errore.

## Storico usato dagli altri moduli

`useTransactions` carica tutte le pagine prima di pubblicare il risultato. Richiede un conteggio esatto e ordina per data decrescente, poi per ID decrescente, per distinguere i movimenti dello stesso giorno. Continua anche se il server restituisce meno delle 1.000 righe richieste per pagina.

Un errore, una pagina vuota prima della fine, un conteggio cambiato o un ID duplicato interrompono il caricamento: un risultato parziale non viene salvato come storico completo. La cancellazione della query interrompe le richieste tramite `AbortSignal`.

Patrimonio, Budget, grafici, insights e gli altri consumer mantengono la stessa API del hook e ricevono lo storico completo. La Dashboard continua a caricare questi movimenti per le altre viste; la card Saldo totale usa il risultato SQL indipendente.

## Barre budget

Dashboard e pagina Budget condividono `BudgetProgress`:

| Percentuale reale | Colore |
|---|---|
| Meno del 75% | Verde, token `success` |
| Dal 75% a meno del 100% | Giallo, token `warning` |
| Dal 100% | Rosso, token `destructive` |

Il componente `Progress` limita la larghezza fra zero e il massimo dichiarato, che vale 100 per impostazione predefinita. Passa il valore normalizzato anche al componente accessibile Radix. Il widget conserva la percentuale reale nel testo, con al massimo due decimali: 250% produce una barra piena rossa.

## Verifica

I test Vitest coprono soglie, passaggio da zero a 250%, valori non finiti, massimo personalizzato, caricamento di 1.221 movimenti, errori nelle pagine successive, date della query e invalidazione del saldo.

Prima del frontend, applicare la migrazione:

```powershell
supabase db push --linked --dry-run
supabase db push --linked
```

Controllare che il dry run includa soltanto le migrazioni attese. Il test SQL usa due utenti temporanei e oltre 1.000 movimenti, verifica RLS, conversione, date, modifiche retroattive, spostamento fra mesi, cancellazione e isolamento degli utenti:

```powershell
supabase db query --linked --file supabase/tests/transaction_balance.sql
```

Il file apre una transazione e termina con `ROLLBACK`. Se le registrazioni sono disabilitate, le abilita soltanto nella propria transazione per creare le fixture; l'impostazione originaria resta invariata dopo il rollback. La verifica della cancellazione logica usa il ruolo della connessione di test perché la RLS ne impedisce l'impostazione diretta al client.

## Limiti

La somma SQL legge i movimenti necessari a ogni richiesta. Non vengono mantenuti saldi mensili concatenati: le modifiche retroattive si riflettono nel risultato senza aggiornamenti a catena. Se il volume richiederà un'ottimizzazione misurabile, si potranno mantenere entrate e uscite aggregate per mese.

Il caricamento paginato dello storico trasferisce tutti i movimenti e richiede memoria proporzionale al loro numero. Le pagine non appartengono a un'unica snapshot SQL: una modifica concorrente può richiedere un nuovo caricamento; i controlli su conteggio e duplicati intercettano alcuni casi, senza garantire una snapshot atomica. La query del saldo usa invece una singola snapshot del database.
