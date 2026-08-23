# Audit del Debito Tecnico — Spendy Cloud (Savely)

**Data:** 23 agosto 2026
**Commit analizzato:** `f4f283b` (branch `main`, working tree pulito)
**Stack:** React 19 + Vite 8 + react-router 8, Supabase (Postgres + Auth + Edge Functions), Vercel Functions, Tailwind 3, TanStack Query 5, i18next, Playwright + Vitest

---

## 1. Sintesi esecutiva

Il progetto è in uno **stato di salute complessivamente buono**: CI con 6 gate (lint, build, test, typecheck, audit, e2e), zero vulnerabilità nelle dipendenze, RLS attiva su tutte le tabelle, nessun segreto nel repository, nessun `@ts-ignore`, nessun TODO/FIXME pendente, un solo warning lint.

Il debito tecnico rilevato si concentra in tre aree:

1. **Type safety di sistema** — i tipi Supabase generati coprono 15 tabelle mentre il codice ne usa 26: da qui i **35 cast `as any`**, tutti aggiramenti di quella singola causa radice. In più `tsconfig` gira con `strict: false` e `noImplicitAny: false`, quindi il typecheck che passa in CI garantisce poco.
2. **Duplicazione strutturale** — le tre pagine libreria (Fumetti/Libri/Manga, ~1.320 righe) e le tre pagine poker (~1.490 righe) sono quasi copie conformi; `Settings.tsx` è un monolite da 887 righe.
3. **Performance del bundle** — un unico chunk JS da **1,8 MB** senza code splitting per-route.

Nessun finding di severity **Critical**: sicurezza server-side (RLS, verifica admin server-side, secret nelle env var) e igiene generale sono curate. Due finding di sicurezza **difensiva** (validazione dell'`Origin` in reset-password, assenza di rate limiting) meritano fix rapidi ma a basso sforzo.

**Registro sintetico:** 2 High · 7 Medium · 8 Low · 0 Critical.

---

## 2. Statistiche del progetto

| Metrica | Valore |
|---|---|
| File sorgente (TS/TSX/JS/SQL, incluse migrazioni, e2e, scripts) | 292 |
| LOC totali sorgente | ~36.200 |
| LOC in `src/` + `api/` (esclusi componenti shadcn/ui generati) | ~25.400 |
| Vercel Functions (`api/`) | 2 (`admin.ts`, `reset-password.ts`) |
| Supabase Edge Functions | 7 (1 vuota, v. TD-010) |
| Migrazioni SQL | ~40 |
| Dipendenze runtime / dev | ~39 / ~21 |
| Test unitari (Vitest) | 16 file (quasi tutti in `src/lib/`) |
| Test e2e (Playwright) | 6 spec (auth, fire, public, guarded-routes, transactions) |
| `npm audit` | **0 vulnerabilità** |
| `npm run lint` | 0 errori, 1 warning |
| `npm run typecheck` (pre-Fase 0) | **no-op: 0 file controllati** (v. TD-011) |
| Stato post-Fase 1 | 0 errori typecheck (2 progetti), 0 `any` in src/api, `noImplicitAny` attivo, 186 test verdi |
| Stato post-Fase 2 (parziale) | `strict: true` completo, bundle principale 627 KB raw / ~190 KB gzip (era 1,81 MB), 193 test verdi |
| Stato post-Fase 3 | 6 major upgrade (date-fns 4, zod 4, lucide 1, sonner 2, tailwind-merge 3, recharts 3), 4 dipendenze rimosse, audit 0 vulnerabilità, 193 test verdi |
| Tabelle con RLS | 32/32 create nelle migrazioni ✅ |

---

## 3. Registro priorizzato

| ID | Titolo | Categoria | Severità | Sforzo | Rischio regressione |
|---|---|---|---|---|---|
| TD-001 | Tipi Supabase generati obsoleti → 35 cast `as any` | Type safety | **High** | 4–8 h | Basso |
| TD-002 | `strict: false` e `noImplicitAny: false` in tsconfig | Type safety / Tooling | **High** | 1–3 g (incrementale) | Medio |
| TD-003 | `Origin` non validato nel redirect di reset-password | Security | Medium | 1 h | Basso |
| TD-004 | Nessun rate limiting su `/api/reset-password` | Security / Reliability | Medium | 2–4 h | Basso |
| TD-005 | Triplicazione pagine libreria e pagine poker (~2.800 LOC) | Architettura | Medium | 2–3 g | Medio |
| TD-006 | `Settings.tsx` monolite (887 righe) | Architettura | Medium | 1 g | Basso |
| TD-007 | Bundle unico 1,8 MB, zero code splitting | Performance | Medium | 4–8 h | Basso |
| TD-008 | Permessi in localStorage con validazione debole | Security / Reliability | Medium | 2 h | Basso |
| TD-009 | Doppio paradigma di data fetching (React Query vs manuale) | Architettura | Medium | 2–4 g (graduale) | Medio |
| TD-010 | Edge Function vuota `search-tcg-cards` | Manutenibilità | Low | 5 min | Nessuno |
| TD-011 | `api/` escluso dal typecheck; `no-unused-vars` off globale | Tooling | Low | 1–2 h | Basso |
| TD-012 | `console.log` residui in `useCategories.ts` | Manutenibilità | Low | 15 min | Nessuno |
| TD-013 | 12+ dipendenze ferme a major precedenti | Tooling | Low | Graduale | Medio per major |
| TD-014 | Warning `exhaustive-deps` in `TcgCollectionPage` | Reliability | Low | 15 min | Basso |
| TD-015 | Test solo su funzioni pure `lib/`: zero test di hook/component | Testing | Low | Continuativo | Nessuno |
| TD-016 | Doppio sistema toast coesistente (use-toast + sonner) | Manutenibilità | Low | 2–4 h | Basso |
| TD-017 | `serviceHeaders` costruiti con `!` prima del check env (api) | Robustezza | Low | 30 min | Basso |

---

## 4. Findings dettagliati

### TD-001 — Tipi Supabase generati obsoleti → 35 cast `as any` · **High**

**Evidenza.** `src/integrations/supabase/types.ts` (riga 1: *"automatically generated"*) definisce 15 tabelle, ma il codice riferimento 26 tabelle/viste tramite `.from('...')`: `couple_budgets`, `library_items`, `shared_expenses`, `tgc_cards`, `poker_*`, `manual_price_updates`, `net_worth_snapshots` e altre non esistono nei tipi. Risultato: il compilatore non vede queste tabelle e il codice le aggira con cast. 35 occorrenze di `: any` / `as any` (esclusi i componenti ui generati), ad esempio:

- `src/hooks/useCoupleBudgets.ts:40,70,89,105` — `(supabase as any)`
- `src/hooks/useLibraryItems.ts:15,47,61,75` — `(supabase as any)`
- `src/hooks/useTcgCards.ts:15,49,62,76` — `(supabase as any)`
- `src/components/fumo/FumoCrudPage.tsx:147,172,193` — `.from(tableName as any)`
- `src/pages/PokerHourlyEarnings.tsx:72,150,170,199,245` e `PokerRakeback.tsx:107,127,152,185`
- `src/hooks/useSupabaseData.ts:70` — hook generico con `.from(tableName as any)`
- `src/lib/permissions.ts:123`, `src/hooks/useProfile.ts:38`, `src/hooks/useRecurringExpenses.ts:112`

**Impatto.** Ogni query su quelle tabelle è non tipizzata: errori di colonna, di forma dei dati o refactoring sbagliati emergono solo a runtime. È la causa radice dell'intero debito di type safety del progetto.

**Rimedio.** Rigenerare i tipi dal database reale (`supabase gen types typescript --schema public > src/integrations/supabase/types.ts`), poi rimuovere i cast un file alla volta lasciando che il compilatore guidi. Il `tableName as any` di `useSupabaseData` andrà risolto con un mapping tabella→tipo (già esiste la whitelist `USER_TABLES` in `src/lib/constants.ts` su cui costruire).

**Sforzo:** 4–8 h · **Rischio:** Basso (il compilatore verifica ogni passo).

---

### TD-002 — `strict: false` e `noImplicitAny: false` in tsconfig · **High**

**Evidenza.** `tsconfig.app.json:18-22`:

```json
"strict": false,
"noUnusedLocals": false,
"noUnusedParameters": false,
"noImplicitAny": false,
```

`npm run typecheck` esce con 0 errori proprio perché quasi nulla è verificato: il gate CI "Typecheck" dà un falso senso di sicurezza.

**Impatto.** Null e undefined non controllati, parametri implicitamente `any`, variabili morte — tutte classi di bug che un progetto di questa dimensione con dominio finanziario (transazioni, portafoglio, net worth) non può permettersi.

**Rimedio.** Attivazione incrementale: (1) `noImplicitAny: true` → fix dei punti segnalati (molti spariranno da soluni dopo TD-001); (2) `strictNullChecks` (il passo con più rendimento); (3) il resto di `strict: true`; infine `noUnusedLocals/Parameters`. Ogni passo è una PR separata verificata da CI.

**Sforzo:** 1–3 giornate ripartite · **Rischio:** Medio (può far emergere bug latenti — che è il punto).

---

### TD-003 — `Origin` non validato nel redirect di reset-password · Medium

**Evidenza.** `api/reset-password.ts:102-104`:

```ts
const origin = req.headers.origin;
const redirectTo =
  typeof origin === 'string' ? `${origin}/reset-password` : `${SUPABASE_URL}/reset-password`;
```

L'header `Origin` è completamente controllato dal chiamante. La funzione lo inoltra a GoToTrue come `redirect_to` senza alcuna allow-list lato funzione.

**Impatto.** La mitigazione oggi è solo la allow-list dei redirect URL configurata su Supabase (il commento nel codice la cita). Se quella allow-list è ampia o contiene wildcard, un attaccante può invocare l'endpoint con `Origin: https://evil.example` e far arrivare alla vittima una **email brandizzata Savely con link verso un dominio controllato** (phishing). Il fix lato funzione è defense-in-depth che non dipende dalla configurazione Supabase.

**Rimedio.** Validare `origin` contro un allow-list esplicita (`https://savely.cc`, `https://bank.savely.cc`, `http://localhost:8080` per il dev) e fare fallback al Site URL in caso di mismatch.

**Sforzo:** 1 h · **Rischio:** Basso.

---

### TD-004 — Nessun rate limiting su `/api/reset-password` · Medium

**Evidenza.** `api/reset-password.ts:80-118`: endpoint pubblico, senza limiti, che per ogni richiesta valida genera un recovery link e invia un'email via Resend.

**Impatto.** Email bombing verso indirizzi arbitrari (fastidio per le vittime, consumo quota/costi Resend, rischio di blacklist del dominio mittente). La risposta 200 generica anti-enumeration è già corretta, ma non limita il volume.

**Rimedio.** Rate limiting per IP e per email destinataria: Vercel WAF, oppure un contatore in KV/Upstash, oppure il rate limit nativo di Supabase Auth sui recovery email.

**Sforzo:** 2–4 h · **Rischio:** Basso.

---

### TD-005 — Triplicazione pagine libreria e poker (~2.800 LOC) · Medium

**Evidenza.** Le tre pagine libreria hanno import block identici al 100% e struttura duplicata: `src/pages/libreria/Fumetti.tsx` (415 righe), `Libri.tsx` (437), `Manga.tsx` (467) — tutte usano lo stesso hook `useLibraryItems` e differiscono solo per il tipo item e qualche label. Analogo per il poker: `PokerHourlyEarnings.tsx` (547), `PokerRakeback.tsx` (483), `PokerNextCut.tsx` (459), tre CRUD pressoché identici su tabelle diverse (con i rispettivi `as any`, v. TD-001).

**Impatto.** Ogni fix (es. un bug nell'import o nella validazione) va replicato 3 volte; è già il blocco più grande del "codice che si deve ricordare di aggiornare in più posti".

**Rimedio.** Un componente pagina generico parametrizzato (tipo item → tabella, colonne, label i18n); per il poker un `PokerCrudTable` condiviso. Il refactoring è meccanico e coperto dai tipi una volta fatto TD-001.

**Sforzo:** 2–3 g · **Rischio:** Medio (regressioni UI — mitigabile con screenshot e2e prima di toccare).

---

### TD-006 — `Settings.tsx` monolite (887 righe) · Medium

**Evidenza.** `src/pages/Settings.tsx` contiene inline la sezione valuta (riga ~404), lingua (~437), import/export (~471), categorie (~580) e rimonta `CoupleSettingsSection` (~762) e `SecuritySection` (~765) — il file più grande del progetto.

**Impatto.** Re-render e ricompilazioni inutili, difficoltà di navigazione, misto di logica dati e layout in un solo componente.

**Rimedio.** Estrarre le sezioni inline in `src/components/settings/` seguendo il pattern già usato da `CoupleSettingsSection`/`SecuritySection`.

**Sforzo:** 1 g · **Rischio:** Basso.

---

### TD-007 — Bundle unico 1,8 MB senza code splitting · Medium

**Evidenza.** `src/App.tsx` (161 righe, ~50 import) monta tutte le rotte eagerly: nessun `React.lazy`/`Suspense` nel progetto. Il build di produzione è un solo chunk: `dist/assets/index-CEsbty0n.js` = **1.811.422 byte** (~1,8 MB raw, stima ~500 KB gzip). Include recharts, tutte le radix, tutte le pagine (poker, FIRE, TCG, libreria…) anche per l'utente che visita solo la dashboard.

**Impatto.** Tempo di primo caricamento e parse/eval JS elevato su mobile; LCP e TBT penalizzati.

**Rimedio.** `React.lazy()` + `Suspense` per le rotte (pattern standard react-router con `lazy`), `manualChunks` in Vite per separare vendor pesanti (recharts, radix, supabase). Verificare con `rollup-plugin-visualizer`.

**Sforzo:** 4–8 h · **Rischio:** Basso.

---

### TD-008 — Permessi in localStorage con validazione debole · Medium

**Evidenza.** `src/hooks/usePermissions.ts:32-53`: i permessi (incluso `admin`) vengono letti dal localStorage come stato iniziale. Il type guard `validatePermissions` (righe 11–28) verifica solo che **esista almeno una chiave** nota, non che i valori siano booleani: `{ admin: "ciao" }` passa la validazione.

**Impatto.** (a) Un utente può editare il localStorage per far comparire UI admin — accettabile solo se ogni azione privilegiata è ri-verificata server-side (lo è in `api/admin.ts:27-52` e nelle RLS, quindi oggi è un problema di **esposizione UI**, non di sicurezza dei dati); (b) permessi revocati restano visibili fino al refresh successivo; (c) valori malformati passano il guard.

**Rimedio.** Restringere il guard a `typeof v === 'boolean'` per ogni campo, oppure abbandonare la cache manuale e usare la cache di React Query (già in casa, v. TD-009) con `staleTime` breve.

**Sforzo:** 2 h · **Rischio:** Basso.

---

### TD-009 — Doppio paradigma di data fetching · Medium

**Evidenza.** 23 file in `src/hooks/` usano React Query (`useQuery`/`useMutation`), ma 7 hook fanno ancora fetch manuale con `useState` + `useEffect` + flag `cancelled` (es. `usePermissions.ts:56-93`, `useSupabaseData.ts:42-107` con tanto di ref `isLoadingRef` anticarro concurrency fatto a mano).

**Impatto.** Due stili da mantenere, caching/invalidazione inconsistenti (un hook sa quando invalidare l'altro no), code review più difficili.

**Rimedio.** Convergere progressivamente i 7 hook manuali su React Query durante il normale lavoro di manutenzione (boy-scout rule), partendo da `useSupabaseData` che è il più usato.

**Sforzo:** 2–4 g ripartiti · **Rischio:** Medio se fatto in blocco, Basso se un hook per PR.

---

### TD-010 — Edge Function vuota `search-tcg-cards` · Low

**Evidenza.** `supabase/functions/search-tcg-cards/` esiste ma non contiene alcun file (le altre 6 hanno tutte `index.ts`).

**Impatto.** Dead code che confonde (sembra una funzione da sistemare) e può causare errori con `supabase functions deploy --all`.

**Rimedio.** `git rm -r supabase/functions/search-tcg-cards` (o implementarla se era pianificata).

**Sforzo:** 5 min · **Rischio:** Nessuno.

---

### TD-011 — Gate typecheck no-op; `api/` escluso; `no-unused-vars` off globale · Low → **corretto in Fase 0 (parziale)**

**Evidenza (approfondita in Fase 0).** Lo script era `tsc --noEmit` alla radice, ma `tsconfig.json` è uno solution-style config (`files: []` + references): senza `--build`, **tsc non segue i reference e controlla zero file**. Verificato con `--listFiles`: 0 file. Il gate "Typecheck" della CI era quindi un completo no-op, non un check debole. `tsconfig.node.json` (che include già `api/` e `vite.config.ts` con `strict: true`) passava pulito ma non era mai invocato. Il progetto app (`tsconfig.app.json`, `strict: false`) nasconde **45 errori di tipo reali** in 16 file (19 in `useCouplePairStatus.ts`, quasi tutti `'xxx' is not assignable to 'never'` derivanti dai tipi tabelle mancanti, v. TD-001). Inoltre `eslint.config.js:23` disattiva `@typescript-eslint/no-unused-vars` globalmente.

**Rimedio applicato in Fase 0.** `typecheck` ora esegue `tsc --noEmit -p tsconfig.node.json` → il gate CI diventa reale su `api/` + `vite.config.ts` in modalità strict (verificato: passa). Aggiunto script `typecheck:app` per lavorare sui 45 errori nascosti, che entreranno nel gate in Fase 1 insieme a TD-001/TD-002 (la rigenerazione dei tipi Supabase risolverà la maggior parte dei `'never'` alla radice, senza cast).

**Residuo (Fase 1):** portare `tsconfig.app.json` nel gate `typecheck`; restringere `no-unused-vars: off` a `src/components/ui/**` se necessario.

---

### TD-012 — `console.log` residui in `useCategories.ts` · Low

**Evidenza.** `src/hooks/useCategories.ts:29,38,67,97` loggano in console dati di categoria (creazione/eliminazione) anche in produzione. Sono gli unici `console.log` fuori dai componenti generati.

**Impatto.** Rumore in console per l'utente finale; logica di logging non gestita centralmente.

**Rimedio.** Rimuoverli o convertirli in un logger condizionale (`import.meta.env.DEV`).

**Sforzo:** 15 min · **Rischio:** Nessuno.

---

### TD-013 — Dipendenze ferme a major precedenti · Low

**Evidenza.** `npm outdated` (agosto 2026): major indietro su `date-fns` 3→4, `zod` 3→4, `recharts` 2→3, `tailwindcss` 3→4, `tailwind-merge` 2→3, `lucide-react` 0.462→1, `sonner` 1→2, `react-day-picker` 8→10, `react-resizable-panels` 2→4, `@hookform/resolvers` 3→5, `@vercel/node` 5→7, `typescript` 5.8→5.9 (7 disponibile). Tutte le dipendenze sono aggiornate *dentro* la propria major e `npm audit` dà 0 vulnerabilità.

**Impatto.** Nessun rischio immediato; costo di aggiornamento che cresce nel tempo (in particolare tailwind 4 e recharts 3 sono breaking estesi).

**Rimedio.** Non è urgente. Pianificare un upgrade per trimestre partendo da quelli a basso impatto (date-fns 4, zod 4) e valutare tailwind 4 solo con un sprint dedicato.

**Sforzo:** variabile (0,5–3 g per major) · **Rischio:** Medio per i major breaking.

---

### TD-014 — Warning `exhaustive-deps` in `TcgCollectionPage` · Low

**Evidenza.** `src/components/tcg/TcgCollectionPage.tsx:91` — `useMemo` con dipendenza mancante `normalizeSet` (unico warning dell'intera codebase).

**Impatto.** Valore memoizzato potenzialmente stantio se `normalizeSet` cambia (in pratica è probabilmente stabile, ma è un bug latente).

**Rimedio.** Aggiungere la dipendenza o inglobare la funzione nel memo.

**Sforzo:** 15 min · **Rischio:** Basso.

---

### TD-015 — Test concentrati solo su `src/lib/` · Low

**Evidenza.** 16 file di test unitari, quasi tutti su funzioni pure in `src/lib/` (csv, insights, statistics, fire/calculations, mfa, passwordValidation, recurringDetection, userAgent, netWorth, permissions… — ottima copertura del dominio). Zero test di hook (33 hook in `src/hooks/`), zero test di componenti/pagine. Gli e2e Playwright coprono auth, guard, transactions e fire.

**Impatto.** Il refactoring strutturale proposto in TD-005/TD-006/TD-009 non ha rete di sicurezza a livello di UI/hooks.

**Rimedio.** Aggiungere Vitest + Testing Library per gli hook critici (`usePermissions`, `useSupabaseData`, `useTransactions`) prima dei refactoring di Fase 2; non serve inseguire il 100%.

**Sforzo:** continuativo · **Rischio:** Nessuno.

---

### TD-016 — Doppio sistema toast coesistente · Low

**Evidenza.** 26 file usano lo shadcn `use-toast` (basato su Radix), mentre `App.tsx` monta anche il `Toaster` di `sonner` (`src/components/ui/sonner.tsx`), e la dipendenza `sonner` è presente.

**Impatto.** Due API di notifica da mantenere; comportamento visivo potenzialmente incoerente.

**Rimedio.** Scegliere una (sonner è quella consigliata dalle versioni recenti di shadcn/ui) e migrare gradualmente i 26 call-site.

**Sforzo:** 2–4 h · **Rischio:** Basso.

---

### TD-017 — `serviceHeaders` con non-null assertion prima del check env · Low

**Evidenza.** `api/admin.ts:18-24` costruisce gli header di servizio al load del modulo con `SUPABASE_SERVICE_ROLE_KEY!`: se la env manca, gli header contengono `"undefined"` stringa. Il problema è mitigato da `requireAdmin` (riga 31) che verifica la env e risponde 403 — ma il 403 "Non autorizzato" maschera un problema di configurazione.

**Impatto.** Diagnostica fuorviante in caso di misconfigurazione del deploy.

**Rimedio.** Costruire gli header lazy (dentro le funzioni) o rispondere 500 "non configurato" quando la env manca, come già fa correttamente `reset-password.ts:96-99`.

**Sforzo:** 30 min · **Rischio:** Basso.

---

## 5. Cosa NON è debito (punti di forza verificati)

Per evitare falsi positivi, questi aspetti sono stati verificati e sono **sani**:

- **RLS completa:** tutte le 32 tabelle create nelle migrazioni hanno `ENABLE ROW LEVEL SECURITY`.
- **Zero segreti nel repo:** `.env*` è ignorato e non tracciato; la anon key Supabase è pubblica per design (documentato in CI e nei sorgenti) con sicurezza demandata a RLS; le Edge Function leggono i secret da `Deno.env` e validano JWT/secret cron (`process-recurring-expenses/index.ts:49-76`).
- **`/api/admin` ri-verifica il ruolo admin server-side** (`api/admin.ts:27-52`) — il client non è trusted.
- **Anti-enumeration** nella reset password (risposta 200 generica, `api/reset-password.ts:112-117`).
- **CI a 6 gate** con Node 24, cache npm, audit bloccante su high/critical, e2e con seed dedicato.
- Nessun `@ts-ignore`/`@ts-expect-error`, nessun `TODO`/`FIXME`, nessun catch vuoto, lint a 1 warning, `npm audit` a 0.
- `e2e/.auth/`, `dist/`, `test-results/` correttamente ignorati da git.

---

## 6. Roadmap di remediation

### Fase 0 — Quick win (entro 1 settimana, ~3 h totali) — ✅ completata il 23/08/2026
| Item | Azione | Esito |
|---|---|---|
| TD-010 | Rimuovere la cartella Edge Function vuota | ✅ cartella eliminata (non era tracciata da git) |
| TD-003 | Allow-list dell'`Origin` in `reset-password` | ✅ allow-list via env `ALLOWED_ORIGINS` + fallback su dominio di produzione |
| TD-012 | Rimuovere i `console.log` | ✅ rimossi i 4 da `useCategories.ts` |
| TD-014 | Chiudere il warning `exhaustive-deps` | ✅ `normalizeSet` in `useCallback` |
| TD-011 | Includere `api/` nel typecheck CI | ✅ gate reale su `tsconfig.node.json` (strict); scoperto che il gate era un no-op completo (v. finding) |
| TD-017 | Headers di servizio lazy in `api/admin.ts` | ✅ `getServiceHeaders()` + 500 esplicito "non configurato" |

### Fase 1 — Type safety (1–2 sprint) — ✅ completata il 23/08/2026
1. **TD-001**: ✅ tipi rigenerati dal DB remoto con la CLI (`supabase gen types --linked`, 672→1.653 righe); tutti i 35 cast `as any` rimossi (0 in src/api). Cast puntuali documentati rimasti solo dove genuinamente dinamici: payload FumoCrudPage (chiavi calcolate su 3 schemi), `useSupabaseData` (unione 25 tabelle → TS2589), `parsePermissions`/`permissions` (Json). Durante lo sweep sono emersi e stati corretti 2 bug latenti: `renderSetLine` tipizzava `collector_number` come `number` (nel DB è `string`) e l'export GDPR usava una cast-chain non verificata.
2. **TD-002/TD-011 residuo**: ✅ i 45 errori nascosti risolti (la sola rigenerazione dei tipi ne ha eliminati 32); `tsconfig.app.json` e `tsconfig.node.json` entrambi nel gate CI (`typecheck` ora esegue i due progetti). **`noImplicitAny: true` attivato con 0 errori.** Prossimo step (Fase 2+): `strictNullChecks` — stimati 21 errori, da affrontare in PR dedicata.
3. **TD-008**: ✅ nuovo `parsePermissions()` condiviso in `lib/permissions.ts` con verifica `typeof === 'boolean'` per ogni campo; usato dal profilo DB, dai caller admin e dalla cache localStorage di `usePermissions` (sostituisce il guard debole che accettava `{admin: "ciao"}`).
4. **TD-004**: ✅ rate limiting in-memory su `/api/reset-password` (3 richieste/10 min per IP e per email, risposta 429). Nota: per-istanza sulle Vercel Function — per un limite globale servirebbe Vercel WAF o un contatore KV.

### Fase 2 — Struttura e performance (2–4 sprint) — 🔶 in corso (aggiornamento 23/08/2026 sera, II)
1. **TD-015**: ✅ completata la rete di test: aggiunti Testing Library + jsdom e 7 test per gli hook critici — `usePermissions` (4: cache localStorage normalizzata, fetch+cache DB, reset senza utente, gestione errore con invalidazione cache) e `useSupabaseData` (3: caricamento con filtro/ordine, toast d'errore, nessuna query senza utente). Totale suite: 200 test / 19 file.
2. **TD-005**: 🟡 libreria consolidata (23/08/2026, III): `Fumetti.tsx` 415→21 e `Libri.tsx` 437→21 righe, ora wrapper di `components/libreria/LibraryPage` (config: categoria, funzione di ricerca, label i18n) con la ricerca Google Books estratta in `lib/googleBooks.ts` (incluse le varianti `searchFumetti` con fallback subject e `searchGoogleBooks`). **Manga resta volutamente separato**: inserimento manuale con range di volumi e dialog di modifica su tutti i campi — UX genuinamente diverse, forzarle nella pagina generica la complicherebbe più della duplicazione. **Residuo**: valutare lo stesso consolidamento per le tre pagine poker (~1.490 righe; nota: `PokerHourlyEarnings` interagisce con due tabelle, serve analisi dedicata).
3. **TD-006**: ✅ `Settings.tsx` 893→189 righe: estratti `AccountSection`, `CurrencySection`, `LanguageSection`, `ImportExportSection` (dialog controllato, aperto anche dal bottone Privacy) e `CategoriesSection` in `src/components/settings/`, seguendo il pattern di `CoupleSettingsSection`/`SecuritySection`. In pagina restano solo Privacy e Zona Pericolo.
4. **TD-007**: ✅ lazy loading di tutte le 41 rotte con `React.lazy` + `Suspense`. Bundle principale: **1,81 MB → 627 KB raw (−65%), ~190 KB gzip**; recharts isolato in chunk separato (340 KB raw) caricato solo dalle pagine con grafici; 115 chunk totali.
5. **TD-009**: ⬜ convergere gli hook manuali su React Query (uno per PR).
6. **TD-016**: ⬜ unificare il sistema toast.
7. **TD-002 (follow-up)**: ✅ **`strict: true` completo attivo su `tsconfig.app.json` con 0 errori** (non solo `strictNullChecks`: l'intero set). Risolti 19 errori null-safety legittimi (user nullable in hook con `enabled`, `aal`/`factorsData` MFA nullable, widening `collector_number`/`couple_category_name` nullable). Rimosso il vecchio `TECH_DEBT_REPORT.md` del 15/08.

### Fase 3 — Lungo termine (oltre 4 sprint) — ✅ completata il 23/08/2026 (Tailwind 4 differito con motivazione)
- **TD-013**: ✅ upgrade major completati con verifica typecheck+lint+test+build a ogni passo:
  - `date-fns` 3→4, `zod` 3→4 (fix `error.errors`→`error.issues` in Auth/ResetPassword/Settings), `lucide-react` 0.462→1, `sonner` 1→2, `tailwind-merge` 2→3, `recharts` 2→3 (9 formatter adattati ai tipi `Formatter<ValueType, NameType>`; chunk grafici 340K→300K; wrapper shadcn `ui/chart.ts` rimosso, era inutilizzato e incompatibile).
  - **Rimosse 4 dipendenze morte invece di aggiornarle**: `@hookform/resolvers` (mai importato), `react-day-picker` + `ui/calendar.tsx` (mai usati), `react-resizable-panels` + `ui/resizable.tsx` (mai usati, v4 rinominava l'intera API), `@vercel/node` (solo tipi: sostituito da `api/vercel.ts` locale — v7 introduceva advisories transitive ajv/path-to-regexp/undici che avrebbero rotto il gate audit CI).
  - **Audit npm: 0 vulnerabilità** mantenuto su tutto il percorso.
- **Differiti con motivazione**:
  - `tailwindcss` 3→4: la migrazione riscrive config→CSS (`@theme`), plugin `tailwindcss-animate` e il pattern `hsl(var(--…))` diffuso su tutte le pagine; richiede verifica visiva pagina-per-pagina (screenshot/e2e visivi) non automatizzabile in questa sessione. Prelude: snapshot visivi delle rotte principali.
  - `typescript` 7 (Go-based) e `eslint` 10: attendere il supporto di `typescript-eslint`; si resta su TS 5.9 / eslint 9.
- Out of scope rimanenti dalla Fase 2: TD-005, TD-006, TD-009, TD-016 (v. sopra).

---

## 7. Metodologia e caveati

- Analisi statica manuale su working tree pulito a `f4f283b`: esplorazione completa dei file, lettura integrale dei punti security-critical (`api/*`, client Supabase, `usePermissions`, `useSupabaseData`), grep sistematiche (`any`, `as any`, `@ts-ignore`, `TODO`, `console.log`, `localStorage`, secret), confronto tabelle vs RLS sulle migrazioni SQL, `tsc --noEmit`, `eslint .`, `npm audit`, `npm outdated`.
- La verifica RLS è basata sulle migrazioni nel repo: se il database remoto ha avuto drift manuale, va riverificata con query su `pg_tables`/`pg_policies`.
- Le stime di sforzo assumono familiarità con il codebase e non includono code review.
- I numeri su bundle si riferiscono al `dist/` presente (build del 15/08/2026).
- Questo report aggiorna (non sostituisce automaticamente) `TECH_DEBT_REPORT.md` del 15/08/2026: dopo revisione, il vecchio file può essere rimosso.
