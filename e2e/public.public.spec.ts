import { test, expect } from '@playwright/test';

/**
 * Public-route smoke tests (no authentication required).
 * Matches project "public-chromium" (file name suffix `.public.spec.ts`).
 */
test.describe('Rotte pubbliche', () => {
  test('la pagina di autenticazione renderizza il form di login', async ({ page }) => {
    await page.goto('/auth');
    await expect(page.locator('#email-signin')).toBeVisible();
    await expect(page.locator('#password-signin')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Accedi' })).toBeVisible();
  });

  test('la pagina Privacy è raggiungibile', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page).toHaveURL(/\/privacy$/);
  });

  test('la pagina Cookie è raggiungibile', async ({ page }) => {
    await page.goto('/cookies');
    await expect(page).toHaveURL(/\/cookies$/);
  });

  test('la pagina Termini è raggiungibile', async ({ page }) => {
    await page.goto('/terms');
    await expect(page).toHaveURL(/\/terms$/);
  });

  test('una rotta inesistente mostra NotFound', async ({ page }) => {
    await page.goto('/questa-rotta-non-esiste');
    await expect(page.locator('body')).toContainText(/404|non trovata|not found/i);
  });

  test('la dashboard rimbalza su /auth da non autenticato', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/auth/);
  });
});
