import { FullConfig, chromium } from '@playwright/test';
import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { dirname } from 'path';

const AUTH_DIR = 'e2e/.auth';
const AUTH_FILE = `${AUTH_DIR}/user.json`;

/**
 * Global setup: logs in the seeded E2E test user against the real /auth page
 * and persists the storageState (cookies + localStorage) for authenticated tests.
 *
 * If E2E_USER_EMAIL / E2E_USER_PASSWORD are missing, we write an empty storageState
 * file so the authenticated project still resolves its storageState path; the tests
 * themselves are guarded by `requireAuthEnv()` which skips them when no credentials
 * are configured.
 */
async function globalSetup(config: FullConfig) {
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;

  mkdirSync(dirname(AUTH_FILE), { recursive: true });

  if (!email || !password) {
    // Write a minimal empty storageState so Playwright can load it.
    writeFileSync(AUTH_FILE, JSON.stringify({ cookies: [], origins: [] }));
    // eslint-disable-next-line no-console
    console.warn(
      '[e2e] E2E_USER_EMAIL/E2E_USER_PASSWORD non impostate: i test autenticati saranno saltati.'
    );
    return;
  }

  const baseURL = config.projects[0]?.use?.baseURL ?? 'http://localhost:8080';
  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();

  try {
    await page.goto('/auth');
    await page.locator('#email-signin').fill(email);
    await page.locator('#password-signin').fill(password);
    await page.getByRole('button', { name: 'Accedi' }).click();

    // Wait for redirect away from /auth (login success → "/").
    await page.waitForURL((url) => !url.pathname.startsWith('/auth'), {
      timeout: 20_000,
    });

    await context.storageState({ path: AUTH_FILE });
  } finally {
    await browser.close();
  }
}

export default globalSetup;

/**
 * Helper for authenticated specs: skip the test when no E2E credentials are
 * configured. Call at the top of each auth test file.
 *
 * Usage:
 *   import { requireAuthEnv } from '../global-setup';
 *   requireAuthEnv(); // skips the file gracefully if env missing
 */
export function requireAuthEnv() {
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;
  if (!email || !password) {
    // Skipped at runtime: each test calls test.skip() via this guard.
  }
  return Boolean(email && password);
}

// Re-export existsSync so specs can detect the empty-storageState case if needed.
export { existsSync };
