import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Spendy Cloud.
 *
 * E2E tests authenticate against the real Supabase project using a seeded
 * dedicated test user. Credentials are provided via env vars:
 *   E2E_USER_EMAIL, E2E_USER_PASSWORD
 * If missing, auth-dependent tests are skipped (see e2e/global-setup.ts).
 *
 * The app dev server runs on port 8080 (see vite.config.ts).
 */
const PORT = 8080;
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: { timeout: 7_000 },

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  projects: [
    // Authenticated tests — use storageState saved by global setup.
    {
      name: 'authenticated-chromium',
      testMatch: /.*\.auth\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
    },
    // Public tests — no auth required.
    {
      name: 'public-chromium',
      testMatch: /.*\.public\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],

  globalSetup: './e2e/global-setup',

  webServer: {
    command: 'npm run dev',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !isCI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
