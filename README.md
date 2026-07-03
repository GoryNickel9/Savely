# 💰 Spendy Cloud

> La tua finanza personale semplificata.

Web application completa per la gestione delle finanze personali: transazioni, budget, portafoglio di investimento, spese ricorrenti, insights automatici, patrimonio storico, statistiche e una serie di moduli specializzati (poker, fumo, FIRE, collezioni TCG e libreria, budget familiare). Costruita con **React + TypeScript + Vite** e backend su **Supabase**.

---

## 📋 Indice

- [Panoramica](#panoramica)
- [Stack tecnologico](#stack-tecnologico)
- [Funzionalità](#funzionalità)
- [Architettura del progetto](#architettura-del-progetto)
- [Prerequisiti](#prerequisiti)
- [Installazione](#installazione)
- [Configurazione](#configurazione)
- [Script disponibili](#script-disponibili)
- [Sistema di permessi](#sistema-di-permessi)
- [Import / Export dati](#import--export-dati)
- [API e integrazioni esterne](#api-e-integrazioni-esterne)
- [Sicurezza](#sicurezza)
- [Testing](#testing)
- [CI/CD e deploy](#cicd-e-deploy)
- [Piani di sviluppo](#piani-di-sviluppo)
- [Contribuire](#contribuire)

---

## Panoramica

Spendy è un'applicazione multi-modulo orientata alla finanza personale. Ogni utente autenticato ha accesso a un set di funzionalità base (dashboard, transazioni, budget, portfolio, patrimonio, insights, grafici) e può ottenere accesso a moduli specializzati tramite un **sistema di permessi granulari** gestito a livello di profilo.

L'app è una **single-page application** con autenticazione Supabase, stato server-side gestito con TanStack Query, UI in Tailwind + shadcn/ui, grafici con Recharts e persistenza su database PostgreSQL (Supabase) con Row Level Security.

---

## Stack tecnologico

| Area | Tecnologia |
|------|------------|
| **UI framework** | React 18.3 |
| **Linguaggio** | TypeScript 5.8 (strict) |
| **Build tool / dev server** | Vite 8.1 |
| **Routing** | React Router 6.30 |
| **Stato server & cache** | TanStack Query 5.83 |
| **Styling** | Tailwind CSS 3.4 + shadcn/ui (Radix UI) |
| **Icone** | Lucide React |
| **Grafici** | Recharts 2.15 |
| **Backend / Auth / DB** | Supabase (`@supabase/supabase-js` 2.89) |
| **Form** | react-hook-form 7.61 + zod 3.25 |
| **Date** | date-fns 3.6 |
| **Parsing / export** | papaparse 5.5 (CSV) |
| **Testing** | Vitest 4.1 |
| **Lint** | ESLint 9 + typescript-eslint |

---

## Funzionalità

L'app è organizzata in **moduli**. Le sezioni base sono disponibili per ogni utente autenticato; i moduli specializzati richiedono un permesso specifico (vedi [Sistema di permessi](#sistema-di-permessi)).

### 🧩 Moduli base (tutti gli utenti autenticati)

#### 📊 Dashboard (`/`)
La pagina di benvenuto che riassume lo stato delle tue finanze in un colpo d'occhio:
- **Patrimonio Netto** — calcolato come cashflow totale (entrate − uscite di sempre) + P&L realizzato delle sole posizioni di investimento (escluse liquidità, immobili e "altro") + valore degli immobili scontato del 25% (per prudenza).
- **Statistiche del mese corrente** — entrate e uscite del mese in corso.
- **Statistiche dell'anno corrente** — entrate e uscite da inizio anno.
- **Performance Portfolio** — valore, P&L (assoluto e percentuale) delle posizioni aperte (solo strumenti di investimento).
- **Totale budget** impostato e le **ultime transazioni** inserite.

#### 💸 Transazioni (`/transactions`)
Il cuore della contabilità quotidiana:
- Inserimento, modifica (inline) ed eliminazione di entrate e uscite.
- **Multi-valuta**: ogni transazione può essere in EUR, USD, GBP, CHF, JPY, CNY o IDR; l'importo viene **convertito automaticamente in EUR** al tasso di cambio del giorno dell'operazione (API Frankfurter).
- **Categorizzazione**: ogni transazione è associata a una categoria personalizzata (con icona/colore).
- **Filtri avanzati**: per periodo (questo mese, mese scorso, semestre, quest'anno, anno scorso, range personalizzato), per categoria e per ricerca testuale;filtro "solo condivise" per chi usa il Budget Familiare.
- **Condivisione di coppia**: una transazione può essere marcata come spesa condivisa con il partner (con categoria di coppia e split percentuale) direttamente dal form di inserimento.

#### 🔁 Uscite Ricorrenti (`/recurring`)
Per gestire le spese che si ripetono nel tempo (affitto, abbonamenti, rate):
- Definizione di spese con **frequenza** (settimanale, mensile, trimestrale, annuale), importo, categoria e **prossima data di scadenza**.
- Per le frequenze settimanali si può impostare l'**intervallo** in settimane (es. ogni 2 settimane).
- Una **Edge Function cron** (`process-recurring-expenses`) genera automaticamente le transazioni quando arriva la scadenza.
- Possibilità di processare manualmente le scadenze in ritardo.
- **Suggerimenti rilevati**: l'app analizza lo storico delle transazioni e propone spese che sembrano ricorrenti (stessa descrizione normalizzata + cadenza regolare + importo consistente), con un bottone "Aggiungi" che precompila il form e "Ignora" per nasconderle (memorizzato localmente). Esclude già le ricorrenze tracciate.

#### 🐷 Budget (`/budget`)
Per pianificare e monitorare la spesa mensile:
- Impostazione di un **budget mensile per categoria**.
- **Suggerimento basato sui dati**: per ogni categoria viene mostrata la **spesa mensile mediana** calcolata sulle transazioni degli ultimi 730 giorni, come riferimento per impostare il budget.
- **Monitoraggio in tempo reale** dell'avanzamento con barre di progresso e indicatori visivi (sotto/sopra budget).
- Riepilogo dei totali: budget atteso totale vs. spesa effettiva (mediana globale) e differenza.

#### 📈 Portfolio (`/portfolio`)
Per tracciare i tuoi investimenti e il loro valore nel tempo:
- Gestione di asset per tipo: **azioni, ETF, crypto, obbligazioni, liquidità, immobili, altro**.
- Tracciamento del **P&L non realizzato** (posizioni aperte) e **P&L realizzato** (posizioni chiuse) in assoluto e percentuale.
- **Aggiornamento automatico dei prezzi** via Edge Function (`update-prices`), con limite anti-abuso sull'aggiornamento manuale (cooldown); storico prezzi per grafico di andamento.
- **Chiusura delle posizioni** con registrazione del prezzo di vendita e della data (calcolo del guadagno/perdita realizzata).
- Selezione rapida di strumenti già presenti, gestione liquidità multi-valuta.
- **Integrazione con la collezione TCG**: le carte TCG con un valore di mercato sono mostrate insieme agli asset finanziari nel riepilogo del portafoglio.
- Grafici: composizione del portafoglio (pie), andamento nel tempo (area/line).

#### 📊 Grafici (`/charts`)
Analisi visiva delle tue entrate e uscite, suddivisa in tre sezioni:
- **Analisi Entrate/Uscite** (`/charts/income-expense`): andamento **cumulativo del bilancio** nel tempo (area chart giorno-per-giorno), con filtri per anno, mese, "da una data" o range.
- **Analisi Uscite** (`/charts/expense`): distribuzione delle spese **per categoria** (pie/bar/line) e andamento mensile, con filtri temporali.
- **Analisi Entrate** (`/charts/income`): come sopra, ma sulle entrate.

Tutti i grafici supportano filtri temporali (tutto, anno, mese, da una data, tra due date) e l'aggregazione mensile.

#### 💰 Patrimonio (`/net-worth`)
Tracciamento storico del **Patrimonio Netto** nel tempo:
- **Storico giornaliero** popolato da uno snapshot notturno (cron pg_cron `snapshot-net-worth-daily`, alle 01:05 UTC) che ricalcola il patrimonio per ogni utente. Un backfill one-shot ha pre-popolato lo storico dal 2024-01-01.
- **Formula** (centralizzata in `src/lib/netWorth.ts` e replicata in SQL): cashflow (entrate − uscite di sempre) + P&L realizzato delle posizioni di investimento aperte (escluse liquidità, immobili e "altro") + valore degli immobili scontato del 25%.
- **Composizione** del patrimonio in card separate (cashflow, P&L investimenti, immobili scontati) e variazione % rispetto al primo punto del periodo visibile.
- La card "Patrimonio Netto" in Dashboard è cliccabile e porta a questa pagina.

#### 💡 Insights (`/insights`)
Segnali automatici generati dai tuoi dati finanziari, senza query aggiuntive (tutto derivato dai dati già in cache):
- **Anomalie di spesa** — categorie il cui mese corrente è ≥ 1.4× la mediana storica e ≥ 50€, con indicazione della % di scostamento.
- **Budget superato** — categorie in cui la spesa del mese supera il budget configurato.
- **Posizioni in perdita** — asset del portfolio con P&L non realizzato ≤ −15%.
- **Milestone patrimonio** — nuovo massimo storico di patrimonio netto.
- **Mese di risparmio** — mese corrente con risparmio ≥ 1.2× la media annua.
- **Trend crescente** — categorie la cui spesa degli ultimi 3 mesi è ≥ 1.25× la mediana a 12 mesi.
- **Nuove ricorrenze** — le migliori candidate a spesa ricorrente rilevate automaticamente (top 3).
- **Variazione prezzo ricorrenti** — aumento o ribasso ≥ 10% rispetto all'importo abituale di una spesa ricorrente (es. rincaro abbonamento).

Gli insight sono ordinati per severità (⚠️ attenzione → ✅ positivo → ℹ️ info) e filtrabili per tipo. La logica è pura e completamente testata in `src/lib/insights.ts` (`generateInsights`).

#### ⚙️ Impostazioni (`/settings`)
Gestione del proprio account e dei dati:
- **Informazioni Account**: modifica credenziali (email, password) con verifica della password attuale, logout.
- **Valuta Principale**: scelta della valuta di default per le nuove transazioni.
- **Import / Export Dati** (vedi sezione dedicata).
- **Gestione Categorie**: creazione/modifica/eliminazione di categorie personalizzate con icona (emoji) e colore.
- **Sezione Coppia** (se permesso `couple_expenses`): gestione dell'accoppiamento con il partner.
- **Mappature ISIN** (per portfolio): collegamento dei simboli agli ISIN per l'aggiornamento automatico dei prezzi.
- **Sicurezza**:
  - **Autenticazione a due fattori (2FA)** opt-in via TOTP (Google Authenticator, Authy, 1Password…). Enrollment con QR code + secret testuale, verifica, rimozione. Al login, se l'utente ha un fattore attivo viene richiesto il codice a 6 cifre (livello AAL2).
  - **Accessi recenti**: storico degli eventi di login/logout/recupero/verifica 2FA con dispositivo e browser riconosciuti (Parsing dello user-agent), e pulsante "Disconnetti altre sessioni".

---

### 🔐 Moduli specializzati (richiedono permesso)

#### 🎲 Poker (permesso `poker`)
Strumenti per chi gioca a poker e vuole tenere sotto controllo i costi e i traguardi:
- **Next Cut** (`/poker/next-cut`): calcola **quanto manca** per raggiungere il prossimo "cut" (livello di guadagno). Combina la spesa mensile totale — derivata automaticamente dalla mediana delle transazioni degli ultimi 730 giorni + le spese manuali poker — con il **deal** (guadagno per mano/sessione) e il **profit/loss** accumulato, per indicare quanto ancora devi guadagnare.
- **Guadagno Orario** (`/poker/hourly-earnings`): traccia il tuo guadagno per ora di gioco.
- **Rakeback** (`/poker/rakeback`): monitoraggio del rakeback ricevuto nel tempo.
- **Spese Manuali** (`/poker/manual-expenses`): registrazione di spese correlate al poker (es. buy-in, travel) con distinzione spese obbligatorie/facoltative; questi importi confluiscono nel calcolo del Next Cut.

#### 🚬 Fumo (permesso `fumo`)
Tracciamento dei costi del fumo e prodotti correlati, suddiviso in tre aree:
- **Liquido Sigaretta** (`/fumo/liquido-sigaretta`): spese per liquidi e sigarette elettroniche, con statistiche di consumo e costi derivati.
- **CBD** (`/fumo/cbd`): monitoraggio di prodotti a base di CBD.
- **THC** (`/fumo/thc`): monitoraggio di prodotti a base di THC.
Ogni area registra gli acquisti e calcola statistiche e costi derivati (es. costo medio, spesa periodica).

#### 🔥 FIRE (permesso `fire`)
Calcolatori per la pianificazione dell'indipendenza finanziaria (Financial Independence, Retire Early):
- **Standard FIRE** (`/fire/standard`): calcola il **FIRE number** classico (patrimonio necessario = spese annuali / withdrawal rate) e **quanti anni mancano** al raggiungimento. Parametri: età attuale e desiderata di pensionamento, risparmi attuali, contributo annuo, rendimento atteso, inflazione, withdrawal rate, spese e reddito annuo. Mostra una proiezione grafica della crescita del portafoglio e una barra di avanzamento verso il FIRE.
- **Barista FIRE** (`/fire/barista`): variante in cui un **reddito part-time** copre parte delle spese, riducendo il patrimonio necessario. Calcola il "Barista number" (più basso del FIRE number), la riduzione in valore e percentuale, e gli anni per raggiungerlo.
- Entrambi i calcolatori offrono valori di default derivati dai tuoi dati (spese medie, patrimonio) e si possono resettare.

#### 🃏 TCG (permesso `tcg`)
Gestione della collezione di carte da gioco, con valore di mercato:
- Sotto-sezioni dedicate per **Magic: The Gathering**, **Pokémon TCG** e **Yu-Gi-Oh!** (`/tcg/magic`, `/tcg/pokemon`, `/tcg/yugioh`).
- Per ogni carta: nome, set/espansione, numero collezione, **condizione** (Near Mint → Damaged), lingua (EN, IT, JP, DE, FR, ES, PT, KOR, ZHS), quantità, prezzo d'acquisto, prezzo corrente, data, immagine e note.
- **Ricerca via API CardTrader**: cerca carte reali con prezzo di mercato (CT Zero) e aggiungile alla collezione in pochi click.
- **Dashboard collezione**: valore totale (attuale vs costo), P&L assoluto e percentuale, numero di pezzi; pie chart per gioco.
- **Aggiornamento automatico dei prezzi** via Edge Function (`update-tcg-prices`).
- Le carte con valore di mercato **confluiscono nel Portfolio** finanziario.

#### 📚 Libreria (permesso `libreria`)
Catalogo della propria collezione libreria, con valutazione:
- Sotto-sezioni per **Libri**, **Fumetti** e **Manga** (`/libreria/libri`, `/libreria/fumetti`, `/libreria/manga`).
- Per ogni voce: titolo, autore, editore, anno, **copertina**, prezzo d'acquisto, **valore di rivendita**, quantità e note.
- **Ricerca via API**: Google Books per i libri (con recupero cover), Jikan/MyAnimeList per i manga (tramite Edge Function `mangaworld-proxy`).
- **Dashboard collezione**: costo totale, valore di rivendita totale, P&L, numero di pezzi; statistiche per categoria.

#### 💞 Budget Familiare (permesso `couple_expenses`)
Per gestire le finanze condivise con un partner:
- **Accoppiamento**: sistema di invito/accettazione (richiesta → connessione) tra due utenti.
- **Spese condivise**: una transazione può essere condivisa con il partner con **due modalità di divisione**: 50/50 (predefinito) oppure **importi personalizzati** (quota tua / quota partner esplicite); il partner vede l'importo, la valuta, la descrizione e la data, ma **mai la categoria personale** del creatore (per proteggerne la privacy).
- **Budget condiviso**: budget mensili per "categoria di coppia" (nome testuale condiviso, non legato ai category_id personali).
- **Suggerimento basato sui dati**: spesa mediana mensile condivisa calcolata sugli storici.
- **Audit log immutabile** di tutte le azioni sulla connessione (creazione, revoca, ecc.).

---

### ⚙️ Amministrazione

- **Admin Panel** (`/admin`, permesso `admin`): elenco di tutti gli utenti con i relativi permessi e assegnazione/modifica dei permessi (inclusi `admin`, `poker`, `fumo`, `fire`, `tcg`, `libreria`, `couple_expenses`).

---

## Architettura del progetto

```
spendy_cloud/
├── src/
│   ├── components/          # Componenti React
│   │   ├── dashboard/       #   widget dashboard (StatCard)
│   │   ├── fire/            #   calcolatori FIRE (input, chart, UI)
│   │   ├── layout/          #   layout, sidebar, navigazione
│   │   ├── legal/           #   layout pagine legali
│   │   ├── portfolio/       #   dialog chiusura posizione
│   │   ├── settings/        #   impostazioni, import, sicurezza, coppia, ISIN
│   │   ├── statistics/      #   statistiche e budget indicator
│   │   └── ui/              #   componenti shadcn/ui (Radix)
│   ├── hooks/               # Custom hooks (dati, auth, permessi, ecc.)
│   ├── integrations/
│   │   └── supabase/        # client Supabase + tipi generati
│   ├── lib/                 # utility, tipi, costanti, calcoli, security
│   │   ├── fire/            #   logica calcoli FIRE
│   │   └── statistics/      #   logica statistica
│   ├── pages/               # pagine/route dell'app
│   │   ├── fire/            #   Standard/Barista FIRE
│   │   ├── tcg/             #   Magic / Pokémon / Yu-Gi-Oh
│   │   ├── libreria/        #   Libri / Fumetti / Manga
│   │   └── ...              #   Dashboard, Transactions, Insights, Portfolio, NetWorth, ecc.
│   ├── App.tsx              # router + route guards
│   ├── main.tsx             # entry point
│   └── index.css            # stili globali + Tailwind
├── e2e/                     # test end-to-end (Playwright)
├── supabase/
│   ├── functions/           # Edge Functions (Deno)
│   ├── migrations/          # migrazioni database PostgreSQL
│   └── config.toml          # configurazione progetto Supabase
├── .github/workflows/        # CI (GitHub Actions)
├── plans/                    # documentazione di sviluppo e audit
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── playwright.config.ts      # configurazione E2E
└── vercel.json               # SPA rewrites + security headers
```

### Route guard

L'app definisce guard di rotta che combinano autenticazione e permessi: `ProtectedRoute`, `AdminRoute`, `PokerRoute`, `FumoRoute`, `FireRoute`, `TcgRoute`, `LibreriaRoute`, `CoupleRoute`. Il modulo Insights e le altre pagine base (Dashboard, Transazioni, Uscite Ricorrenti, Budget, Portfolio, Patrimonio, Grafici, Impostazioni) sono protette dalla sola `ProtectedRoute`.

---

## Prerequisiti

- **Node.js 22** (vedi CI in `.github/workflows/ci.yml`)
- **npm**
- Un account / progetto **Supabase**

---

## Installazione

1. **Clona il repository**

   ```bash
   git clone https://github.com/GoryNickel/spendy_cloud.git
   cd spendy_cloud
   ```

2. **Installa le dipendenze**

   ```bash
   npm install
   ```

3. **Configura le variabili d'ambiente** (vedi [Configurazione](#configurazione))

4. **Applica le migrazioni del database**

   ```bash
   supabase db push
   ```

5. **Avvia il dev server**

   ```bash
   npm run dev
   ```

   L'app sarà disponibile su `http://localhost:8080`.

---

## Configurazione

### Variabili d'ambiente

Crea un file `.env.local` (gitignored) nella root del progetto:

```env
VITE_SUPABASE_URL=<url del progetto Supabase>
VITE_SUPABASE_ANON_KEY=<chiave anon di Supabase>
```

| Variabile | Descrizione | Obbligatoria |
|-----------|-------------|:------------:|
| `VITE_SUPABASE_URL` | URL del progetto Supabase | ✅ |
| `VITE_SUPABASE_ANON_KEY` | Chiave anon (public) di Supabase | ✅ |

Le Edge Functions leggono invece secret lato server (es. `ALLOWED_ORIGIN`, chiavi API di CardTrader, ecc.) configurati nel dashboard Supabase.

### Database

Lo schema include (tra le altre) le tabelle: `profiles`, `transactions`, `categories`, `budgets`, `savings_goals`, `portfolio_assets`, `recurring_expenses`, `manual_price_updates`, `net_worth_snapshots`, `login_activity`, tabelle Poker/Fumo, `tcg_cards`, `library_items`, `couple_connections`, `couple_connection_requests`, `shared_expenses` (con `split_mode` e `partner_amount`), `couple_budgets`, `couple_audit_log`, oltre a view (inclusa `shared_expenses_view` con quote calcolate) e RLS policies. Lo schema è definito interamente tramite **migrazioni** in `supabase/migrations/`.

---

## Script disponibili

```bash
npm run dev          # avvia il dev server Vite
npm run build        # build di produzione
npm run build:dev    # build in modalità development
npm run preview      # anteprima del build di produzione
npm run lint         # ESLint
npm run typecheck    # controllo tipi TypeScript (tsc --noEmit)
npm run test         # unit test (Vitest)
npm run test:watch   # test in watch mode
npm run e2e          # test end-to-end (Playwright)
npm run e2e:ui       # test E2E in modalità interattiva
```

---

## Sistema di permessi

I permessi sono memorizzati come oggetto JSON nella tabella `profiles` e controllano la visibilità di moduli e rotte. Sono assegnabili solo da un amministratore tramite l'Admin Panel.

| Permesso | Modulo abilitato |
|----------|------------------|
| `admin` | Admin Panel + tutti i moduli |
| `poker` | Poker (Next Cut, Guadagno Orario, Rakeback, Spese) |
| `fumo` | Fumo (Liquido Sigaretta, CBD, THC) |
| `fire` | FIRE (Standard, Barista) |
| `tcg` | TCG (Magic, Pokémon, Yu-Gi-Oh) |
| `libreria` | Libreria (Libri, Fumetti, Manga) |
| `couple_expenses` | Budget Familiare (spese/budget condivisi) |

La logica lato client vive in `src/lib/permissions.ts` e `src/hooks/usePermissions.ts`, con cache in-memory (TTL 5 min).

---

## Import / Export dati

### Formati supportati
- **CSV** (papaparse)
- **XLSX**

### Importazione
- **Manuale** — file Excel/CSV con fogli `Transazioni`, `Categorie`, `Obiettivi`, `Portfolio`, `Investimenti`.
- **Da piattaforme esterne** — Revolut, BBVA, TradeRepublic, Spendy (legacy).

> I file importati passano per controlli di sicurezza (vedi `src/lib/importFileSecurity.ts`).

### Esportazione
Esporta tutti i dati in un unico file Excel con i fogli Transazioni, Categorie, Budget, Obiettivi, Portfolio.

---

## API e integrazioni esterne

| Servizio | Uso |
|----------|-----|
| **Supabase** | Auth (incluso MFA TOTP), DB PostgreSQL, Realtime, Storage, Edge Functions, pg_cron |
| **Frankfurter API** | Tassi di cambio per la conversione multi-valuta in EUR |
| **CardTrader API** | Prezzi e ricerca carte per il modulo TCG (tramite proxy Edge Function) |
| **Jikan v4 (MyAnimeList)** | Ricerca manga per il modulo Libreria (tramite Edge Function `mangaworld-proxy`) |
| **Google Books API** | Ricerca libri / cover per il modulo Libreria |
| **Google Fonts** | Font |

### Edge Functions (Deno, `supabase/functions/`)

| Funzione | Descrizione |
|----------|-------------|
| `update-prices` | Aggiornamento automatico prezzi portfolio (cron) |
| `update-tcg-prices` | Aggiornamento prezzi carte TCG (cron) |
| `process-recurring-expenses` | Genera transazioni dalle spese ricorrenti (cron) |
| `cardtrader-proxy` | Proxy verso l'API CardTrader |
| `mangaworld-proxy` | Ricerca manga via Jikan/MAL |
| `delete-account` | Eliminazione account utente |

---

## Sicurezza

- **Content Security Policy** e security headers (X-Frame-Options, HSTS, Referrer-Policy, Permissions-Policy) configurati in `vercel.json`.
- **Row Level Security** di Supabase sul database.
- **Autenticazione a due fattori (TOTP)** opt-in: enrollment/verifica/rimozione tramite l'API MFA nativa di Supabase; la tabella `login_activity` (RLS per-user, append-only) traccia gli eventi di accesso.
- **Privacy nelle spese condivise**: le spese condivise di coppia espongono importo/valuta/descrizione ma **mai** il `category_id` personale del creatore (vedi `shared_expenses_view` e i commenti in `src/lib/types.ts`); esiste inoltre un audit log immutabile. La coerenza dello split personalizzato è validata da un trigger SECURITY DEFINER.
- **Validazione password** e controlli di sicurezza sugli import (`src/lib/passwordValidation.ts`, `src/lib/importFileSecurity.ts`, `src/lib/couple.security.test.ts`).
- Suite di **unit test** con Vitest su calcoli finanziari, parsing CSV, sicurezza coppia, validazione password, MFA, user-agent parsing e sicurezza degli import.

### Valute supportate
EUR, USD, GBP, CHF, JPY, CNY, IDR — con conversione automatica in EUR.

---

## Testing

Il progetto ha due livelli di test.

### Unit test (Vitest)
Funzioni pure in `src/lib/*.test.ts`: calcoli finanziari (FIRE, net worth, statistiche), insights/anomaly detection, parsing CSV, sicurezza coppia, validazione password e MFA, parsing user-agent, detection ricorrenze, sicurezza degli import.

```bash
npm test          # run singolo
npm run test:watch
```

### E2E (Playwright)
Test end-to-end che guidano l'app reale in browser Chromium. Sono divisi in due progetti:
- **public** (`*.public.spec.ts`): rotte pubbliche (`/auth`, `/privacy`, `/cookies`, `/terms`, NotFound, redirect guard) — non richiedono auth.
- **authenticated** (`*.auth.spec.ts`): login, CRUD transazioni, route guard sui permessi, FIRE — richiedono credenziali.

I test autenticati si collegano al progetto Supabase reale usando un **utente seedato dedicato** (`e2e-spendy@example.com`, senza permessi di modulo). Le credenziali vengono fornite via variabili d'ambiente:

| Variabile | Descrizione |
|-----------|-------------|
| `E2E_USER_EMAIL` | Email dell'utente E2E seedato |
| `E2E_USER_PASSWORD` | Password dell'utente E2E seedato |

Se le variabili non sono impostate, i test autenticati vengono saltati (gli pubblici girano comunque). L'utente va creato una sola volta via Admin API (vedi `e2e/seed.sql` per la documentazione).

```bash
# Setup locale
export E2E_USER_EMAIL=e2e-spendy@example.com
export E2E_USER_PASSWORD=<password>
npm run e2e            # run headless
npm run e2e:ui         # modalità interattiva con UI
```

In CI i segreti sono configurati come GitHub secrets e il gate E2E gira ad ogni push/PR su `main`.

---

## CI/CD e deploy

### CI (GitHub Actions — `.github/workflows/ci.yml`)
Su push/PR su `main` vengono eseguiti 5 gate paralleli:

| Gate | Cosa verifica |
|------|---------------|
| **quality** | `npm run lint` + `npm run build` |
| **test** | `npm test` (Vitest) |
| **typecheck** | `npm run typecheck` |
| **security** | `npm audit --audit-level=high` |
| **e2e** | `npm run e2e` (Playwright) — richiede i secrets `E2E_USER_EMAIL` / `E2E_USER_PASSWORD`; genera un report caricato come artifact |

### Deploy
L'app è pronta per il deploy su **Vercel**: `vercel.json` gestisce i rewrite SPA (tutto a `index.html`) e gli security headers.

---

## Piani di sviluppo

La cartella `plans/` contiene documenti di sviluppo, audit e revisioni (es. audit sicurezza, revisioni di codice). Non sono artefatti finali ma traccia delle decisioni prese durante il ciclo di sviluppo.

---

## Contribuire

1. Fai un fork del repository
2. Crea un branch per la feature (`git checkout -b feature/nome-feature`)
3. Verifica localmente: `npm run lint && npm run typecheck && npm test && npm run build` (e `npm run e2e` se tocchi flussi critici)
4. Commit (`git commit -m 'feat: descrizione'`)
5. Push e apri una Pull Request su `main`

Le PR devono passare tutti i gate della CI.

---

**Sviluppato con React, TypeScript, Vite e Supabase.**
