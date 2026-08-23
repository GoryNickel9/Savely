#!/usr/bin/env node
// Screenshot delle pagine pubbliche per la verifica visiva della migrazione
// Tailwind 3→4 (baseline + post-migrazione). Uso:
//   node scripts/visual-check.mjs <output-dir>
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const outDir = process.argv[2] ?? '/tmp/tw-shots';
mkdirSync(outDir, { recursive: true });

const routes = [
  ['auth', '/auth'],
  ['privacy', '/privacy'],
  ['cookies', '/cookies'],
  ['terms', '/terms'],
  ['reset-password', '/reset-password'],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

for (const [name, path] of routes) {
  await page.goto(`http://localhost:8080${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: true });
  console.log(`✓ ${name}`);
}

await browser.close();
