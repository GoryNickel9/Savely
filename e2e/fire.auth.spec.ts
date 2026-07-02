import { test, expect } from '@playwright/test';
import { requireAuthEnv } from './global-setup';

const hasCredentials = requireAuthEnv();

/**
 * FIRE calculator smoke test. Requires the E2E user to have the `fire` permission.
 * If the user lacks the permission, the guard redirects to "/" and we skip.
 */
test.describe('Calcolatore FIRE', () => {
  test.skip(!hasCredentials, 'E2E_USER_EMAIL/PASSWORD non configurate');

  test('il calcolatore FIRE mostra un risultato numerico', async ({ page }) => {
    await page.goto('/fire/standard');

    // If redirected to "/" the user lacks the fire permission → skip.
    const url = page.url();
    if (url.endsWith('/') && !url.includes('/fire')) {
      test.skip(true, "l'utente E2E non ha il permesso fire");
    }

    // Wait for the page to settle and look for a currency-formatted result.
    await expect(page.locator('body')).toBeVisible();
    // The calculator renders monetary values with € — expect at least one.
    await expect(page.locator('body')).toContainText(/€|EUR|\$/, { timeout: 10_000 });
  });
});
