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

### 🧩 Moduli base (tutti gli utenti autenticati)

- **Dashboard** — panoramica patrimonio netto, statistiche mensili/annuali, cashflow, performance portfolio, ultime transazioni.
- **Transazioni** — entrate/uscite con supporto multi-valuta, conversione automatica in EUR, filtri per data/categoria/tipo, categorizzazione personalizzata.
- **Uscite Ricorrenti** — spese periodiche (settimanali, mensili, trimestrali, annuali) generate automaticamente da una Edge Function cron.
- **Budget** — budget mensili per categoria con monitoraggio in tempo reale e indicatori di avanzamento.
- **Portfolio** — tracciamento asset (azioni, ETF, crypto, obbligazioni, liquidità, immobili, altro) con P&L in tempo reale e aggiornamento automatico dei prezzi.
- **Grafici** — entrate/uscite, analisi per categoria, trend temporali (sezioni dedicate a entrate, uscite e confronto entrate/uscite).

### 🔐 Moduli specializzati (richiedono permesso)

- **Poker** — Next Cut, Guadagno Orario, Rakeback, Spese Manuali.
- **Fumo** — Liquido Sigaretta, CBD, THC con statistiche e calcoli derivati.
- **FIRE** — calcolatori Standard FIRE e Barista FIRE con proiezioni e calcolo anni al FIRE.
- **Statistiche Deep Dive** — analisi avanzate (medie, mediane, media winsorizzata su finestre di 365/730 giorni).
- **TCG** — collezione di carte Magic: The Gathering, Pokémon TCG e Yu-Gi-Oh! con valore, P&L e aggiornamento prezzi.
- **Libreria** — catalogo di Libri, Fumetti e Manga con costo di acquisto, valore di rivendita e ricerca cover via API.
- **Budget Familiare** — spese condivise e budget condiviso con un partner accoppiato (split percentuale, audit log, privacy delle categorie personali).

### ⚙️ Amministrazione

- **Admin Panel** — gestione utenti e assegnazione permessi (solo `admin`).

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
