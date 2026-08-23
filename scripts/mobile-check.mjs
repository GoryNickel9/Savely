#!/usr/bin/env node
// Screenshot mobile (375x812) delle pagine pubbliche per l'audit mobile.
// Uso: node scripts/mobile-check.mjs <output-dir>
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const outDir = process.argv[2] ?? '/tmp/mobile-shots';
mkdirSync(outDir, { recursive: true });

const routes = [
  ['auth', '/auth'],
  ['privacy', '/privacy'],
  ['reset-password', '/reset-password'],
];

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 375, height: 812 },
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});

for (const [name, path] of routes) {
  await page.goto(`http://localhost:8080${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: true });
  // Rileva overflow orizzontale (elementi più larghi del viewport)
  const overflow = await page.evaluate(() => {
    const docW = document.documentElement.scrollWidth;
    const winW = window.innerWidth;
    if (docW <= winW) return null;
    const offenders = [];
    for (const el of document.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.right > winW + 1 && r.width > 30) {
        offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} (right=${Math.round(r.right)})`);
        if (offenders.length >= 5) break;
      }
    }
    return { docW, winW, offenders };
  });
  console.log(`✓ ${name}${overflow ? ` — OVERFLOW: doc ${overflow.docW}px vs viewport ${overflow.winW}px → ${overflow.offenders.join(' | ')}` : ' — nessun overflow'}`);
}

await browser.close();
