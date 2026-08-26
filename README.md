# 💰 Savely Cloud

> La tua finanza personale semplificata.

Web application completa per la gestione delle finanze personali: transazioni, budget, portafoglio di investimento, spese ricorrenti, insights automatici, patrimonio storico, statistiche e una serie di moduli specializzati (poker, fumo, FIRE, collezioni TCG e libreria, budget familiare). Costruita con **React + TypeScript + Vite** e backend su **Supabase**. Interfaccia localizzata in **italiano e inglese**, esperienze desktop e mobile-first con **navigazione bottom** e installabile come **PWA**.

---

## 📋 Indice

- [Panoramica](#panoramica)
- [Stack tecnologico](#stack-tecnologico)
- [Funzionalità](#funzionalità)
- [Internazionalizzazione (i18n)](#internazionalizzazione-i18n)
- [Mobile e PWA](#mobile-e-pwa)
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

Savely è un'applicazione multi-modulo orientata alla finanza personale. Ogni utente autenticato ha accesso a un set di funzionalità base (dashboard, transazioni, budget, portfolio, patrimonio, insights, grafici) e può ottenere accesso a moduli specializzati tramite un **sistema di permessi granulari** gestito a livello di profilo.

L'app è una **single-page application** con autenticazione Supabase, stato server-side gestito con TanStack Query, UI in Tailwind + shadcn/ui, grafici con Recharts e persistenza su database PostgreSQL (Supabase) con Row Level Security. Tutte le route sono **lazy-loaded** (code splitting) e il data fetching passa esclusivamente da custom hooks su React Query.

---

## Stack tecnologico

| Area | Tecnologia |
|------|------------|
| **UI framework** | React 19.2 |
| **Linguaggio** | TypeScript 5.8 (strict completo, `noImplicitAny`) |
| **Build tool / dev server** | Vite 8.1 (SWC) |
| **Routing** | React Router 8.3 |
| **Stato server & cache** | TanStack Query 5.83 |
| **Styling** | Tailwind CSS 4.3 (config CSS-first `@theme`) + shadcn/ui (Radix UI) + `@tailwindcss/typography` |
| **Icone** | Lucide React |
| **Grafici** | Recharts 3.10 |
| **Backend / Auth / DB** | Supabase (`@supabase/supabase-js` 2.89), tipi generati dal DB |
| **Form** | react-hook-form 7.61 + zod 4.4 |
| **Date** | date-fns 4.4 |
| **i18n** | react-i18next 17 + i18next 26 (it / en) |
| **Toast** | sonner 2.0 (sistema unificato) |
| **Parsing / export** | papaparse 5.5 (CSV) |
| **Testing** | Vitest 4.1 + Testing Library (jsdom), Playwright 1.61 (E2E) |
| **Lint** | ESLint 9 + typescript-eslint 8 |

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

#### 📁 Categorie (`/categories`)
Gestione delle categorie personalizzate in una pagina dedicata: creazione, modifica ed eliminazione con **icona (emoji)**, **colore** e tipo (entrata/uscita). Le stesse funzioni restano disponibili anche dalle Impostazioni.

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
Gestione del proprio account e dei dati (pagina suddivisa in sezioni dedicate):
- **Informazioni Account**: modifica credenziali (email, password) con verifica della password attuale, logout.
- **Lingua**: scelta della lingua dell'interfaccia (italiano / inglese).
- **Valuta Principale**: scelta della valuta di default per le nuove transazioni.
- **Import / Export Dati** (vedi sezione dedicata).
- **Gestione Categorie**: creazione/modifica/eliminazione di categorie personalizzate con icona (emoji) e colore.
- **Sezione Coppia** (se permesso `couple_expenses`): gestione dell'accoppiamento con il partner.
- **Mappature ISIN** (per portfolio): collegamento dei simboli agli ISIN per l'aggiornamento automatico dei prezzi.
- **Sicurezza**:
  - **Autenticazione a due fattori (2FA)** opt-in via TOTP (Google Authenticator, Authy, 1Password…). Enrollment con QR code + secret testuale, verifica, rimozione. Al login, se l'utente ha un fattore attivo viene richiesto il codice a 6 cifre (livello AAL2).
  - **Accessi attuali**: sessione corrente e storico degli accessi con dispositivo e browser riconosciuti (Parsing dello user-agent), e pulsante "Disconnetti altre sessioni".

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
- Sotto-sezioni dedicate per **Magic: The Gathering**, **Pokémon TCG** e **Yu-Gi-Oh!** (`/tcg/magic`, `/tcg/pokemon`, `/tcg/yugioh`), basate su un componente collezione generico.
- Per ogni carta: nome, set/espansione, numero collezione, **condizione** (Near Mint → Damaged), lingua (EN, IT, JP, DE, FR, ES, PT, KOR, ZHS), quantità, prezzo d'acquisto, prezzo corrente, data, immagine e note.
- **Ricerca via API CardTrader**: cerca carte reali con prezzo di mercato (CT Zero) e aggiungile alla collezione in pochi click.
- **Dashboard collezione**: valore totale (attuale vs costo), P&L assoluto e percentuale, numero di pezzi; pie chart per gioco.
- **Aggiornamento automatico dei prezzi** via Edge Function (`update-tcg-prices`).
- Le carte con valore di mercato **confluiscono nel Portfolio** finanziario.

#### 📚 Libreria (permesso `libreria`)
Catalogo della propria collezione libreria, con valutazione:
- Sotto-sezioni per **Libri**, **Fumetti** e **Manga** (`/libreria/libri`, `/libreria/fumetti`, `/libreria/manga`), unificate su una **pagina generica** (`LibraryPage`) configurata per categoria.
- Per ogni voce: titolo, autore, editore, anno, **copertina**, prezzo d'acquisto, **valore di rivendita**, quantità e note.
- **Ricerca via API**: Google Books per i libri (con recupero cover), Jikan/MyAnimeList per i manga (tramite Edge Function `mangaworld-proxy`).
- **Dashboard collezione**: costo totale, valore di rivendita totale, P&L, numero di pezzi; statistiche per categoria.

#### 💞 Budget Familiare (permesso `couple_expenses`)
Per gestire le finanze condivise con un partner:
- **Accoppiamento**: sistema di invito/accettazione (richiesta → connessione) tra due utenti.
- **Spese condivise**: una transazione può essere condivisa con il partner con **due modalità di divisione**: 50/50 (predefinito) oppure **importi personalizzati** (quota tua / quota partner esplicite); il partner vede l'importo, la valuta, la descrizione e la data, ma **mai la categoria personale** del creatore (per proteggerne la privacy).
- **Budget condiviso** (`/couple-budget`): budget mensili per "categoria di coppia" (nome testuale condiviso, non legato ai category_id personali).
- **Suggerimento basato sui dati**: spesa mediana mensile condivisa calcolata sugli storici.
- **Audit log immutabile** di tutte le azioni sulla connessione (creazione, revoca, ecc.).

---

### ⚙️ Amministrazione

- **Admin Panel** (`/admin`, permesso `admin`): elenco di tutti gli utenti (via `/api/admin`) con i relativi permessi e assegnazione/modifica dei permessi (inclusi `admin`, `poker`, `fumo`, `fire`, `tcg`, `libreria`, `couple_expenses`). Strumenti di gestione:
  - **Reset password** — invio dell'email di recupero a un utente.
  - **Toggle registrazioni** — abilita/disabilita le nuove signup.
  - **Eliminazione utenti** — rimozione definitiva dell'account (service role, solo server-side).

---

## Internazionalizzazione (i18n)

Tutte le pagine sono localizzate con **react-i18next**:

- Lingue supportate: **italiano** (default) e **inglese** — dizionari in `src/i18n/locales/{it,en}.json`.
- Selettore lingua nelle **Impostazioni** (`LanguageSection`).
- La lingua è applicata ai testi di UI, toast e messaggi di errore.
- `scripts/extract-i18n-keys.mjs` estrae le chiavi per l'audit dei dizionari; uno **smoke test** Vitest (`src/i18n/smoke.test.ts`) verifica l'inizializzazione.

---

## Mobile e PWA

L'app è progettata per un uso mobile-first:

- **PWA installabile**: `manifest.webmanifest` con icone (192/512 + maskable), `theme-color`, display standalone e meta tag iOS (`apple-touch-icon`).
- **Bottom navigation** su schermi piccoli: 4 tab frequenti + drawer "Altro" per tutte le sezioni (`components/layout/BottomNav.tsx`).
- **Dialog responsive**: `max-height` con fallback `dvh` e scroll interno su mobile, margini ridotti.
- **Touch target** adeguati, rispetto delle **safe-area** (`viewport-fit=cover`) e fix di overflow orizzontali (es. pagine TCG).
- Script di audit in `scripts/`: `mobile-check.mjs` (screenshot a 375px + rilevamento overflow orizzontale), `dialog-mobile-check.mjs` e `dialog-transaction-repro.mjs` (verifiche dialog).

---

## Architettura del progetto

```
Savely/
├── api/                    # Vercel Functions (reset-password via Resend, admin)
├── scripts/                # script di supporto/audit (mobile, visual, i18n, icone PWA)
├── src/
│   ├── components/          # Componenti React
│   │   ├── charts/          #   grafici di analisi per categoria
│   │   ├── dashboard/       #   widget dashboard (StatCard)
│   │   ├── fire/            #   calcolatori FIRE (input, chart, UI)
│   │   ├── fumo/            #   componenti modulo Fumo
│   │   ├── layout/          #   MainLayout, Sidebar, BottomNav (mobile)
│   │   ├── legal/           #   layout pagine legali
│   │   ├── libreria/        #   pagina collezione generica (libri/fumetti/manga)
│   │   ├── portfolio/       #   dialog chiusura posizione
│   │   ├── settings/        #   sezioni impostazioni (account, sicurezza, import, coppia, ISIN…)
│   │   ├── statistics/      #   statistiche e budget indicator
│   │   ├── tcg/             #   pagine collezione TCG
│   │   └── ui/              #   componenti shadcn/ui (Radix)
│   ├── hooks/               # Custom hooks (dati React Query, auth, permessi, ecc.)
│   ├── i18n/                # configurazione react-i18next + locales (it, en)
│   ├── integrations/
│   │   └── supabase/        # client Supabase + tipi generati dal DB
│   ├── lib/                 # utility, tipi, costanti, calcoli, security
│   │   ├── fire/            #   logica calcoli FIRE
│   │   └── statistics/      #   logica statistica
│   ├── pages/               # pagine/route dell'app (lazy-loaded)
│   │   ├── fire/            #   Standard/Barista FIRE
│   │   ├── tcg/             #   Magic / Pokémon / Yu-Gi-Oh
│   │   ├── libreria/        #   Libri / Fumetti / Manga
│   │   └── ...              #   Dashboard, Transactions, Insights, Portfolio, NetWorth, ecc.
│   ├── test/                # setup Vitest (jest-dom, polyfill)
│   ├── types/               # tipi condivisi (import)
│   ├── App.tsx              # router + route guards (lazy)
│   ├── main.tsx             # entry point
│   └── index.css            # Tailwind 4 (config CSS-first @theme) + stili globali
├── e2e/                     # test end-to-end (Playwright)
├── supabase/
│   ├── functions/           # Edge Functions (Deno)
│   ├── migrations/          # migrazioni database PostgreSQL
│   └── config.toml          # configurazione progetto Supabase
├── .github/workflows/        # CI (GitHub Actions)
├── plans/                    # documentazione di sviluppo e audit
├── TECH_DEBT_REPORT_2026-08-23.md  # audit debito tecnico + roadmap remediation
├── index.html                # meta PWA (manifest, theme-color, icone)
├── package.json
├── vite.config.ts
├── postcss.config.js         # plugin @tailwindcss/postcss
├── playwright.config.ts      # configurazione E2E
├── vitest.config.ts          # configurazione unit test
└── vercel.json               # SPA rewrites + security headers
```

### Route guard

L'app usa un'unica guard `PermissionRoute`: senza prop `perm` richiede solo l'autenticazione (Dashboard, Transazioni, Uscite Ricorrenti, Budget, Categorie, Portfolio, Patrimonio, Grafici, Insights, Impostazioni); con `perm="poker|fumo|fire|tcg|libreria|couple_expenses|admin"` richiede anche il permesso corrispondente. Le rotte pubbliche (`/auth`, `/auth/callback`, `/reset-password`, `/privacy`, `/cookies`, `/terms`, NotFound) non sono protette.

### Note su qualità e performance

- **Code splitting**: tutte le route sono caricate con `React.lazy` + Suspense (bundle per-route invece di un unico chunk).
- **Data fetching unificato**: ogni entità ha un hook dedicato in `src/hooks/` basato su TanStack Query (il vecchio doppio paradigma `useSupabaseData` è stato consolidato).
- **Type safety**: TypeScript `strict` completo, tipi Supabase **generati dal database**, zero cast `as any`.
- **UI condivisa**: pagine collezione generiche per TCG e Libreria (niente duplicazione per gioco/formato); toast unificati su `sonner`.

---

## Prerequisiti

- **Node.js 24** (Active LTS, vedi CI in `.github/workflows/ci.yml`)
- **npm**
- Un account / progetto **Supabase**

---

## Installazione

1. **Clona il repository**

   ```bash
   git clone https://github.com/GoryNickel9/Savely.git
   cd Savely
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
npm run typecheck    # controllo tipi TypeScript (tsc --noEmit, progetti node + app)
npm run test         # unit test (Vitest)
npm run test:watch   # test in watch mode
npm run e2e          # test end-to-end (Playwright)
npm run e2e:ui       # test E2E in modalità interattiva
```

### Script di supporto (`scripts/`, eseguibili con Node)

| Script | Scopo |
|--------|-------|
| `mobile-check.mjs` | Screenshot mobile (375×812) delle pagine pubbliche + rilevamento overflow orizzontale |
| `visual-check.mjs` | Screenshot delle pagine pubbliche per verifica visiva (usato per la migrazione Tailwind 3→4) |
| `dialog-mobile-check.mjs` | Verifica comportamento dialog su mobile e desktop (margini, bounding box, scroll) |
| `dialog-transaction-repro.mjs` | Repro mobile del dialog "Nuova Transazione" |
| `extract-i18n-keys.mjs` | Estrazione/audit delle chiavi i18n |
| `gen-icons.mjs` | Genera le icone PWA (PNG) da `scripts/icon.svg` |

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
- **Da estratto conto bancario** — dialog dedicato con parsing CSV, barra di avanzamento e validazione di sicurezza.
- **Da piattaforme esterne** — Revolut, BBVA, TradeRepublic.

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

### Vercel Functions (`api/`)

| Route | Descrizione |
|-------|-------------|
| `/api/reset-password` | Genera il recovery link (Admin API Supabase) e invia l'email branded via Resend |
| `/api/admin` | Endpoint riservato admin: `get-users` (elenco utenti + profilo) e `delete-user` (eliminazione definitiva). Il chiamante si autentica con il proprio token di sessione, che viene verificato insieme al permesso `admin` prima di usare la service role key |

---

## Sicurezza

- **Content Security Policy** e security headers (X-Frame-Options, HSTS, Referrer-Policy, Permissions-Policy) configurati in `vercel.json`.
- **Row Level Security** di Supabase sul database.
- **Autenticazione a due fattori (TOTP)** opt-in: enrollment/verifica/rimozione tramite l'API MFA nativa di Supabase; la tabella `login_activity` (RLS per-user, append-only) traccia gli eventi di accesso.
- **Validazione dell'`Origin`** sul redirect di reset-password: solo gli origin in allowlist vengono accettati come destinazione post-recupero.
- **Endpoint admin hardenati**: `/api/admin` verifica token di sessione + permesso `admin` del chiamante; la service role key resta solo lato server (mai con prefisso `VITE_`).
- **Privacy nelle spese condivise**: le spese condivise di coppia espongono importo/valuta/descrizione ma **mai** il `category_id` personale del creatore (vedi `shared_expenses_view` e i commenti in `src/lib/types.ts`); esiste inoltre un audit log immutabile. La coerenza dello split personalizzato è validata da un trigger SECURITY DEFINER.
- **Validazione password** e controlli di sicurezza sugli import (`src/lib/passwordValidation.ts`, `src/lib/importFileSecurity.ts`, `src/lib/couple.security.test.ts`).
- Suite di **unit test** con Vitest su calcoli finanziari, parsing CSV, sicurezza coppia, validazione password, MFA, user-agent parsing e sicurezza degli import.

### Valute supportate
EUR, USD, GBP, CHF, JPY, CNY, IDR — con conversione automatica in EUR.

---

## Testing

Il progetto ha due livelli di test.

### Unit test (Vitest + Testing Library, ambiente jsdom)
Funzioni pure in `src/lib/*.test.ts` (calcoli finanziari FIRE/net worth/statistiche, insights/anomaly detection, parsing CSV, sicurezza coppia, validazione password e MFA, parsing user-agent, detection ricorrenze, sicurezza degli import) **e hook critici** in `src/hooks/*.test.tsx` (`usePermissions`, `useSupabaseData`), più uno smoke test i18n.

```bash
npm test          # run singolo
npm run test:watch
```

### E2E (Playwright)
Test end-to-end che guidano l'app reale in browser Chromium. Sono divisi in due progetti:
- **public** (`*.public.spec.ts`): rotte pubbliche (`/auth`, `/privacy`, `/cookies`, `/terms`, NotFound, redirect guard) — non richiedono auth.
- **authenticated** (`*.auth.spec.ts`): login, CRUD transazioni, route guard sui permessi, FIRE — richiedono credenziali.

I test autenticati si collegano al progetto Supabase reale usando un **utente seedato dedicato** (`e2e-savely@example.com`, senza permessi di modulo). Le credenziali vengono fornite via variabili d'ambiente:

| Variabile | Descrizione |
|-----------|-------------|
| `E2E_USER_EMAIL` | Email dell'utente E2E seedato |
| `E2E_USER_PASSWORD` | Password dell'utente E2E seedato |

Se le variabili non sono impostate, i test autenticati vengono saltati (gli pubblici girano comunque). L'utente va creato una sola volta via Admin API (vedi `e2e/seed.sql` per la documentazione).

```bash
# Setup locale
export E2E_USER_EMAIL=e2e-savely@example.com
export E2E_USER_PASSWORD=<password>
npm run e2e            # run headless
npm run e2e:ui         # modalità interattiva con UI
```

In CI i segreti sono configurati come GitHub secrets e il gate E2E gira ad ogni push/PR su `main`.

---

## CI/CD e deploy

### CI (GitHub Actions — `.github/workflows/ci.yml`)
Su push/PR su `main` vengono eseguiti 5 gate paralleli (tutti su **Node 24**, Active LTS):

| Gate | Cosa verifica |
|------|---------------|
| **quality** | `npm run lint` + `npm run build` |
| **test** | `npm test` (Vitest) |
| **typecheck** | `npm run typecheck` |
| **security** | `npm audit --audit-level=high` |
| **e2e** | `npm run e2e` (Playwright) — richiede i secrets `E2E_USER_EMAIL` / `E2E_USER_PASSWORD`; genera un report caricato come artifact |

### Deploy
L'app è pronta per il deploy su **Vercel**: `vercel.json` gestisce i rewrite SPA (tutto a `index.html`, tranne `/api/*`) e gli security headers.

### Email transazionali (Resend)
Il reset password passa dalla route serverless `api/reset-password.ts` (Vercel Function): genera il recovery link con la Admin API di Supabase (`generateLink`) e invia l'email branded via **Resend**. Le altre email di Supabase Auth (conferma signup, cambio email) continuano a usare il canale SMTP configurato in Supabase.

Environment variable richieste su **Vercel** (solo server-side, mai con prefisso `VITE_`):

| Variabile | Descrizione |
|-----------|-------------|
| `RESEND_API_KEY` | API key di Resend |
| `SUPABASE_SERVICE_ROLE_KEY` | Service key di Supabase (bypassa RLS — non deve mai finire nel bundle client) |
| `SUPABASE_URL` | URL del progetto Supabase per `/api/admin` (opzionale: ha default incorporato) |
| `RESEND_FROM` | Mittente, es. `Savely <noreply@savely.cc>` (default di test: `onboarding@resend.dev`) |

In locale la SPA non serve `/api`: usare `vercel dev` per provare il flusso completo. Nuove email transazionali: aggiungere una route in `api/` riutilizzando il pattern di `reset-password.ts`.

---

## Piani di sviluppo

La cartella `plans/` contiene documenti di sviluppo, audit e revisioni (es. audit sicurezza, revisioni di codice). Non sono artefatti finali ma traccia delle decisioni prese durante il ciclo di sviluppo.

Il **debito tecnico** è tracciato in `TECH_DEBT_REPORT_2026-08-23.md`: registro priorizzato dei finding (TD-001…TD-017) e roadmap di remediation — Fase 0 (quick win), Fase 1 (type safety: tipi generati dal DB, `strict` completo) e Fase 3 (upgrade major dipendenze, inclusa la migrazione Tailwind 3→4) completate; Fase 2 (struttura e performance: code splitting, unificazione data fetching, split Settings, test hook) in corso al 23/08/2026.

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
