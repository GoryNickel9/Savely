import { test, expect, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

test.setTimeout(90_000);
test.use({ navigationTimeout: 45_000 });

const bytes = Buffer.from('synthetic APK for browser verification');
const sha256 = createHash('sha256').update(bytes).digest('hex');
const tag = 'v0.1.34-alpha';
const userId = '11111111-1111-4111-8111-111111111111';
const user = { id: userId, email: 'apk-fixture@example.invalid', aud: 'authenticated', role: 'authenticated',
  app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: userId, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.fixture-signature`;

/** All Supabase calls are intercepted. This suite creates no real sessions or data. */
async function fixtures(page: Page, signedIn = true, language = 'it') {
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('https://*.supabase.co/**', async route => {
    const url = new URL(route.request().url());
    let body: unknown = [];
    if (url.pathname.endsWith('/auth/v1/user')) body = user;
    else if (url.pathname.endsWith('/auth/v1/factors')) body = { all: [], totp: [], phone: [] };
    else if (url.pathname.endsWith('/rest/v1/profiles')) body = { id: 'fixture', user_id: userId, permissions: {}, default_currency: 'EUR', language, full_name: 'APK Test' };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.addInitScript(({ signedIn, language, token, user }) => {
    localStorage.setItem('savely-language', language);
    if (signedIn) localStorage.setItem('sb-crqnfbahytzenisospcx-auth-token', JSON.stringify({
      access_token: token, token_type: 'bearer', refresh_token: 'fixture-refresh',
      expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user,
    }));
  }, { signedIn, language, token, user });
  await page.route('**/api/android-update?*', route => route.fulfill({ json: {
    schema: 1, tag_name: tag, draft: false, prerelease: true,
    assets: [{ name: 'Savely.apk', size: bytes.length, digest: `sha256:${sha256}`,
      browser_download_url: `https://www.savely.cc/api/android-download?tag=${tag}&sha256=${sha256}` }],
  } }));
}

for (const mobile of [false, true]) {
  test(`authenticated APK download verifies bytes on ${mobile ? 'mobile English' : 'desktop Italian'}`, async ({ page }, info) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await fixtures(page, true, mobile ? 'en' : 'it');
    let downloads = 0;
    await page.route('**/api/android-download?*', async route => {
      expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
      expect(new URL(route.request().url()).searchParams.get('sha256')).toBe(sha256);
      downloads++;
      await route.fulfill({ contentType: 'application/vnd.android.package-archive', body: bytes });
    });
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    const button = page.getByRole('button', { name: mobile ? 'Download Android APK' : 'Scarica APK Android' });
    // The settings route is lazy-loaded; wait for its UI rather than Vite's cold module compilation.
    await expect(button).toBeVisible({ timeout: 30_000 });
    const saved = page.waitForEvent('download'); await button.click();
    const download = await saved;
    expect(download.suggestedFilename()).toBe('Savely.apk');
    const path = info.outputPath('Savely.apk'); await download.saveAs(path);
    expect(createHash('sha256').update(await readFile(path)).digest('hex')).toBe(sha256);
    expect(downloads).toBe(1);
    await button.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath('android-download.png') });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('signed-out visitors are redirected to login', async ({ page }) => {
  await fixtures(page, false); await page.goto('/settings', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/auth$/);
  await expect(page.getByRole('button', { name: 'Scarica APK Android' })).toHaveCount(0);
});

test('expired sessions show a recoverable error', async ({ page }) => {
  await fixtures(page);
  await page.route('**/api/android-download?*', route => route.fulfill({ status: 401, json: { error: 'Session expired' } }));
  await page.goto('/settings', { waitUntil: 'domcontentloaded' });
  const button = page.getByRole('button', { name: 'Scarica APK Android' }); await button.click();
  await expect(page.getByRole('status').filter({ hasText: 'Accedi di nuovo per scaricare Savely.' })).toBeVisible();
  await expect(button).toBeEnabled();
});

test('corrupted APKs never trigger a browser download', async ({ page }) => {
  await fixtures(page);
  let downloaded = false; page.on('download', () => { downloaded = true; });
  await page.route('**/api/android-download?*', route => route.fulfill({ body: Buffer.alloc(bytes.length) }));
  await page.goto('/settings', { waitUntil: 'domcontentloaded' }); await page.getByRole('button', { name: 'Scarica APK Android' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Verifica del download Android non riuscita.' })).toBeVisible();
  expect(downloaded).toBe(false);
});
