#!/usr/bin/env node
// Verifica temporanea: comportamento dialog su mobile (375x812) e desktop (1280).
// Controlla margini, bounding box dentro il viewport e scroll interno
// iniettando contenuto alto nel dialog "Recupera Password" (pubblico, senza login).
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:8080';
const outDir = process.argv[2] ?? 'test-results/dialog-check';
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();

async function run(width, height, label) {
  const page = await browser.newPage({ viewport: { width, height }, locale: 'it-IT' });
  await page.goto(`${BASE}/auth`, { waitUntil: 'networkidle' });
  const accept = page.getByRole('button', { name: /accetta|accept/i });
  if (await accept.count()) await accept.first().click();
  await page.getByRole('button', { name: /password dimenticata/i }).click();
  await page.waitForSelector('[role="dialog"]');

  const metrics = await page.evaluate(() => {
    const el = document.querySelector('[role="dialog"]');
    const r = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return {
      rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height },
      viewport: { w: window.innerWidth, h: window.innerHeight },
      overflowY: style.overflowY,
      maxHeight: style.maxHeight,
      borderRadius: style.borderRadius,
      scrollable: el.scrollHeight > el.clientHeight,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    };
  });

  await page.screenshot({ path: `${outDir}/${label}-1-open.png` });

  // Inietta contenuto alto per simulare un form lungo (es. Nuova Transazione)
  await page.evaluate(() => {
    const el = document.querySelector('[role="dialog"]');
    for (let i = 0; i < 20; i++) {
      const d = document.createElement('div');
      d.textContent = `Riga di test ${i + 1}`;
      d.style.padding = '16px';
      d.style.borderBottom = '1px solid #ccc';
      el.appendChild(d);
    }
  });
  await page.waitForTimeout(200);

  const tall = await page.evaluate(() => {
    const el = document.querySelector('[role="dialog"]');
    const r = el.getBoundingClientRect();
    return {
      insideViewport: r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth,
      scrollable: el.scrollHeight > el.clientHeight,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      rect: { top: r.top, bottom: r.bottom },
      viewportH: window.innerHeight,
    };
  });

  await page.screenshot({ path: `${outDir}/${label}-2-tall.png` });
  await page.evaluate(() => {
    const el = document.querySelector('[role="dialog"]');
    el.scrollTop = 300;
  });
  await page.screenshot({ path: `${outDir}/${label}-3-scrolled.png` });

  console.log(`\n=== ${label} (${width}x${height}) ===`);
  console.log('open:', JSON.stringify(metrics, null, 1));
  console.log('tall:', JSON.stringify(tall, null, 1));
  await page.close();
  return { metrics, tall };
}

const mobile = await run(375, 812, 'mobile');
const desktop = await run(1280, 800, 'desktop');
await browser.close();

const ok =
  mobile.tall.insideViewport && mobile.tall.scrollable &&
  desktop.tall.insideViewport && desktop.metrics.rect.width <= 512 + 1;
console.log(ok ? '\nPASS: dialog scrollabile e dentro il viewport su mobile; desktop invariato' : '\nFAIL');
process.exit(ok ? 0 : 1);
