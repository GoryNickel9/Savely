# 💰 Spendy Cloud

> La tua finanza personale semplificata.

Web application completa per la gestione delle finanze personali: transazioni, budget, portafoglio di investimento, spese ricorrenti, statistiche e una serie di moduli specializzati (poker, fumo, FIRE, collezioni TCG e libreria, budget familiare). Costruita con **React + TypeScript + Vite** e backend su **Supabase**.

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
- [CI/CD e deploy](#cicd-e-deploy)
- [Contribuire](#contribuire)

---

## Panoramica

Spendy è un'applicazione multi-modulo orientata alla finanza personale. Ogni utente autenticato ha accesso a un set di funzionalità base (transazioni, budget, portfolio, grafici) e può ottenere accesso a moduli specializzati tramite un **sistema di permessi granulari** gestito a livello di profilo.

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

#### ⚙️ Impostazioni (`/settings`)
Gestione del proprio account e dei dati:
- **Informazioni Account**: modifica credenziali (email, password) con verifica della password attuale, logout.
- **Valuta Principale**: scelta della valuta di default per le nuove transazioni.
- **Import / Export Dati** (vedi sezione dedicata).
- **Gestione Categorie**: creazione/modifica/eliminazione di categorie personalizzate con icona (emoji) e colore.
- **Sezione Coppia** (se permesso `couple_expenses`): gestione dell'accoppiamento con il partner.
- **Mappature ISIN** (per portfolio): collegamento dei simboli agli ISIN per l'aggiornamento automatico dei prezzi.

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

#### 📊 Statistiche Deep Dive (permesso `statistics_deep_dive`)
Analisi statistica avanzata della spesa, oltre i grafici base:
- **Media**, **mediana** e **media winsorizzata** della spesa su finestre temporali estese (365 giorni per la media, 730 giorni per mediana e media winsorizzata), per cogliere trend reali al netto dei valori anomali.

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
- **Spese condivise**: una transazione può essere condivisa con il partner con uno **split percentuale** personalizzato; il partner vede l'importo, la valuta, la descrizione e la data, ma **mai la categoria personale** del creatore (per proteggerne la privacy).
- **Budget condiviso**: budget mensili per "categoria di coppia" (nome testuale condiviso, non legato ai category_id personali).
- **Suggerimento basato sui dati**: spesa mediana mensile condivisa calcolata sugli storici.
- **Audit log immutabile** di tutte le azioni sulla connessione (creazione, revoca, ecc.).

---

### ⚙️ Amministrazione

- **Admin Panel** (`/admin`, permesso `admin`): elenco di tutti gli utenti con i relativi permessi e assegnazione/modifica dei permessi (inclusi `admin`, `poker`, `fumo`, `fire`, `statistics_deep_dive`, `tcg`, `libreria`, `couple_expenses`).

---

## Architettura del progetto

```
spendy_cloud/
├── src/
│   ├── components/          # Componenti React
│   │   ├── dashboard/       #   widget dashboard
│   │   ├── fire/            #   calcolatori FIRE
│   │   ├── layout/          #   layout, sidebar, navigazione
│   │   ├── portfolio/       #   portfolio
│   │   ├── settings/        #   impostazioni e import
│   │   ├── statistics/      #   statistiche e grafici
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
│   │   └── ...              #   Dashboard, Transactions, Portfolio, ecc.
│   ├── types/               # tipi dominio (import)
│   ├── App.tsx              # router + route guards
│   ├── main.tsx             # entry point
│   └── index.css            # stili globali + Tailwind
├── supabase/
│   ├── functions/           # Edge Functions (Deno)
│   ├── migrations/          # migrazioni database PostgreSQL
│   └── config.toml          # configurazione progetto Supabase
├── .github/workflows/        # CI (GitHub Actions)
├── plans/                    # documentazione di sviluppo
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.ts
└── vercel.json               # SPA rewrites + security headers
```

### Route guard

L'app definisce guard di rotta che combinano autenticazione e permessi: `ProtectedRoute`, `AdminRoute`, `PokerRoute`, `FumoRoute`, `FireRoute`, `TcgRoute`, `LibreriaRoute`, `StatisticsDeepDiveRoute`, `CoupleRoute`.

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

   L'app sarà disponibile su `http://localhost:5173`.

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

Lo schema include (tra le altre) le tabelle: `profiles`, `transactions`, `categories`, `budgets`, `savings_goals`, `portfolio_assets`, `recurring_expenses`, `manual_price_updates`, tabelle Poker/Fumo, `tcg_cards`, `library_items`, `couple_connections`, `couple_connection_requests`, `shared_expenses`, `couple_budgets`, `couple_audit_log`, oltre a view e RLS policies. Lo schema è definito interamente tramite **migrazioni** in `supabase/migrations/`.

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
| `statistics_deep_dive` | Statistiche Deep Dive |
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
| **Supabase** | Auth, DB PostgreSQL, Realtime, Storage, Edge Functions |
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
| `search-tcg-cards` | Ricerca carte TCG |
| `delete-account` | Eliminazione account utente |

---

## Sicurezza

- **Content Security Policy** e security headers (X-Frame-Options, HSTS, Referrer-Policy, Permissions-Policy) configurati in `vercel.json`.
- **Row Level Security** di Supabase sul database.
- **Privacy nelle spese condivise**: le spese condivise di coppia espongono importo/valuta/descrizione ma **mai** il `category_id` personale del creatore (vedi `shared_expenses_view` e i commenti in `src/lib/types.ts`); esiste inoltre un audit log immutabile.
- **Validazione password** e controlli di sicurezza sugli import (`src/lib/passwordValidation.ts`, `src/lib/importFileSecurity.ts`, `src/lib/couple.security.test.ts`).
- Suite di **unit test** con Vitest su calcoli finanziari, parsing CSV, sicurezza coppia, validazione password e sicurezza degli import.

### Valute supportate
EUR, USD, GBP, CHF, JPY, CNY, IDR — con conversione automatica in EUR.

---

## CI/CD e deploy

### CI (GitHub Actions — `.github/workflows/ci.yml`)
Su push/PR su `main` vengono eseguiti 4 gate paralleli:

| Gate | Cosa verifica |
|------|---------------|
| **quality** | `npm run lint` + `npm run build` |
| **test** | `npm test` (Vitest) |
| **typecheck** | `npm run typecheck` |
| **security** | `npm audit --audit-level=high` |

> Un gate E2E (Playwright) è predisposto ma attualmente disabilitato.

### Deploy
L'app è pronta per il deploy su **Vercel**: `vercel.json` gestisce i rewrite SPA (tutto a `index.html`) e gli security headers.

---

## Contribuire

1. Fai un fork del repository
2. Crea un branch per la feature (`git checkout -b feature/nome-feature`)
3. Verifica localmente: `npm run lint && npm run typecheck && npm test && npm run build`
4. Commit (`git commit -m 'feat: descrizione'`)
5. Push e apri una Pull Request su `main`

Le PR devono passare tutti i gate della CI.

---

**Sviluppato con React, TypeScript, Vite e Supabase.**
