# Correzione dell'audit web — 26 ottobre 2026

L'audit iniziale segnalava 6 dipendenze high e 5 moderate. L'aggiornamento di `package.json` e `package-lock.json` porta l'audit npm a zero segnalazioni. Non cambia il contratto delle API o il calcolo delle spese.

| Dipendenza | Prima | Dopo | Avviso principale |
|---|---|---|---|
| brace-expansion | 1.1.18, 2.1.4 | 1.1.21, 2.1.7 | [Ricorsione non limitata](https://github.com/advisories/GHSA-qhr7-859c-m2p7) |
| js-yaml | 4.3.1 | 4.3.2 | [Consumo CPU durante il merge](https://github.com/advisories/GHSA-2883-xcg3-v3hh) |
| source-map-js | 1.2.1 | 1.2.2 | [Offset delle source map](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) |
| undici | 8.10.0 | 8.12.3 | [Gestione dei content-encoding](https://github.com/advisories/GHSA-xjj6-f33q-929c) |
| vite | 8.1.2 | 8.3.5 | [Esecuzione di comandi tramite launch-editor su Windows](https://github.com/advisories/GHSA-587h-7wmj-h5pm) |
| zod | 4.4.3 | 4.6.7 | [Memoria durante la validazione delle collezioni](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) |

Risolte anche le segnalazioni moderate: `@humanfs/node` passa da 0.16.6 a 0.16.8, Vitest e `@vitest/mocker` da 4.1.9 a 4.1.12, `postcss-selector-parser` da 6.0.10 a 6.1.5. Le versioni minime dichiarate di Vite, Vitest e Zod sono alzate a quelle installate.

Typography 0.5.20 richiede esattamente il parser 6.0.10. Un override limitato a questa dipendenza seleziona il parser corretto della stessa serie 6.x, evitando il downgrade di Typography proposto dal fix forzato. Rimuovere l'override quando Typography richiederà una versione corretta del parser. [Avviso del parser](https://github.com/advisories/GHSA-rj75-hqrm-r3gf).

`brace-expansion`, `js-yaml`, `source-map-js`, Undici e Vite appartengono alle dipendenze di sviluppo, test o build. La copia npm di Undici arriva da jsdom; il backend usa il `fetch` del runtime Node. Zod è usato anche dalle API e dai decoder dell'applicazione. Questa distinzione non riduce il criterio di verifica: l'audit comprende entrambe le classi di dipendenze.

## Riproduzione

```powershell
npm ci
npm audit --audit-level=low
npm run typecheck
npm run lint
npm run test:forecast-runtime
node node_modules/vitest/vitest.mjs run --pool=threads --maxWorkers=2
npm run build
```

Il comando di correzione del vecchio npm globale 11.1.0 falliva nel resolver dei peer con `Cannot read properties of null (reading 'edgesOut')`. Le modifiche sono state prodotte con npm 11.17.0 incluso in Node 24.19.0, senza aggiornare il tool globale e senza usare `--force`. Il checkout di rilascio usa un proprio `node_modules`; l'installazione del ramo di ricerca è rimasta invariata.

Verifiche locali superate: audit completo con zero segnalazioni, 347 test unitari con un test live opzionale saltato, TypeScript, lint, import ESM della funzione server, build e 11 prove Playwright su server locale isolato. La prima suite unitaria, eseguita insieme a build e browser, aveva un timeout di 5 secondi nel form Categorie; la suite completa successiva, eseguita da sola con un worker, supera tutti i test senza modificare timeout o asserzioni.

La CI e il controllo remoto dopo la pubblicazione completano la verifica del rilascio. Zero segnalazioni npm significa che il database degli avvisi non rileva vulnerabilità nelle versioni risolte alla data del controllo; non equivale a una verifica completa della sicurezza dell'applicazione.
