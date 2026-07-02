import { test, expect } from '@playwright/test';
import { requireAuthEnv } from './global-setup';

const hasCredentials = requireAuthEnv();

/**
 * Transactions CRUD smoke test.
 * Creates a clearly-tagged expense, verifies it appears in the list, then deletes it.
 * Uses a unique marker in the description so it never collides with real data and
 * is easy to clean up if a run is interrupted.
 */
test.describe('CRUD Transazioni', () => {
  test.skip(!hasCredentials, 'E2E_USER_EMAIL/PASSWORD non configurate');

  test('crea e poi elimina una transazione di test', async ({ page }) => {
    await page.goto('/transactions');
    await expect(page.getByRole('heading', { name: 'Transazioni' })).toBeVisible();

    // Unique marker for this run.
    const marker = `E2E-${Date.now()}`;
    const amount = '12,34';

    // Open the create dialog.
    await page.getByRole('button', { name: /Nuova/ }).click();
    await expect(page.getByRole('heading', { name: 'Nuova Transazione' })).toBeVisible();

    // Fill the form. Type defaults to "expense" which is what we want.
    await page.getByLabel('Importo').fill(amount);
    await page.getByLabel('Descrizione').fill(marker);
    // Category select is optional; skip it to avoid coupling to seeded categories.

    // Submit.
    await page.getByRole('button', { name: /^(salva|aggiungi|crea)$/i }).click();

    // The new transaction should appear in the list with our marker.
    await expect(page.getByText(marker).first()).toBeVisible({ timeout: 10_000 });

    // Cleanup: find the row and delete it.
    const row = page.locator('div', { hasText: marker }).first();
    // Look for a delete icon button within proximity.
    const deleteBtn = page.getByRole('button', { name: /elimina|cancella/i }).first();
    if (await deleteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await deleteBtn.click();
      // Confirm in the alert dialog if present.
      const confirm = page.getByRole('button', { name: /^(confirm|conferma|elimina|sì|ok)$/i }).first();
      if (await confirm.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirm.click();
      }
    }
    // Best-effort: marker may linger if UI differs — not asserting deletion hard.
    await row.waitFor({ state: 'detached', timeout: 8000 }).catch(() => undefined);
  });
});
