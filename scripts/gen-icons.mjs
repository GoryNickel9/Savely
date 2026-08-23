#!/usr/bin/env node
// Genera le icone PWA (PNG) da scripts/icon.svg via screenshot Playwright.
// L'SVG è incorporato in un wrapper HTML per controllare centratura e scala
// (la resa diretta dei file .svg è instabile da manipolare via DOM).
// Uso: node scripts/gen-icons.mjs
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const svg = readFileSync(resolve('scripts/icon.svg'), 'utf8');

const sizes = [
  ['public/icon-192.png', 192, 1],
  ['public/icon-512.png', 512, 1],
  // maskable: icona all'80% centrata su sfondo pieno (zona sicura del cerchio)
  ['public/icon-maskable-512.png', 512, 0.8],
  ['public/apple-touch-icon.png', 180, 1],
];

const html = (size, scale) => `<!doctype html><html><head><style>
  html,body{margin:0;padding:0;width:${size}px;height:${size}px;background:#0C0816;
  display:flex;align-items:center;justify-content:center;overflow:hidden}
  svg{width:${Math.round(size * scale)}px;height:${Math.round(size * scale)}px;display:block}
</style></head><body>${svg}</body></html>`;

const browser = await chromium.launch();
for (const [out, size, scale] of sizes) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(html(size, scale));
  await page.screenshot({ path: out });
  await page.close();
  console.log(`✓ ${out} (${size}x${size}, scala ${scale})`);
}
await browser.close();
