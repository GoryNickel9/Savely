import { budgetSpending } from '../server/budget-spending';
import type { Transaction, Budget, Category } from '../src/lib/types';
import { test, expect, type Page } from '@playwright/test';

test.use({ timezoneId: 'Europe/Rome' });

const userId = '11111111-1111-4111-8111-111111111111';
const sessionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const user = { id: userId, email: 'budget-fixture@example.invalid', aud: 'authenticated', role: 'authenticated',
  app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
const expiry = Date.parse('2027-01-01T00:00:00Z') / 1000;
const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: userId, session_id: sessionId, aal: 'aal1', amr: [], role: 'authenticated', exp: expiry })}.fixture`;
const categories = [
  { id: 'food', user_id: userId, name: 'Cibo', icon: '🍔', color: '#f97316', type: 'expense', spending_pattern: 'regular', deleted_at: null },
  { id: 'dentist', user_id: userId, name: 'Dentista', icon: '🦷', color: '#3b82f6', type: 'expense', spending_pattern: 'occasional', deleted_at: null },
];
const budgets = categories.map((category, index) => ({ id: `budget-${index}`, user_id: userId, category_id: category.id,
  category, amount: index ? 200 : 300, currency: 'EUR', month: 1, year: 2000 }));
const transactions = [250, 100, 20].map((amount, index) => ({ id: `tx-${index}`, user_id: userId, amount, currency: 'EUR', exchange_rate_eur: 1,
  category_id: categories[index]?.id ?? null, category: categories[index] ?? null, date: '2026-11-01', type: 'expense', description: null, deleted_at: null }));
const forecast = {
  schemaVersion: 2, modelVersion: 'regular180-occasional730-mean-v3', userId, timeZone: 'Europe/Rome', generatedAt: '2026-11-01T12:00:00Z', inputSha256: 'a'.repeat(64),
  budgetSpending: budgetSpending(transactions as unknown as Transaction[], budgets as unknown as Budget[], categories as unknown as Category[], '2026-11-01'),
  occasionalSpending: { startDate: '2025-12-01', endDate: '2026-11-01', months: 12, categories: [
    { categoryId: 'dentist', total: '300.00', averageMonthly: '25.00', expectedMonthly: '200.00', exceeded: false, over: '0.00' },
  ] },
  forecast: { date: '2026-11-01', historyDays: 180, available: true, spent: '370.00', scheduled: '50.00', variable: '100.00', total: '520.00',
    budget: { limit: '500.00' }, unsupportedRecurring: 0, unsupportedBudgets: 0, categories: [
      { categoryId: 'food', spent: '250.00', scheduled: '0.00', variable: '100.00', total: '350.00', budget: { limit: '300.00' } },
      { categoryId: 'dentist', spent: '100.00', scheduled: '50.00', variable: '0.00', total: '150.00', budget: { limit: '200.00' } },
      { categoryId: null, spent: '20.00', scheduled: '0.00', variable: '0.00', total: '20.00', budget: null },
    ], points: Array.from({ length: 30 }, (_, index) => ({ day: index + 1, actual: index ? null : '370.00', projected: (370 + index * 150 / 29).toFixed(2) })),
  },
};

/** Every financial/auth request is intercepted; no real login or data is created. */
async function fixtures(page: Page, language = 'it') {
  let otherActive = true;
  const disconnected: string[] = [];
  await page.clock.setFixedTime(new Date('2026-11-01T12:00:00Z'));
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('https://*.supabase.co/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let body: unknown = [];
    if (path.endsWith('/auth/v1/user')) body = user;
    else if (path.endsWith('/auth/v1/factors')) body = { all: [], totp: [], phone: [] };
    else if (path.endsWith('/auth/v1/logout')) { otherActive = false; body = {}; }
    else if (path.endsWith('/rest/v1/profiles')) body = { id: 'profile', user_id: userId, permissions: { couple_expenses: true }, couple_code: 'ABCDEFGH', default_currency: 'EUR', language, full_name: 'Fixture' };
    else if (path.endsWith('/rest/v1/categories')) body = categories;
    else if (path.endsWith('/rest/v1/transactions')) body = transactions;
    else if (path.endsWith('/rest/v1/budgets')) body = budgets;
    else if (path.endsWith('/rest/v1/couple_connections')) body = { id: 'connection', user_a: userId, user_b: 'partner', revoked_at: null };
    else if (path.endsWith('/rest/v1/couple_budgets')) body = ['Cibo', 'Vacanze insieme'].map((name, index) => ({ id: `family-${index}`, connection_id: 'connection', couple_category_name: name, amount: 300, currency: 'EUR' }));
    else if (path.endsWith('/rest/v1/shared_expenses_view')) body = ['Cibo', 'Vacanze insieme'].map((name, index) => ({
      id: `shared-${index}`, original_tx_id: `tx-${index}`, connection_id: 'connection', created_by: userId, couple_category_name: name,
      category_icon: index ? '✈️' : '🛒', date: '2026-10-15', created_at: '2026-10-15', total_amount: 100,
      currency: 'EUR', exchange_rate_eur: 1, my_share_amount: 50, creator_share_amount: 50, partner_share_amount: 50, tx_deleted_at: null,
    }));
    else if (path.endsWith('/rpc/get_active_sessions')) body = [sessionId, ...(otherActive ? [otherId] : [])].map(id => ({
      id, session_id: id, user_agent: route.request().headers()['user-agent'], created_at: '2026-10-20T12:00:00Z', ip: null,
    }));
    else if (path.endsWith('/rpc/delete_session')) { disconnected.push(route.request().postDataJSON().p_session_id); otherActive = false; body = null; }
    await route.fulfill({ status: 200, contentType: 'application/json', headers: {
      'content-range': '0-2/3', 'access-control-expose-headers': 'content-range',
    }, body: JSON.stringify(body) });
  });
  await page.route('**/api/spending-forecast', route => route.fulfill({ json: forecast }));
  await page.route('**/api/android-update?*', route => route.fulfill({ status: 503, json: {} }));
  await page.addInitScript(({ language, token, user, expiry }) => {
    localStorage.setItem('savely-language', language);
    localStorage.setItem('savely_cookie_consent', JSON.stringify({ value: 'essential', ts: Date.now() }));
    localStorage.setItem('theme', 'light');
    localStorage.setItem('sb-crqnfbahytzenisospcx-auth-token', JSON.stringify({
      access_token: token, token_type: 'bearer', refresh_token: 'fixture-refresh', expires_in: 3600, expires_at: expiry, user,
    }));
  }, { language, token, user, expiry });
  return disconnected;
}

test('budget labels, category forms and family icons use the requested presentation', async ({ page }) => {
  await fixtures(page);
  await page.goto('/budget');
  await expect(page.getByText('Spesa saltuaria', { exact: true })).toHaveCount(1);
  await expect(page.getByText(/Mediana mensile \(ultimi 730 giorni\)|Media mensile su 12 mesi|Spese regolari:/)).toHaveCount(0);
  await page.goto('/categories');
  await page.getByRole('button', { name: 'Nuova Categoria' }).click();
  await expect(page.getByRole('dialog', { name: 'Nuova Categoria' })).toBeVisible();
  await expect(page.getByText(/Per le spese saltuarie, il budget/)).toHaveCount(0);
  await page.goto('/couple-budget');
  await expect(page.getByText('🍔', { exact: true })).toBeVisible();
  await expect(page.getByText('✈️', { exact: true })).toBeVisible();
  await expect(page.getByText('Vacanze insieme', { exact: true })).toBeVisible();
  await expect(page.getByText('Spesa media mensile reale', { exact: true })).toBeVisible();
  await expect(page.getByText(/€25,00\s*\/\s*€300,00/)).toHaveCount(2);
  await page.goto('/');
  await expect(page.getByText('Budget mensili', { exact: true })).toBeVisible();
  await expect(page.getByText(/Spese saltuarie:|Media mensile su 12 mesi/)).toHaveCount(0);
});

test('personal budgets and the dashboard use the arithmetic monthly mean including zero months', async ({ page }) => {
  await fixtures(page);
  const history = ['2026-08-01', '2026-09-01', '2026-10-01'].map((date, index) => ({ ...transactions[0], id: `history-${index}`, date, amount: index === 2 ? 1000 : 100 }));
  await page.route('https://*.supabase.co/rest/v1/categories?*', route => route.fulfill({ json: [categories[0]] }));
  await page.route('https://*.supabase.co/rest/v1/budgets?*', route => route.fulfill({ json: [{ ...budgets[0], amount: 400 }] }));
  await page.route('https://*.supabase.co/rest/v1/transactions?*', route => route.fulfill({ json: history,
    headers: { 'content-range': '0-2/3', 'access-control-expose-headers': 'content-range' } }));
  await page.route('**/api/spending-forecast', route => route.fulfill({ json: { ...forecast, budgetSpending: budgetSpending(history as unknown as Transaction[], [{ ...budgets[0], amount: 400 }] as unknown as Budget[], categories as unknown as Category[], '2026-11-01') } }));
  await page.goto('/budget');
  await expect(page.getByText(/€300,00\s*\/\s*€400,00/)).toBeVisible();
  await expect(page.getByText('Spesa media mensile reale', { exact: true })).toBeVisible();
  await page.goto('/');
  const row = page.getByRole('listitem').filter({ hasText: 'Cibo' });
  await expect(row.getByText('€300,00', { exact: false })).toBeVisible();
  await expect(row.getByText('75%')).toBeVisible();
});

test('same-browser sessions remain distinct and disconnect targets the other identifier', async ({ page }) => {
  const disconnected = await fixtures(page);
  await page.goto('/settings');
  await expect(page.getByText('Attuale', { exact: true })).toHaveCount(1);
  const button = page.getByRole('button', { name: 'Disconnetti questo dispositivo' });
  await expect(button).toHaveCount(1);
  await button.click();
  await expect(button).toHaveCount(0);
  expect(disconnected).toEqual([otherId]);
  await expect(page.getByText('Attuale', { exact: true })).toBeVisible();
});

for (const language of ['it', 'en']) test(`category forecast remains usable on mobile/desktop in ${language}`, async ({ page }, info) => {
  await fixtures(page, language);
  await page.goto('/insights');
  const title = language === 'it' ? 'Previsione per categoria' : 'Forecast by category';
  const table = page.getByRole('table', { name: title });
  await expect(table).toBeVisible({ timeout: 15_000 });
  await expect(table.getByRole('row')).toHaveCount(5);
  await expect(table.getByRole('columnheader')).toHaveCount(5);
  await expect(table.getByRole('columnheader', { name: language === 'it' ? 'Previsto' : 'Projected', exact: true })).toBeVisible();
  await expect(table.getByRole('columnheader', { name: language === 'it' ? 'Fine mese' : 'Month end' })).toHaveCount(0);
  await expect(table.getByText('-50,00€')).toHaveClass(/text-success/);
  const toggle = page.getByRole('button', { name: title });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(table).not.toBeVisible();
  await page.goto('/budget');
  await page.goto('/insights');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await page.reload();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(table).toBeVisible();
  await page.reload();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(table).toBeVisible();
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const dark of [false, true]) {
      await page.evaluate(dark => { document.documentElement.classList.toggle('dark', dark); document.documentElement.classList.toggle('light', !dark); }, dark);
      // The existing sidebar animates its padding when crossing the desktop breakpoint.
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await table.scrollIntoViewIfNeeded();
      await page.screenshot({ path: info.outputPath(`forecast-${width}-${dark ? 'dark' : 'light'}.png`), fullPage: true });
    }
  }
});

test('shared category selector still works in transaction filters and the other modal forms', async ({ page }) => {
  await fixtures(page);
  await page.goto('/transactions');
  await page.getByRole('combobox', { name: 'Tutte le categorie', exact: true }).click();
  await page.getByPlaceholder('Cerca categoria...').fill('Dentista');
  await page.getByRole('option', { name: /Dentista/ }).click();
  await expect(page.getByRole('combobox', { name: /Dentista/ })).toBeVisible();
  for (const form of [
    { path: '/transactions', button: 'Nuova', title: 'Nuova Transazione', placeholder: 'Seleziona' },
    { path: '/recurring', button: 'Nuova Uscita', title: 'Nuova Uscita Ricorrente', placeholder: 'Seleziona categoria' },
  ]) {
    await page.goto(form.path);
    await page.getByRole('button', { name: form.button, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: form.title });
    await dialog.getByRole('combobox', { name: form.placeholder, exact: true }).click();
    const search = dialog.getByPlaceholder('Cerca categoria...');
    await expect(search).toBeFocused();
    await search.fill('Dentista');
    await page.keyboard.press('Enter');
    await expect(dialog.getByRole('combobox', { name: /Dentista/ })).toHaveAttribute('aria-expanded', 'false');
    await expect(dialog).toBeVisible();
  }
});

for (const viewport of [{ width: 1280, height: 800 }, { width: 375, height: 812 }, { width: 650, height: 340 }]) {
  test(`new budget grows around the category list at ${viewport.width}x${viewport.height}`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    await fixtures(page);
    const extra = Array.from({ length: 30 }, (_, index) => ({ ...categories[0], id: `extra-${index}`, name: `Categoria ${String(index + 1).padStart(2, '0')}` }));
    await page.route('https://*.supabase.co/rest/v1/categories?*', route => route.fulfill({ json: [...categories, ...extra] }));
    await page.goto('/budget');
    await page.getByRole('button', { name: 'Nuovo Budget', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Nuovo Budget' });
    await expect(dialog).toBeVisible();
    await dialog.getByPlaceholder('Importo').fill('100');
    const initialHeight = (await dialog.boundingBox())!.height;
    const trigger = dialog.getByRole('combobox');
    await trigger.click();
    const search = dialog.getByPlaceholder('Cerca categoria...');
    await expect(search).toBeFocused();
    await expect.poll(async () => (await dialog.boundingBox())!.height).toBeGreaterThan(initialHeight + 20);
    const list = dialog.getByRole('listbox');
    expect(await list.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
    const bounds = (await dialog.boundingBox())!;
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1);
    await page.screenshot({ path: info.outputPath('expanded-budget.png'), fullPage: true });
    await search.fill('Categoria 25');
    await page.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toContainText('Categoria 25');
    await expect(dialog.getByPlaceholder('Importo')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Crea', exact: true })).toBeVisible();
    await trigger.click();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toBeFocused();
  });
}
