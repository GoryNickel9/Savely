/**
 * Estrae le chiavi di traduzione i18next dal codice sorgente.
 *
 * Raccoglie:
 *  - primo argomento letterale di t('...') / i18n.t('...')
 *  - attributi i18nKey="..." (componenti <Trans>)
 *  - valori letterali di proprietà label-like (label/title/subtitle/name/...)
 *    per catturare le chiavi dinamiche definite in config/array a livello
 *    modulo e tradotte al render con t(variabile)
 *
 * Uso: node scripts/extract-i18n-keys.mjs [--strict]
 *   --strict: raccoglie solo le chiamate t()/i18nKey (audit delle chiavi usate)
 * Output: elenco JSON ordinato e deduplicato su stdout.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "src");
const STRICT = process.argv.includes("--strict");

const T_CALL = /(?<![\w$.])t\s*\(\s*(['"])((?:\\.|(?!\1).)*)\1|(?<![\w$])i18n\.t\s*\(\s*(['"])((?:\\.|(?!\3).)*)\3/g;
const I18N_KEY = /\bi18nKey=\{?\s*(['"])((?:\\.|(?!\1).)*)\1/g;
const PROP_LIKE = /\b(?:label|title|subtitle|description|totalLabel|emptyText|placeholder|tooltip|message|name)\s*[:=]\s*(['"])((?:\\.|(?!\1).)*)\1/g;

function unescape(s) {
  return s
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\`/g, "`")
    .replace(/\\n/g, "\n")
    .replace(/\\\\/g, "\\");
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) yield full;
  }
}

const keys = new Set();
for (const file of walk(SRC)) {
  const src = readFileSync(file, "utf8");
  for (const re of STRICT ? [T_CALL, I18N_KEY] : [T_CALL, I18N_KEY, PROP_LIKE]) {
    for (const m of src.matchAll(re)) {
      const raw = m[2] ?? m[4];
      const key = unescape(raw).trim();
      // salta chiavi chiaramente non traducibili (classi css, sole cifre, vuote)
      if (!key || /^\d+([.,]\d+)?$/.test(key)) continue;
      if (/^[a-z0-9-]+(?:__[a-z0-9-]+)?$/.test(key) && key.length < 15) continue; // es. classi/id css
      keys.add(key);
    }
  }
}

process.stdout.write(JSON.stringify([...keys].sort((a, b) => a.localeCompare(b, "it")), null, 2));
