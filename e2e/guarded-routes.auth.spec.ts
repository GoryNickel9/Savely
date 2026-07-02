import { test, expect } from '@playwright/test';
import { requireAuthEnv } from './global-setup';

const hasCredentials = requireAuthEnv();

/**
 * Route-guard tests: a user without a given permission must be redirected.
 * The seeded E2E user should NOT have the `poker` permission (see e2e/seed.sql).
 */
test.describe('Route guard sui permessi', () => {
  test.skip(!hasCredentials, 'E2E_USER_EMAIL/PASSWORD non configurate');

  test('utente senza permesso poker viene rimbalzato da /poker', async ({ page }) => {
    await page.goto('/poker');
    // Guard redirects unauthorized users to "/".
    await expect(page).toHaveURL((url) => url.pathname === '/', { timeout: 10_000 });
  });

  test('utente senza permesso tcg viene rimbalzato da /tcg/magic', async ({ page }) => {
    await page.goto('/tcg/magic');
    await expect(page).toHaveURL((url) => url.pathname === '/', { timeout: 10_000 });
  });
});
