# Audit del Debito Tecnico — Spendy Cloud

**Data audit:** 5 agosto 2026
**Branch analizzato:** `main` (commit `b5c3a32`)
**Linguaggio:** TypeScript 5.8 su runtime browser (Vite + React 19) + Deno (Supabase Edge Functions)
**Auditor:** analisi automatica read-only (nessun file sorgente modificato)

---

## 1. Sintesi esecutiva

**Livello di debito complessivo: MEDIO.**

Il codebase è in stato di salute migliore della media dei progetti "side-project cresciuto": la maggior parte
delle librerie in `src/lib/` è ben testata (15 suite unitarie, copertura buona su logica finanziaria pura),
la pipeline CI ha 5 gate distinti (lint / build / test / typecheck / security + E2E) e gli ultimi commit
mostrano disciplina nella rimozione di codice morto e nella correzione di race condition di sicurezza
(es. `d5d7048` per il 2FA al login). Il deps audit è pulito (`0 vulnerabilities`).

Tuttavia esistono **quattro aree di debito concentrate e ad alto ritorno** che meritano trattamento
prioritario:

1. **Drift dei tipi Supabase (TD-001, critico).** Il file generato `src/integrations/supabase/types.ts`
   dichiara solo ~12 tabelle, mentre il codice ne usa ~25. Ogni query sulle tabelle mancanti
   (couple, library, tcg, poker hourly/rakeback, net_worth_snapshots, login_activity,
   manual_price_updates…) è disabilitata dal type-checker tramite 35 cast `as any`. Questo annulla
   di fatto `strict` su intere sezioni del data layer.
2. **Configurazione TypeScript permissiva (TD-002, critico per la sicurezza del tipo).**
   `tsconfig.app.json` ha `strict: false`, `noImplicitAny: false`, `noFallthroughCasesInSwitch: false`,
   e il `tsconfig.json` radice ha `strictNullChecks: false`. Questo rende il `tsc --noEmit` green anche
   in presenza di `null`/`undefined` non gestiti e genera 60 asserzioni non-null (`user!.id`) la cui
   sicurezza dipende interamente dall'abilitazione delle query.
3. **Duplicazione strutturale tra pagine (TD-007, medio).** `libreria/Libri.tsx`,
   `libreria/Fumetti.tsx`, `libreria/Manga.tsx` sono riproduzioni quasi identiche (~95% di codice
   condiviso, differiscono solo per `category`, label e funzione di ricerca). Stesso pattern per
   le pagine `Poker.tsx`/`Fumo.tsx` (index a griglia di card) e `PokerHourlyEarnings.tsx`/
   `PokerRakeback.tsx` (CRUD annuale).
4. **Affidabilità del data layer della coppia / permessi (TD-009, medio).** I permessi utente
   (che pilotano i route guard di sicurezza) sono memorizzati in `localStorage` e letti come
   fonte di verità iniziale per il routing; l'autenticazione dei permessi avviene davvero solo
   lato DB/RLS, ma il fallback client può mostrare temporaneamente sezioni non autorizzate.

**Azione più urgente:** rigenerare i tipi Supabase (TD-001) e abilitare `strict` in `tsconfig.app.json`
(TD-002) — sono cambiamenti meccanici ad alto impatto che sbloccano la rilevazione statica di intere
classi di bug oggi mascherate.

**Effetto atteso del remediation:** riduzione drastica dei bug a runtime sulle tabelle "nuove",
diminuzione dei difetti null-deref, eliminazione di ~1.200 righe duplicate e abbattimento del costo
di inserimento di una nuova "categoria di collezione" (oggi richiede copiare un file da ~430 righe).

**Assunzioni e limiti:**
- L'audit è statico: non è stata eseguita la suite di test, ma si è verificato che `tsc --noEmit`,
  `npm audit` e l'inventario dei test passino/compilino come da CI.
- Il backend è Supabase (Postgres + RLS + Edge Functions Deno). La logica lato DB non è stata
  revisionata in profondità (fuori scope per un audit TS), ma sono stati notati i punti di
  interazione client/server.
- Le pagine `src/components/ui/*` (shadcn/ui generated) sono state escluse dall'analisi del debito
  perché codice venduto/generato.

---

## 2. Metodologia e scope

### Cosa è stato analizzato

| Area | Dettaglio |
|---|---|
| File sorgente TS/TSX | 197 file, ~29.300 righe (di cui ~128 file applicativi, esclusi UI kit e test) |
| Configurazione | `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `eslint.config.js`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `package.json` |
| Pipeline CI | `.github/workflows/ci.yml` (5 gate + E2E) |
| Backend | `supabase/migrations/*.sql` (inventario), `supabase/functions/*/index.ts` (5 Edge Functions) |
| Test | 15 suite unitarie (Vitest), 5 spec E2E (Playwright) |
| Dipendenze | `package.json` + `npm audit` (0 vuln) |

### Tecniche usate

- Lettura mirata dei file più grandi e/o critici per sicurezza/finanza.
- Grep quantitativi per smell: `as any` (35), `user!.id` (60), `console.*` (46), `@ts-ignore`
  (0), TODO/FIXME (0).
- Inventario delle tabelle referenziate vs. tabelle tipizzate per quantificare il drift.
- Analisi delle dipendenze tra pagine per identificare duplicazione.

### Cosa NON è stato analizzato (fuori scope)

- Logica SQL/RLS delle migrazioni (richiederebbe accesso DB).
- Accessibilità (a11y) e performance di runtime (richiederebbero profilazione).
- Conformenza GDPR oltre al flusso cookie banner già implementato.

---

## 3. Registro del debito tecnico (prioritario)

Legenda severity: **C** = Critico, **H** = Alto, **M** = Medio, **L** = Basso, **N** = Nota.
Sforzo (in giorni-developer): 1 = poche ore, 2 = ~1 gg, 3 = qualche gg, 4 = settimane, 5 = iniziativa cross-team.

| ID | Titolo | Sev | Categoria | Location | Descrizione | Sforzo | Rischio |
|---|---|---|---|---|---|---|---|
| TD-001 | Tipi Supabase generati in drift con lo schema reale | C | Type safety | `src/integrations/supabase/types.ts`; 35 cast `as any` in 14 file | Il `Database` generato copre ~12 tabelle; il codice ne usa ~25. Le tabelle couple/library/tcg/poker/net_worth/login_activity/manual_price_updates sono query "all'uncinetto" senza tipo. | 2 | Maschera bug a runtime, annulla `strict` sul data layer |
| TD-002 | `tsconfig.app.json` permissivo (`strict: false` ecc.) | C | Tooling / Type safety | `tsconfig.app.json:18`, `tsconfig.json:13` | `strict`, `noImplicitAny`, `noFallthroughCasesInSwitch`, `strictNullChecks` tutti off. `tsc` passa anche con null-deref. | 3 (incrementale) | Bug null/undefined non rilevati staticamente |
| TD-003 | 60 asserzioni non-null `user!.id` nei data hook | H | Reliability / Type safety | `src/hooks/use*.ts` (es. `useTransactions.ts:16`, `usePortfolio.ts:18`), `useCouplePairStatus.ts` | Pattern sistematico: `enabled: !!user` nella query, poi `user!.id` dentro `queryFn`. Funziona solo perché react-query non esegue se `enabled` è false; ma se si rimuove `enabled` o si sposta la query, si rompe silenziosamente. | 2 | Sostituibile con guard esplicita + `useAuth` che restituisca `user` non-null quando `enabled` |
| TD-004 | `QueryClient` senza `defaultOptions` | M | Reliability / Performance | `src/App.tsx:52` | Nessun `staleTime`/`retry`/`refetchOnWindowFocus` configurato. Default react-query: `staleTime: 0` → refetch aggressivo a ogni focus/mount. | 1 | Latenza percepita, carico Supabase, possibili race |
| TD-005 | Permessi utente in `localStorage` usati per routing | M | Security / Reliability | `src/hooks/usePermissions.ts:32-53`, `src/App.tsx:73-96` (`PermissionRoute`) | Lo stato iniziale dei permessi proviene da `localStorage`; il route guard ci si affida finché non arriva il dato DB. Può mostrare temporaneamente link/sezioni a utenti non autorizzati (la protezione reale resta RLS, ma l'UX è fuorviante). | 2 | Information leak minore, confusione UX |
| TD-006 | Codice scaffold morto + duplicazione index pages | L | Maintainability | `src/pages/Index.tsx` (template "Blank App" mai routato), `src/pages/Poker.tsx` ≈ `src/pages/Fumo.tsx` | `Index.tsx` è il template di partenza Vite/Lovable mai referenziato in `App.tsx`. `Poker.tsx`/`Fumo.tsx` sono grid di card quasi identici. | 1 | Confusione per nuovi contributori, binario inutile nel bundle |
| TD-007 | Triplicazione pagine libreria (Libri/Fumetti/Manga) | H | Maintainability / Duplication | `src/pages/libreria/Libri.tsx` (435 righe), `Fumetti.tsx` (413), `Manga.tsx` (465) | Tre file ~95% identici: state, filtri, dialog add/edit, lista, stats. Differiscono solo `category`, label e URL/subject di ricerca Google Books. ~1.200 righe duplicabili in 1 componente. | 2 | Bug-fix da applicare 3 volte, rischio divergenza |
| TD-008 | Pagine Poker CRUD ripetute con cast `as any` | M | Maintainability / Type safety | `src/pages/PokerHourlyEarnings.tsx` (545), `PokerRakeback.tsx` (481), `PokerNextCut.tsx` (457) | Ognuna implementa lo stesso pattern CRUD annuale via `useSupabaseData` + `useYearlyData` + cast `as any` sulle tabelle. Schema molto simile, estraibile. | 3 | Stesso problema di TD-001 + duplicazione |
| TD-009 | Interfaccia `UserPermissions` deprecata duplicata 2 volte | L | Type safety / Dead code | `src/lib/types.ts:26` e `src/lib/types.ts:112` (entrambe `@deprecated`), esportata anche come `UserPermissionsDeprecated` in `permissions.ts:193` | Stesso nome interfaccia definito due volte nello stesso file con campi diversi. TS unisce/usa l'ultima. Comportamento non intuitivo, facile da usare male. | 1 | Confusione di tipo, dead code |
| TD-010 | Typo sistematico: `tgc_cards` vs feature "tcg" | L | Naming / Consistency | tabella `tgc_cards` (migrazione + `constants.ts:94`), ma ovunque altrove `tcg` (`PermissionKey='tcg'`, `TcgGame`, cartella `src/pages/tcg/`, `src/components/tcg/`) | Incongruenza storica di naming. Non causa bug ma ostacola la ricerca nel codebase. | 2 (richiede migrazione DB rename) | Basso; da allineare al prossimo refactor del DB |
| TD-011 | `console.log/error` sparsi (46 occorrenze) | L | Operational / DX | `src/hooks/useCategories.ts` (5 log), `src/components/settings/*ImportDialog.tsx`, Edge Function `update-prices` (log verboso a ogni prezzo) | Log di debug lasciati in produzione. In particolare `useCategories.ts` logga dati utente (`Creazione categoria: {...}`). | 1 | Rumore in console prod, minima leak di info |
| TD-012 | Edge Functions con `@ts-ignore` e `req: any` | M | Type safety / Operability | `supabase/functions/update-prices/index.ts:1,4,10,209,221-226,402,425` | Deno non ha tipi nel repo; si usa `@ts-ignore` e `req: any`, `assets as any[]`. Logica finanziaria (prezzi) senza tipi. | 2 | Difficile refactor, rischi su parsing body/JWT |
| TD-013 | `processDueExpenses` con loop N+1 e logica duplicata lato client | M | Performance / Architecture | `src/hooks/useRecurringExpenses.ts:124-194` | Per ogni spesa ricorrente: 1 SELECT idempotency + 1 INSERT + 1 UPDATE, in sequenza. Esiste già un Edge Function `process-recurring-expenses` che dovrebbe fare questo. Doppia implementazione. | 2 | Latenza, race con cron, rischio transazioni parziali |
| TD-014 | Validazione assente sui dati di risposta Supabase | M | Reliability / Type safety | Tutti gli hook `use*.ts` (cast `data as Transaction[]` senza validazione runtime) | I dati dal network sono castati al tipo atteso senza zod/parse. Una colonna aggiunta/rimossa nel DB non viene rilevata. | 3 | Cast silenzioso di dati non conformi |
| TD-015 | `VITE_SITE_URL` e chiavi Supabase: gestione env non validata | L | Operability / Security | `src/hooks/useAuth.tsx:165`, `src/integrations/supabase/client.ts:5-6` | Nessun check che `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` siano presenti; se mancanti, il client viene creato con `undefined` e gli errori sono criptici a runtime. | 1 | Build/deploy che fallisce in modo oscuro |
| TD-016 | Test mancanti su data layer e componenti pagina | M | Testing | 0 test su `src/hooks/*` (40+ hook), 0 test su `src/pages/*` (40+ pagine) | La logica pura in `src/lib/` è ben testata, ma l'integrazione hook+Supabase e il rendering delle pagine non lo sono. refactoring come TD-007/TD-008 sarebbero rischiosi senza characterization test. | 4 | Refactor rischiosi, regressioni non rilevate |
| TD-017 | `Index.tsx` export che nasconde il refactor-state | N | Documentation | `src/App.tsx:56` (commento), cartella `plans/` con doc di revisione | Presenza di `plans/REVISIONE_CODICE_ROUND2_2026-07-03.md` indica refactor in corso: utile documentare lo stato nel README. | 1 | Onboarding |

---

## 4. Findings dettagliati per categoria

### 4.1 Type safety

#### TD-001 — Tipi Supabase generati in drift con lo schema reale

**Categoria:** Type safety / Architettura
**Location:** `src/integrations/supabase/types.ts` (672 righe, generated); cast `as any` in:
`useCoupleBudgets.ts`, `useLibraryItems.ts`, `useTcgCards.ts`, `useNetWorthHistory.ts`,
`useSharedExpenses.ts`, `useManualPriceUpdate.ts`, `PokerHourlyEarnings.tsx`, `PokerRakeback.tsx`,
`FumoCrudPage.tsx`, `useSupabaseData.ts`, `permissions.ts`, `useProfile.ts`, `useRecurringExpenses.ts`.
**Confidence:** Alta (direttamente osservabile).

**Problema.** Il file generato dichiara solo: `asset_price_history, budgets, categories,
category_mappings, isin_mappings, portfolio_assets, price_update_logs, profiles,
poker_manual_expenses, poker_next_cut, recurring_expenses, savings_goals, transactions`.
Il codice interrogà in aggiunta: `couple_budgets`, `couple_connections`,
`couple_connection_requests`, `library_items`, `login_activity`, `manual_price_updates`,
`net_worth_snapshots`, `poker_hourly_earnings`, `poker_rakeback`, `shared_expenses`,
`shared_expenses_view`, `tgc_cards`, oltre alle tabelle fumo (`cbd`, `thc`, `liquido_sigaretta`) e a
3 RPC (`get_active_sessions`, `delete_session`, `accept_couple_request`,
`delete_shared_expense_by_partner`). Per tutte queste il type system è disattivato con 35 `as any`.

**Evidence.**
```bash
$ grep -rhoE "from\('([a-z_]+)'" src --include="*.ts" --include="*.tsx" | sort -u
# → 25 tabelle distinte
$ # tabelle tipate in types.ts: 12
$ grep -rn "as any" src --include="*.ts" --include="*.tsx" | wc -l
# → 35
```
Esempio emblematico in `useLibraryItems.ts:6`:
```ts
/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase generated types do not include library_items table */
```
Il commento `eslint-disable` documentato dimostra che il problema è **noto e accettato** dal team.

**Conseguenze.** Refusi nei nomi di colonna non vengono rilevati (es. se una migration rinomina
`couple_category_name`, il codice continua a compilare). I cast `as any` si propagano: chi chiama
`useLibraryItems` riceve `LibraryItem[]` ma il runtime potrebbe restituire qualsiasi shape. L'RPC
`delete_shared_expense_by_partner` è chiamata con `as any` sul nome → typo nel nome RPC = errore
a runtime in produzione, non a compile.

**Raccomandazione.** Rigenerare i tipi dallo schema live:
```bash
npx supabase gen types typescript --linked > src/integrations/supabase/types.ts
```
(o via `--project-ref`). Questo è un'operazione meccanica che chiude ~30 dei 35 `as any`.

**Piano incrementale:**
1. Eseguire `supabase gen types` e committare il nuovo `types.ts`.
2. Rimuovere i `eslint-disable` e i `as any` file per file; il type-checker guiderà la risoluzione
   delle discrepanze tra i tipi "artigianali" in `lib/types.ts` e quelli generati.
3. Per le 3 RPC, dichiarare i tipi in `types.ts > Functions` (sezione oggi `[_ in never]: never`).
4. Valutare la fusione di `src/lib/types.ts` (tipi manuali) con i `Database["public"]["Tables"][X]["Row"]`
   generati, per avere una sola fonte di verità.

**Sforzo stimato:** 2 giorni-developer (1 gg generazione + fix dei cast, 1 gg risoluzione
discrepanze tipo manuale vs generato).
**Rischi:** bassi; i tipi più stringenti potrebbero far emergere bug latenti (valore positivo).
**Validazione:** `npm run typecheck` verde, `npm run lint` senza i `eslint-disable any`,
`npm test` verde, E2E `transactions.auth.spec.ts` e `fire.auth.spec.ts` verdi.

---

#### TD-002 — Configurazione TypeScript permissiva

**Categoria:** Tooling / Type safety
**Location:** `tsconfig.app.json:18-22`, `tsconfig.json:8-13`.
**Confidence:** Alta.

**Problema.**
```jsonc
// tsconfig.app.json
"strict": false,
"noImplicitAny": false,
"noFallthroughCasesInSwitch": false,
// tsconfig.json (radice)
"noImplicitAny": false,
"strictNullChecks": false,
```
In pratica ogni "stringency" è disattivata. Il gate CI `typecheck` (`npm run typecheck` = `tsc --noEmit`)
passa ma fornisce protezione minima: variabili `null`/`undefined` dereferenziate, switch con fallthrough,
`any` impliciti nei parametri non vengono segnalati. Le 60 asserzioni `user!.id` (TD-003) esistono
proprio perché `strictNullChecks` è off in radice (ma il progetto linka con `tsconfig.app.json`):
in alcuni file viene "suggerito" il `!`, in altri no, in modo inconsistente.

**Evidence.** `npx tsc --noEmit` restituisce 0 errori nonostante `strict: false`. Confrontare con
`tsconfig.node.json` che ha `strict: true` — l'inconsistenza tra le due configurazioni è essa
stessa debito.

**Conseguenze.** Costo nascosto alto: ogni refactor richiede più attenzione manuale perché il
compilatore non aiuta. Bug come `transaction.category?.name` dove `category` può essere `undefined`
ma viene trattato come `Category` non vengono rilevati.

**Raccomandazione.** Abilitare gradualmente, un'opzione alla volta, partendo da quella a minor
rumore:
1. `noFallthroughCasesInSwitch: true` (già true in `tsconfig.node.json`)
2. `noImplicitAny: true`
3. `strictNullChecks: true`
4. `strict: true` (catch-all)

Tra un passo e l'altro eseguire `tsc --noEmit` e fissare gli errori. Non abilitare tutto insieme:
il volume iniziale potrebbe essere nell'ordine delle centinaia di errori e scoraggiare.

**Sforzo stimato:** 3 giorni-developer distribuiti su 2-3 sprint.
**Rischi:** medio durante la transizione (alcuni falsi positivi); nulla a regime.
**Validazione:** dopo ogni step, `typecheck` + `test` + `build` verdi; E2E verde.

---

#### TD-003 — Asserzioni non-null sistematiche `user!.id`

**Categoria:** Reliability / Type safety
**Location:** 60 occorrenze; concentrate in `src/hooks/*.ts` (es. `useTransactions.ts:16,40,69,88`,
`usePortfolio.ts:18,19,63,77`, `useCouplePairStatus.ts` 8 occorrenze, `useLibraryItems.ts`,
`useSavingsGoals.ts`, `useBudgets.ts`, `useRecurringExpenses.ts`, `PokerRakeback.tsx` ecc.).
**Confidence:** Alta.

**Problema.** Pattern:
```ts
const { data } = useQuery({
  queryKey: ['transactions', user?.id],
  queryFn: async () => {
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user!.id)   // ← non-null assertion
    ...
  },
  enabled: !!user,
});
```
L'`enabled: !!user` garantisce che `queryFn` non venga chiamato se `user` è null, quindi il `!`
è "sicuro" oggi. Ma è un invariant implicito: se qualcuno (a) rimuove `enabled`, (b) estrae il
`queryFn` in una funzione standalone, oppure (c) copia il pattern in un `useEffect` senza guard,
si ottiene un `TypeError: Cannot read properties of null` silenzioso.

**Evidence.** In `useTransactions.ts:16` si usa `user.id` (senza `!`) perché `strictNullChecks`
è off in radice; nello stesso file riga 40 si usa `user!.id`. L'inconsistenza nello stesso file
è segnale che il pattern non è sistematizzato.

**Raccomandazione.** Introdurre un piccolo helper che restituisca `user` non-null o lanci:
```ts
function useAuthUser() {
  const { user } = useAuth();
  if (!user) throw new Error('useAuthUser called without authenticated user');
  return user; // tipo: User (non null)
}
```
Tutti i data hook possono usare `useAuthUser()` dentro il `queryFn` (che è già protetto da `enabled`).
Questo rende l'invariant esplicito e robusto al refactor.

**Sforzo:** 2 giorni (1 gg per l'helper + sostituzione meccanica, 1 gg per test).
**Rischi:** bassi.
**Validazione:** `typecheck` verde, test esistenti verdi, smoke test delle pagine principali.

---

### 4.2 Architettura e duplicazione

#### TD-007 — Triplicazione pagine libreria

**Categoria:** Maintainability / Code duplication
**Location:** `src/pages/libreria/Libri.tsx` (435 righe), `Fumetti.tsx` (413), `Manga.tsx` (465).
**Confidence:** Alta (confronto diretto).

**Problema.** I tre file implementano la stessa pagina CRUD per la tabella `library_items` con
filtro per `category`. Lo state (15 `useState` identici), i `useMemo` per filtri (autore/editore/anno),
il dialog di add con ricerca Google Books, il dialog di edit, la lista, le stats
(investimento/reselling/P&L) sono copiati. Differiscono solo:
- `category: 'libri' | 'fumetti' | 'manga'`
- funzione di ricerca (`searchGoogleBooks` con subject diverso)
- label localizzate ("Libro" / "Fumetto" / "Manga", placeholder)

**Evidence.** Confronto riga-per-riga di `Libri.tsx` e `Fumetti.tsx`: identici dal rigo 14 al 413,
eccetto `category`, etichette e `searchFumetti` vs `searchGoogleBooks`. Circa 1.200 righe sono
duplicazione di logica.

**Conseguenze.** Un bug fix (es. validazione importo) va applicato 3 volte. Aggiungere una quarta
categoria (es. "Vinili") richiede copiare 430 righe. Le tre copie divergeranno nel tempo.

**Raccomandazione.** Estrarre un componente `<LibraryCategoryPage config={...} />` parametrizzato
da un config object (categoria, labels, funzione di ricerca), analogo a quanto già fatto per la
pagina fumo con `FumoCrudPage` (che è il buon esempio da seguire — vedi `src/components/fumo/FumoCrudPage.tsx`).
Tre file da ~430 righe → 1 componente da ~350 righe + 3 file "thin wrapper" da ~15 righe come
`FumoCBD.tsx`.

**Piano incrementale:**
1. Aggiungere characterization test (snapshot del DOM renderizzato) per le 3 pagine esistenti,
   per bloccare la regressione durante il refactor.
2. Estrarre il componente parametrico, mantenendo i 3 wrapper.
3. Eseguire i 3 wrapper via E2E esistente o nuovo.

**Sforzo:** 2 giorni-developer.
**Rischi:** basso-medio (modifica UI); mitigato dal characterization test.
**Validazione:** test visivi/E2E su `/libreria/libri`, `/libreria/fumetti`, `/libreria/manga`;
verifica che add/edit/delete/filtri funzionino identici.

---

#### TD-008 — Pagine Poker CRUD ripetute

**Categoria:** Maintainability / Type safety
**Location:** `PokerHourlyEarnings.tsx` (545), `PokerRakeback.tsx` (481), `PokerNextCut.tsx` (457).
**Confidence:** Alta.

**Problema.** Le tre pagine condividono lo scheletro: `useSupabaseData` + `useYearlyData` +
gestione stati di add/edit + `as any` sul nome tabella + card annuale. Sono meno identiche delle
pagine libreria (i campi business differiscono) ma il 60-70% della struttura è condiviso.

**Raccomandazione.** Valutare l'estrazione di un `usePokerYearlyCrud<T>` hook che incapsuli
`useSupabaseData` + `useYearlyData` + stati edit. Priorità più bassa rispetto a TD-007 (le pagine
sono più dissimili) ma da pianificare insieme alla risoluzione di TD-001 (che eliminerebbe i
cast `as any`).
**Sforzo:** 3 giorni.

---

#### TD-006 — Codice scaffold morto + index pages duplicate

**Categoria:** Maintainability / Dead code
**Location:** `src/pages/Index.tsx` (template "Blank App" mai routato), `src/pages/Poker.tsx` ≈ `src/pages/Fumo.tsx`.
**Confidence:** Alta.

**Problema.**
- `src/pages/Index.tsx` è il template di partenza del progetto Vite/Lovable ("Welcome to Your
  Blank App") e **non è referenziato** in `App.tsx` (la rotta `/` punta a `Dashboard`). È codice
  morto incluso però nel bundle se importato altrove, e confonde chi cerca "la home".
- `Poker.tsx` e `Fumo.tsx` sono entrambi un grid di 3 card-link con la stessa struttura e classi
  Tailwind identiche; differiscono solo per icone e label. Estraibile in un `<FeatureIndexGrid items={...} />`.

**Raccomandazione.**
1. Cancellare `src/pages/Index.tsx` (verificare con `grep -rn "pages/Index" src` che non sia
   importato — al momento non lo è).
2. Estrarre un componente `<FeatureHubGrid>` per le pagine-index di Poker/Fumo (e未来 tcg/libreria).

**Sforzo:** 1 giorno.
**Rischi:** minimi.
**Validazione:** `npm run build` verde, navigazione `/poker`, `/fumo` visivamente invariata.

---

#### TD-013 — Logica recurring expenses duplicata client + Edge Function

**Categoria:** Architecture / Performance
**Location:** `src/hooks/useRecurringExpenses.ts:124-194` (`processDueExpenses`) vs
`supabase/functions/process-recurring-expenses/index.ts`.
**Confidence:** Medio (lato client osservabile; lato EF da inventariare).

**Problema.** `processDueExpenses` nel client fa un loop N+1: per ogni spesa dovuta esegue una
SELECT (idempotency check) + INSERT + UPDATE in sequenza. Esiste già un Edge Function omonima
che presumibilmente dovrebbe svolgere questo compito lato server (atomicamente, via cron).
Avere entrambe le implementazioni è rischioso: race condition se chiamate concorrenti,
transazioni parziali in caso di errore a metà loop.

**Raccomandazione.**
1. Verificare se l'Edge Function è la fonte di verità (cron-triggered) e rimuovere
   `processDueExpenses` dal client, oppure documentare perché serve il path client.
2. Se il path client resta, almeno batch delle INSERT e usare una transazione/RPC atomica
   per evitare duplicati.

**Sforzo:** 2 giorni (1 inventario + 1 consolidation).
**Validazione:** test di idempotenza: chiamare due volte `processDueExpenses` senza nuove spese
e verificare 0 transazioni create; E2E su `/recurring`.

---

### 4.3 Reliability / Async

#### TD-004 — `QueryClient` senza `defaultOptions`

**Categoria:** Reliability / Performance
**Location:** `src/App.tsx:52`.
**Confidence:** Alta.

**Problema.** `const queryClient = new QueryClient();` senza opzioni. I default di react-query 5
sono: `staleTime: 0`, `refetchOnWindowFocus: true`, `retry: 3`. Con `staleTime: 0`, ogni montaggio
di componente triggera un refetch Supabase; con 40+ hook che fanno `useQuery`, l'app è "chatty".

**Evidence.** Nessun `defaultOptions` in nessun file di configurazione.

**Conseguenze.** Latenza percepita, carico inutile sul Supabase (che ha quota), possibili flicker
UI e, in casi limite, race tra refetch concorrenti.

**Raccomandazione.**
```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,           // 30s: bilanciato per dati finanziari
      retry: 1,
      refetchOnWindowFocus: false, // o 'always' solo per query critiche
    },
  },
});
```

**Sforzo:** 0.5 giorni.
**Rischi:** basso (dati leggermente più "vecchi" per 30s).
**Validazione:** test manuali su Dashboard/Transactions; monitorare il numero di richieste Supabase.

---

#### TD-012 — Edge Functions con tipi deboli

**Categoria:** Type safety / Operability
**Location:** `supabase/functions/update-prices/index.ts` (linee 1, 4, 10, 209, 221-226, 402, 425);
simile in altre 4 EF.
**Confidence:** Alta.

**Problema.** Le EF Deno usano `@ts-ignore` per `Deno` e `req: any`, `assets as Asset[]` (cast),
`cashAssets as any[]`. La logica è finanziaria (prezzi di mercato, forex) e gira con
`SUPABASE_SERVICE_ROLE_KEY` (privilegi elevati). Parsing del body JWT manuale, errori a runtime
possibili su payload malformati.

**Raccomandazione.**
1. Aggiungere un `deno.json` con `import_map.json` e tipi `@types/deno` (o usare
   `// @ts-nocheck` documentato in cima, ma meglio tipizzare).
2. Definire tipi per le richieste (`UpdatePricesRequest`, `Asset`) e validare con zod o parse manuale.
3. Centralizzare i CORS headers in un `_shared/cors.ts`.

**Sforzo:** 2 giorni (per le 5 EF).
**Rischi:** medio (modifica a codice che gira in prod con service role).
**Validazione:** test manuali di `update-prices` (manuale + via cron-secret), check log Supabase.

---

### 4.4 Security / Trust boundary

#### TD-005 — Permessi utente in `localStorage` usati per routing

**Categoria:** Security (minore) / Reliability
**Location:** `src/hooks/usePermissions.ts:32-53`, `src/App.tsx:73-96`.
**Confidence:** Medio-Alta.

**Problema.** `usePermissions` inizializza lo state da `localStorage` (`PERMISSIONS_STORAGE_KEY`)
e `PermissionRoute` usa quello stato per decidere se renderizzare la pagina protetta o redirectare
a `/`. Fino a che la query DB non risolve, il routing si basa sul dato in localStorage — che è
modificabile dal client. Se un utente manipola `localStorage.spendy_permissions` impostando
`admin: true`, vedrà temporaneamente la rotta `/admin` renderizzata (le chiamate API vere
falliranno per RLS, ma la UI/caricamento dei componenti avviene).

**Evidence.** `validatePermissions` in `usePermissions.ts:11-28` accetta qualsiasi oggetto con
almeno una delle chiavi note — non c'è firma o check lato server del dato cached. Il commento nel
codice ammette il compromesso.

**Conseguenze.** Information leak minore (l'utente vede la UI admin/poker/fumo anche se non autorizzato,
finché la query DB risponde con `false` e avviene il redirect). Non è una vulnerabilità di dati
(RLS protegge), ma è un anti-pattern per UI di sezioni sensibili.

**Raccomandazione.**
1. Considerare `permissionsLoading: true` come default (non `false` come oggi) finché il dato DB
   non arriva — così `PermissionRoute` mostra `LoadingScreen` invece della rotta.
2. In alternativa, non precaricare da localStorage per le route guard: usarlo solo come cache
   display (es. per mostrare/nascondere voci di menu), non per autorizzare l'accesso.

**Sforzo:** 1 giorno.
**Rischi:** bassi.
**Validazione:** test manuale: pulire `localStorage`, navigare a `/admin` come non-admin →
`LoadingScreen` poi redirect; test con `localStorage` manipolato → stesso comportamento.

---

#### TD-015 — Variabili d'ambiente non validate

**Categoria:** Operability
**Location:** `src/integrations/supabase/client.ts:5-6`, `src/hooks/useAuth.tsx:165`.
**Confidence:** Alta.

**Problema.**
```ts
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, ...);
```
Se le env sono mancanti, `createClient(undefined, undefined)` non fallisce qui: fallisce con
errori criptici alla prima chiamata. Idem `VITE_SITE_URL`.

**Raccomandazione.** Validare all'avvio:
```ts
function requiredEnv(name: string): string {
  const v = import.meta.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}
```
**Sforzo:** 0.5 giorni.
**Validazione:** build con env mancante → errore chiaro all'avvio.

---

### 4.5 Testing

#### TD-016 — Copertura assente su data layer e pagine

**Categoria:** Testing
**Location:** 0 test su `src/hooks/*` (40+ hook), 0 test su `src/pages/*` (40+ pagine).
**Confidence:** Alta.

**Problema.** La logica pura è ben testata: 15 suite in `src/lib/*.test.ts` (couple, csv, fire,
fumo, insights, mfa, netWorth, password, recurringDetection, statistics, userAgent, utils).
Ma non esiste un test che verifichi l'integrazione hook↔Supabase né il rendering di alcuna pagina.
Refactor come TD-007/TD-008 sarebbero "alla cieca".

**Raccomandazione.** Prima di TD-007, aggiungere characterization test minimi:
- 1 test per pagina libreria (rendering con dati mock, snapshot del DOM chiave).
- 1 test per `useTransactions`/`usePortfolio` con mock di `supabase` (msw o vi.mock).
Questi, oltre a proteggere il refactor, documentano il comportamento atteso.

**Sforzo:** 4 giorni (prioritizzato sulle pagine da refactorare).
**Rischi:** nessuno; solo beneficio.
**Validazione:** copertura `src/hooks` > 0, `src/pages` > 0.

---

### 4.6 Maintainability varia

#### TD-009 — Interfaccia `UserPermissions` deprecata e duplicata

**Categoria:** Dead code / Type safety
**Location:** `src/lib/types.ts:26` e `src/lib/types.ts:112` (entrambe `export interface UserPermissions`,
entrambe `@deprecated`); `src/lib/permissions.ts:193` riesporta come `UserPermissionsDeprecated`.
**Confidence:** Alta.

**Problema.** La stessa interfaccia è dichiarata due volte nello stesso file con campi diversi
(la prima ha 5 chiavi, la seconda 3). TypeScript usa l'ultima dichiarazione (declaration merging
non si applica perché le firme differiscono). Questo è confuso e il `@deprecated` non è enforcing.

**Raccomandazione.** Cancellare entrambe le dichiarazioni `UserPermissions` e l'export
`UserPermissionsDeprecated` (verificare con `grep` che nessun codice le importi realmente —
al momento solo `permissions.ts` le importa ma non le usa).

**Sforzo:** 0.5 giorni.
**Validazione:** `typecheck` verde, `grep -rn UserPermissions src` restituisce 0 usi.

---

#### TD-010 — Typo `tgc_cards` vs feature "tcg"

**Categoria:** Naming / Consistency
**Location:** tabella `tgc_cards` (`supabase/migrations/20260106170000_create_tgc_cards_table.sql`,
`src/lib/constants.ts:94`), ma ovunque altrove `tcg` (`PermissionKey='tcg'`, `TcgGame`, `TcgCard`,
`TCG_GAME_LABELS`, cartelle `src/pages/tcg/`, `src/components/tcg/`).
**Confidence:** Alta.

**Problema.** Incongruenza storica di naming: la tabella si chiama `tgc_cards` ma tutto il
codebase usa `tcg`. Non causa bug (gli RPC/RLS usano il nome corretto), ma ostacola la ricerca
grep e confonde.

**Raccomandazione.** Bassa priorità: rinominare la tabella in una migration `ALTER TABLE
tgc_cards RENAME TO tcg_cards` + aggiornare le ~5 occorrenze. Da fare in una finestra di
manutenzione DB.
**Sforzo:** 2 giorni (migrazione + test).
**Rischi:** medio (rinomina tabella); mitigato da un rename + vista compatibile `tgc_cards`.

---

#### TD-011 — `console.*` sparsi

**Categoria:** Operational / DX
**Location:** 46 occorrenze; peggiori in `src/hooks/useCategories.ts` (logga dati utente),
`src/components/settings/*ImportDialog.tsx`, Edge Function `update-prices`.
**Confidence:** Alta.

**Problema.** Log di debug in produzione. In `useCategories.ts:29` si logga
`'Creazione categoria:', { ...category, user_id: user.id }` — ID utente in console browser.

**Raccomandazione.**
1. Rimuovere i `console.log` di debug (lasciare `console.error` nei catch gestiti).
2. In `useCategories.ts` rimuovere i log con `user_id`.
3. Nelle EF, ridurre il livello di verbosità (log solo errori + summary finale).

**Sforzo:** 1 giorno.
**Rischi:** nessuno.
**Validazione:** `grep -rn "console\." src | wc -l` ≤ 10 (solo errori gestiti).

---

#### TD-017 — Documentazione stato refactor

**Categoria:** Documentation
**Location:** `plans/REVISIONE_CODICE_ROUND2_2026-07-03.md`, `src/App.tsx:56` (commento storico).
**Confidence:** Medio.

**Problema.** Esistono piani di revisione in `plans/` che documentano refactor in corso
(es. `REF-01` citato in `FumoCrudPage.tsx:56`). Lo stato corrente non è riassunto nel README.
Per un nuovo contributor è non ovvio cosa è "stato fatto" vs "da fare".

**Raccomandazione.** Aggiungere una sezione "Stato del refactor" nel README o un ADR breve.
**Sforzo:** 0.5 giorni.

---

## 5. Roadmap di remediation (in fasi)

### Fase 0 — Salvaguardie immediate (entro 1 settimana)

Costo basso, valore immediato, nessun rischio di regressione.

| ID | Azione | Sforzo |
|---|---|---|
| TD-015 | Validare env all'avvio (`requiredEnv`) | 0.5 gg |
| TD-011 | Rimuovere `console.log` di debug (specie `useCategories.ts`) | 0.5 gg |
| TD-006 | Cancellare `src/pages/Index.tsx` (codice morto) | 0.1 gg |
| TD-009 | Cancellare le 2 `interface UserPermissions` duplicate | 0.5 gg |

**Validazione fase 0:** `npm run build && npm run typecheck && npm test && npm run lint` tutti verdi;
build con env mancante fallisce con messaggio chiaro; `grep UserPermissions src` vuoto.

### Fase 1 — Quick win type safety (1-2 sprint)

| ID | Azione | Sforzo |
|---|---|---|
| TD-001 | Rigenerare `src/integrations/supabase/types.ts` e rimuovere i 35 `as any` | 2 gg |
| TD-004 | Configurare `QueryClient` `defaultOptions` | 0.5 gg |
| TD-005 | `permissionsLoading` default `true` per evitare leak UI | 1 gg |
| TD-003 | Introdurre `useAuthUser()` ed eliminare `user!.id` sistematici | 2 gg |

**Dipendenze:** TD-001 va fatto prima di TD-003 (i tipi generati cambiano le firme dei data hook).
**Validazione fase 1:** `typecheck` verde; `grep -rn "as any" src \| wc -l` ≤ 5;
E2E `guarded-routes.auth.spec.ts` e `transactions.auth.spec.ts` verdi; nessun warning in console
per permessi non validi.

### Fase 2 — Strutturale medio termine (2-4 sprint)

| ID | Azione | Sforzo |
|---|---|---|
| TD-016 | Aggiungere characterization test per pagine libreria + 2 data hook | 4 gg |
| TD-007 | Estrarre `<LibraryCategoryPage>` e ridurre 3 file a 3 wrapper | 2 gg |
| TD-008 | Estrarre `usePokerYearlyCrud<T>` (post TD-001) | 3 gg |
| TD-013 | Consolidare recurring expenses (client vs EF) | 2 gg |
| TD-002 | Abilitare `strict` in `tsconfig.app.json` per step | 3 gg |

**Dipendenze:** TD-007 dipende da TD-016 ( characterization test prima del refactor).
TD-002 (strict) va fatto dopo TD-001/TD-003 per non essere sommersi di errori.
**Validazione fase 2:** copertura test `src/pages/libreria/*` > 0; refactor libreria visivamente
invariato (E2E); `tsc --noEmit` verde con `strict: true`.

### Fase 3 — Lungo termine / modernizzazione (oltre 4 sprint)

| ID | Azione | Sforzo |
|---|---|---|
| TD-012 | Tipizzare Edge Functions (deno.json + zod validation) | 2 gg |
| TD-010 | Rinominare `tgc_cards` → `tcg_cards` (migration) | 2 gg |
| TD-014 | Validazione runtime (zod) sui risultati Supabase ai boundary | 3 gg |
| TD-017 | Documentare stato refactor / ADR | 0.5 gg |
| TD-006 (parte 2) | Estrarre `<FeatureHubGrid>` per index pages | 1 gg |

**Validazione fase 3:** EF tipizzate senza `@ts-ignore`; migration DB applicata senza downtime;
test di confine con payload Supabase alterati.

---

## 6. Debito accettato / differito

| Item | Motivo del rinvio | Condizione di riapertura |
|---|---|---|
| shadcn/ui kit (`src/components/ui/*`, ~30 file, ~6.000 righe) | Codice generated/venduto; modificarlo rompe l'upgrade path | Solo se si migra a un altro design system |
| `package-lock.json` da 306 KB (dipendenze transitive pesanti: recharts, radix) | Necessario per il feature set | Se il bundle size diventa problema (oggi non misurato) |
| Tipi RPC `delete_session`/`get_active_sessions`/`accept_couple_request` non in `Database.Functions` | Sarà chiuso da TD-001 (rigenerazione) | Se TD-001 viene posticipato > 2 sprint |
| Logica SQL/RLS non auditata | Fuori scope (audit TS) | Aprire audit DB separato prima di refactor architetturali |
| `papaparse` senza tipi sulle risposte parse | Libreria legacy ma stabile; impatto basso | Se si introducono formati CSV nuovi |

---

## 7. Note metodologiche e caveati

- **Severity vs. sforzo:** TD-001 e TD-002 sono "critici" per impatto ma a sforzo medio-basso:
  sono il best ROI del report. TD-016 (testing) è "medio" severity ma prerequisito per altri
  refactor sicuri.
- **Nessun cambio comportamentale richiesto** in questo audit: tutte le raccomandazioni
  preservano il comportamento runtime (eccetto dove esplicitato, es. `staleTime` di react-query).
- **Metriche non disponibili:** non è stata misurata la copertura di test effettiva (vitest
  coverage non configurato in `vitest.config.ts`) né il bundle size. Raccomandato aggiungerli
  al CI come baselines.
- Il report si basa su lettura statica; le raccomandazioni su Edge Functions (TD-012) e recurring
  (TD-013) richiedono conferma del comportamento runtime lato server prima di applicarle.

---

*Fine del report.*
