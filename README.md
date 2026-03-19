# Spendy Cloud

Una web application completa per la gestione finanziaria personale, il tracciamento del portafoglio di investimenti e il monitoraggio delle spese. Costruita con React, TypeScript, Vite e Supabase.

![Version](https://img.shields.io/badge/version-0.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## 📋 Indice

- [Caratteristiche Principali](#caratteristiche-principali)
- [Stack Tecnologico](#stack-tecnologico)
- [Installazione](#installazione)
- [Configurazione](#configurazione)
- [Struttura del Progetto](#struttura-del-progetto)
- [Funzionalità per Modulo](#funzionalità-per-modulo)
- [Sistema di Permessi](#sistema-di-permessi)
- [Import/Export Dati](#importexport-dati)
- [Sviluppo](#sviluppo)
- [Licenza](#licenza)

## ✨ Caratteristiche Principali

### Gestione Finanziaria
- **Dashboard**: Panoramica completa delle finanze con statistiche in tempo reale
- **Transazioni**: Gestione completa di entrate e uscite
- **Budget**: Impostazione e monitoraggio dei budget mensili per categoria
- **Categorie**: Categorizzazione personalizzata con icone e colori
- **Spese Ricorrenti**: Tracciamento automatico delle spese periodiche

### Portfolio e Investimenti
- **Gestione Portafoglio**: Tracciamento di azioni, ETF, crypto, obbligazioni e altro
- **Performance**: Monitoraggio P&L in tempo reale
- **Aggiornamento Prezzi**: Aggiornamento automatico dei prezzi degli asset
- **Chiusura Posizioni**: Gestione completa delle vendite

### Analisi e Statistiche
- **Grafici**: Visualizzazione grafica di entrate, uscite e trend
- **Statistiche Approfondite**: Analisi dettagliate delle spese per categoria
- **Obiettivi di Risparmio**: Definizione e monitoraggio degli obiettivi finanziari

### Moduli Specializzati
- **Poker**: Tracciamento delle sessioni di poker, guadagno orario, rakeback e next cut
- **Fumo**: Monitoraggio dei costi del fumo (sigarette, liquido, CBD, THC)
- **FIRE**: Calcolatori per Financial Independence, Retire Early (Standard e Barista)

### Gestione Account
- **Autenticazione**: Login sicuro con Supabase Auth
- **Permessi Granulari**: Sistema di permessi per moduli specifici
- **Import/Export**: Importazione da piattaforme esterne (Revolut, BBVA, TradeRepublic, Spendy)
- **Gestione Dati**: Esportazione in CSV/XLSX e importazione personalizzata

## 🛠️ Stack Tecnologico

### Frontend
- **React 18.3** - Framework UI
- **TypeScript 5.8** - Tipizzazione statica
- **Vite 5.4** - Build tool e dev server
- **React Router 6.30** - Routing dell'applicazione
- **TanStack Query 5.83** - Gestione stato e cache

### UI e Styling
- **Tailwind CSS 3.4** - Framework CSS utility-first
- **shadcn/ui** - Componenti UI pre-costruiti basati su Radix UI
- **Radix UI** - Componenti accessibili e primitivi
- **Lucide React** - Icone
- **Recharts 2.15** - Grafici e visualizzazioni

### Backend e Database
- **Supabase 2.89** - Backend as a Service
  - Autenticazione
  - Database PostgreSQL
  - Realtime subscriptions
  - Storage
  - Edge Functions

### Utility e Librerie
- **date-fns 3.6** - Manipolazione date
- **zod 3.25** - Validazione dati
- **react-hook-form 7.61** - Gestione form
- **papaparse 5.5** - Parsing CSV
- **xlsx 0.18** - Gestione Excel

## 📦 Installazione

### Requisiti Preliminari

- Node.js 18 o superiore
- npm (Node Package Manager)
- Un account Supabase

### Passi di Installazione

1. **Clona il repository**
   ```bash
   git clone https://github.com/GoryNickel/spendy_cloud.git
   cd spendy_cloud
   ```

2. **Installa le dipendenze**
   ```bash
   npm install
   ```

3. **Configura le variabili d'ambiente**
   
   Crea un file `.env` nella root del progetto con le seguenti variabili:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Configura Supabase**
   
   Esegui le migrazioni del database:
   ```bash
   supabase db push
   ```

5. **Avvia l'applicazione**
   ```bash
   npm run dev
   ```

   L'applicazione sarà disponibile all'indirizzo: http://localhost:5173

## ⚙️ Configurazione

### Variabili d'Ambiente

| Variabile | Descrizione | Obbligatorio |
|-----------|-------------|--------------|
| `VITE_SUPABASE_URL` | URL del progetto Supabase | Sì |
| `VITE_SUPABASE_ANON_KEY` | Chiave anonima di Supabase | Sì |

### Configurazione Supabase

Il progetto include le seguenti tabelle nel database:

- `profiles` - Profili utente e permessi
- `transactions` - Transazioni finanziarie
- `categories` - Categorie di spesa/entrata
- `budgets` - Budget mensili
- `savings_goals` - Obiettivi di risparmio
- `portfolio_assets` - Asset del portafoglio
- `recurring_expenses` - Spese ricorrenti
- `poker_manual_expenses` - Spese manuali poker
- `poker_next_cuts` - Next cut poker
- `poker_hourly_earnings` - Guadagno orario poker
- `poker_rakeback` - Rakeback poker
- `fumo_liquido_sigaretta` - Tracciamento liquido sigaretta
- `fumo_cbd` - Tracciamento CBD
- `fumo_thc` - Tracciamento THC
- `manual_price_updates` - Aggiornamenti manuali prezzi

## 📁 Struttura del Progetto

```
spendy_cloud/
├── public/                 # File statici
│   ├── favicon.ico
│   └── placeholder.svg
├── src/
│   ├── components/         # Componenti React
│   │   ├── dashboard/     # Componenti dashboard
│   │   ├── fire/          # Componenti calcolatori FIRE
│   │   ├── layout/        # Layout e navigazione
│   │   ├── portfolio/     # Componenti portfolio
│   │   ├── settings/      # Componenti impostazioni
│   │   ├── statistics/    # Componenti statistiche
│   │   └── ui/            # Componenti UI shadcn
│   ├── hooks/             # Custom React hooks
│   ├── integrations/      # Integrazioni esterne
│   │   └── supabase/      # Client Supabase
│   ├── lib/               # Librerie e utility
│   │   ├── fire/          # Calcoli FIRE
│   │   └── statistics/    # Calcoli statistici
│   ├── pages/             # Pagine dell'applicazione
│   │   ├── fire/          # Pagine calcolatori FIRE
│   │   ├── Auth.tsx       # Pagina autenticazione
│   │   ├── Dashboard.tsx  # Dashboard principale
│   │   ├── Transactions.tsx
│   │   ├── Budget.tsx
│   │   ├── Portfolio.tsx
│   │   ├── Poker.tsx      # Modulo poker
│   │   ├── Fumo.tsx       # Modulo fumo
│   │   └── Settings.tsx   # Impostazioni
│   ├── App.tsx            # App principale
│   ├── main.tsx           # Entry point
│   └── index.css          # Stili globali
├── supabase/              # Configurazione Supabase
│   ├── functions/         # Edge functions
│   ├── migrations/        # Migrazioni database
│   └── config.toml        # Configurazione progetto
├── plans/                 # Piani di sviluppo
├── .env                   # Variabili d'ambiente
├── package.json           # Dipendenze e script
├── tsconfig.json          # Configurazione TypeScript
├── vite.config.ts         # Configurazione Vite
└── tailwind.config.ts     # Configurazione Tailwind
```

## 🚀 Funzionalità per Modulo

### Dashboard
- Panoramica del patrimonio netto
- Statistiche mensili e annuali
- Cashflow e performance portfolio
- Ultime transazioni

### Transazioni
- Aggiunta, modifica ed eliminazione transazioni
- Filtri per data, categoria e tipo
- Supporto multi-valuta (EUR, USD, GBP, CHF, JPY, CAD, AUD, CNY)
- Categorizzazione personalizzata

### Budget
- Impostazione budget mensili per categoria
- Monitoraggio in tempo reale
- Indicatori visivi di avanzamento
- Alert per superamento budget

### Portfolio
- Gestione asset (azioni, ETF, crypto, obbligazioni, cash, immobili)
- Tracciamento P&L in tempo reale
- Aggiornamento automatico prezzi
- Chiusura posizioni con registrazione profitto/perdita

### Statistiche
- Grafici entrate/uscite
- Analisi per categoria
- Trend temporali
- Esportazione dati

### Poker (richiede permesso)
- **Next Cut**: Calcolo del prossimo livello/stake
- **Guadagno Orario**: Tracciamento guadagno per ora di gioco
- **Rakeback**: Monitoraggio rakeback ricevuto
- **Spese Manuali**: Registrazione spese correlate al poker

### Fumo (richiede permesso)
- **Liquido Sigaretta**: Tracciamento consumo e costi
- **CBD**: Monitoraggio consumo CBD
- **THC**: Monitoraggio consumo THC
- Statistiche e calcoli derivati

### FIRE (richiede permesso)
- **Standard FIRE**: Calcolo pensionamento anticipato tradizionale
- **Barista FIRE**: Calcolo pensionamento con lavoro part-time
- Proiezioni grafiche
- Calcolo anni al FIRE

### Impostazioni
- Gestione profilo utente
- Modifica email e password
- Importazione da piattaforme esterne:
  - Revolut
  - BBVA
  - TradeRepublic
  - Spendy
- Esportazione dati (CSV/XLSX)
- Gestione categorie
- Mappatura ISIN per portfolio

## 🔐 Sistema di Permessi

L'applicazione utilizza un sistema di permessi granulari per controllare l'accesso ai diversi moduli:

### Permessi Disponibili

| Permesso | Descrizione | Moduli Abilitati |
|----------|-------------|------------------|
| `admin` | Accesso amministrativo completo | Tutti i moduli + Admin Panel |
| `poker` | Accesso al modulo Poker | Poker (Next Cut, Guadagno Orario, Rakeback) |
| `fumo` | Accesso al modulo Fumo | Fumo (Liquido, CBD, THC) |
| `statistics_deep_dive` | Statistiche approfondite | Statistiche Deep Dive |
| `fire` | Accesso ai calcolatori FIRE | FIRE (Standard, Barista) |

### Gestione Permessi

I permessi sono assegnati a livello di profilo utente e possono essere modificati solo dagli amministratori. I permessi sono memorizzati nella tabella `profiles` come un oggetto JSON.

### Rotte Protette

L'applicazione implementa diverse rotte protette:
- **ProtectedRoute**: Richiede autenticazione
- **AdminRoute**: Richiede permesso `admin`
- **PokerRoute**: Richiede permesso `poker`
- **FireRoute**: Richiede permesso `fire`
- **StatisticsDeepDiveRoute**: Richiede permesso `statistics_deep_dive`

## 📥 Import/Export Dati

### Formati Supportati

- **CSV**: Comma Separated Values
- **XLSX**: Microsoft Excel

### Importazione

L'applicazione supporta l'importazione da diverse fonti:

#### Importazione Manuale
Carica un file Excel/CSV con i seguenti fogli:
- `Transazioni`: Importa transazioni finanziarie
- `Categorie`: Importa categorie
- `Obiettivi`: Importa obiettivi di risparmio
- `Portfolio`: Importa asset del portafoglio
- `Investimenti`: Importa investimenti con supporto vendite

#### Importazione da Piattaforme
- **Revolut**: Importa statement Revolut
- **BBVA**: Importa statement BBVA
- **TradeRepublic**: Importa statement TradeRepublic
- **Spendy**: Importa dati Spendy legacy

### Esportazione

Esporta tutti i tuoi dati in un unico file Excel con i seguenti fogli:
- Transazioni
- Categorie
- Budget
- Obiettivi
- Portfolio

## 🛠️ Sviluppo

### Script Disponibili

```bash
# Avvia server di sviluppo
npm run dev

# Build per produzione
npm run build

# Build in modalità sviluppo
npm run build:dev

# Anteprima build di produzione
npm run preview

# Esegui linter
npm run lint
```

### Edge Functions Supabase

Il progetto include edge functions per operazioni asincrone:

- `delete-account`: Eliminazione account utente
- `update-prices`: Aggiornamento automatico prezzi portfolio (cron job)

### Migrazioni Database

Le migrazioni sono gestite tramite Supabase CLI:

```bash
# Applica migrazioni
supabase db push

# Crea nuova migrazione
supabase migration new migration_name
```

### Convenzioni di Codice

- **TypeScript**: Strict mode abilitato
- **ESLint**: Configurazione per React e TypeScript
- **Componenti**: Functional components con hooks
- **Styling**: Tailwind CSS con componenti shadcn/ui
- **Stato**: TanStack Query per gestione stato server-side
- **Routing**: React Router v6

## 📄 Licenza

Questo progetto è rilasciato sotto la licenza MIT. Vedi il file [LICENSE](LICENSE) per maggiori dettagli.

## 🤝 Contributi

I contributi sono benvenuti! Se vuoi contribuire a questo progetto:

1. Fai un fork del repository
2. Crea un branch per la tua feature (`git checkout -b feature/AmazingFeature`)
3. Commit le tue modifiche (`git commit -m 'Add some AmazingFeature'`)
4. Push al branch (`git push origin feature/AmazingFeature`)
5. Apri una Pull Request

## 📞 Supporto

Per domande o supporto:
- Apri una issue su GitHub
- Contatta il team di sviluppo

## 🙏 Ringraziamenti

- Supabase per l'ottimo backend-as-a-service
- shadcn per i componenti UI di alta qualità
- Vercel per Vite
- La community open source

---

**Sviluppato con ❤️ usando React, TypeScript e Supabase**
