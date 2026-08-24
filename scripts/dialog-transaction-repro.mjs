#!/usr/bin/env node
// Repro mobile del dialog "Nuova Transazione": inietta nel dialog pubblico
// /auth (stesso DialogContent condiviso) un form con la stessa struttura
// del form Transazioni (space-y-4, grid grid-cols-2, input h-9, blocco coppia,
// bottone Salva w-full) e verifica che Salva sia raggiungibile scrollando.
// Testa chromium E webkit (motore Safari) con viewport iPhone 13.
import { chromium, webkit, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:8080';
const outDir = process.argv[2] ?? 'test-results/dialog-repro';
mkdirSync(outDir, { recursive: true });

const iphone = devices['iPhone 13']; // 390x844, DPR 3, isMobile, hasTouch

const FORM_HTML = `
<form class="space-y-4">
  <div class="grid grid-cols-2 gap-2">
    <button type="button" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium h-9 px-4 bg-primary text-primary-foreground">Uscita</button>
    <button type="button" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium h-9 px-4 border border-input bg-background">Entrata</button>
  </div>
  <div class="grid grid-cols-2 gap-2">
    <div><label class="text-sm font-medium leading-none">Importo</label><input type="number" class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm mt-1.5" value="25"></div>
    <div><label class="text-sm font-medium leading-none">Valuta</label><button type="button" class="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm mt-1.5">EUR (€)</button></div>
  </div>
  <div><label class="text-sm font-medium leading-none">Categoria</label><button type="button" class="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm mt-1.5">Seleziona</button></div>
  <div><label class="text-sm font-medium leading-none">Descrizione</label><input class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm mt-1.5" value="Spesa test"></div>
  <div><label class="text-sm font-medium leading-none">Data</label><input type="date" class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm mt-1.5" value="2026-08-24"></div>
  <div class="space-y-3 p-3 rounded-lg border border-border bg-muted/30">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2"><span class="inline-block w-4 h-4 rounded bg-rose-400"></span><label class="text-sm font-medium">Condividi con il partner</label></div>
      <button type="button" class="inline-flex h-5 w-9 items-center rounded-full bg-primary"></button>
    </div>
    <div><label class="text-xs">Divisione</label><button type="button" class="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm">50 / 50</button></div>
    <div class="grid grid-cols-2 gap-2">
      <div><label class="text-xs">Quota tua (€)</label><input disabled class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value="12.50"></div>
      <div><label class="text-xs">Quota partner (€)</label><input class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value="12.50"></div>
    </div>
  </div>
  <button type="submit" class="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium h-9 w-full px-4 bg-primary text-primary-foreground">Salva</button>
</form>`;

async function run(browserType, label) {
  const browser = await browserType.launch();
  const context = await browser.newContext({ ...iphone, locale: 'it-IT' });
  const page = await context.newPage();
  await page.goto(`${BASE}/auth`, { waitUntil: 'networkidle' });
  const accept = page.getByRole('button', { name: /accetta|accept/i });
  if (await accept.count()) await accept.first().click();
  await page.getByRole('button', { name: /password dimenticata/i }).click();
  await page.waitForSelector('[role="dialog"]');

  // Sostituisce il contenuto del dialog con il form Transazioni (header escluso).
  await page.evaluate((html) => {
    const el = document.querySelector('[role="dialog"]');
    el.querySelectorAll('form, div').forEach((n) => n.remove());
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    el.appendChild(wrap.firstElementChild);
    const salva = el.querySelector('button[type="submit"]');
    salva?.setAttribute('data-testid', 'salva');
  }, FORM_HTML);
  await page.waitForTimeout(300);

  const before = await page.evaluate(() => {
    const el = document.querySelector('[role="dialog"]');
    const salva = document.querySelector('[data-testid="salva"]');
    const r = el.getBoundingClientRect();
    const s = salva.getBoundingClientRect();
    return {
      dialog: { top: r.top, bottom: r.bottom, height: r.height },
      viewportH: window.innerHeight,
      dvhSupported: CSS.supports('height', '100dvh'),
      maxHeight: getComputedStyle(el).maxHeight,
      overflowY: getComputedStyle(el).overflowY,
      scrollable: el.scrollHeight > el.clientHeight,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      salvaFullyVisible: s.top >= 0 && s.bottom <= window.innerHeight,
      salvaBottom: s.bottom,
      insideViewport: r.top >= 0 && r.bottom <= window.innerHeight,
    };
  });
  await page.screenshot({ path: `${outDir}/${label}-1-initial.png` });

  // Scroll del dialog fino in fondo (come farebbe l'utente con il dito)
  await page.evaluate(() => {
    const el = document.querySelector('[role="dialog"]');
    el.scrollTop = el.scrollHeight;
  });
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => {
    const el = document.querySelector('[role="dialog"]');
    const salva = document.querySelector('[data-testid="salva"]');
    const s = salva.getBoundingClientRect();
    return {
      scrollTop: el.scrollTop,
      salvaFullyVisible: s.top >= 0 && s.bottom <= window.innerHeight,
      salvaTop: s.top,
      salvaBottom: s.bottom,
      viewportH: window.innerHeight,
    };
  });
  await page.screenshot({ path: `${outDir}/${label}-2-scrolled.png` });
  await browser.close();

  const pass = before.scrollable && before.insideViewport && after.salvaFullyVisible;
  console.log(`\n=== ${label} ===`);
  console.log('initial:', JSON.stringify(before));
  console.log('scrolled:', JSON.stringify(after));
  console.log(pass ? 'PASS' : 'FAIL');
  return pass;
}

const chromiumOk = await run(chromium, 'chromium-iphone');
let webkitOk = true;
try {
  webkitOk = await run(webkit, 'webkit-iphone');
} catch (e) {
  console.log('webkit non disponibile:', e.message.split('\n')[0]);
}
console.log(chromiumOk && webkitOk ? '\nPASS globale' : '\nFAIL globale');
process.exit(chromiumOk && webkitOk ? 0 : 1);
