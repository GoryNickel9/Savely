import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getForecast, forecastDate } from '../../server/forecast-api';
import { forecastSpending } from '../../server/spending-forecast';
import { decodeForecast } from './forecastContract';
import fixture from '../test/fixtures/forecast-baseline.json';
import type { VercelRequest } from '../../api/vercel';
import type { Transaction, Budget } from './types';
import type { RecurringExpense } from '../../server/spending-forecast';

const owner = '11111111-1111-4111-8111-111111111111';
const now = new Date('2026-10-15T12:00:00Z');
const req: VercelRequest = { method: 'POST', headers: { authorization: 'Bearer synthetic' }, body: { schemaVersion: 1, timeZone: 'Europe/Rome' } };
const calls: URL[] = [];
let badOwner = false, duplicate = false, failure = false, pages = false, occasional = false;
beforeEach(() => {
  vi.stubEnv('SUPABASE_URL', 'https://backend.example.test'); vi.stubEnv('SUPABASE_ANON_KEY', 'public-key');
  calls.length = 0; badOwner = false; duplicate = false; failure = false; pages = false; occasional = false;
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    const path = new URL(url); calls.push(path);
    expect(init.headers).toEqual({ apikey: 'public-key', Authorization: 'Bearer synthetic' });
    expect(init.redirect).toBe('error');
    if (path.pathname === '/auth/v1/user') return Response.json({ id: owner });
    expect(path.searchParams.get('user_id')).toBe(`eq.${owner}`);
    expect(path.searchParams.get('limit')).toBe('500');
    if (failure) return Response.json({}, { status: 503 });
    const offset = Number(path.searchParams.get('offset'));
    if (occasional && !offset) {
      if (path.pathname.endsWith('categories')) return Response.json([{ id: 'dentist', user_id: owner, type: 'expense', spending_pattern: 'occasional', deleted_at: null }]);
      if (path.pathname.endsWith('budgets')) return Response.json([{ id: 'b', user_id: owner, category_id: 'dentist', amount: 25, currency: 'EUR' }]);
      if (path.pathname.endsWith('transactions')) return Response.json(['2025-11-01', '2026-05-01', '2026-10-15'].map((date, index) => ({
        id: `t${index}`, user_id: owner, date, type: 'expense', amount: 100, currency: 'EUR', description: null, category_id: 'dentist', deleted_at: null,
      })));
    }
    if (path.pathname.endsWith('transactions') && (!offset || duplicate)) {
      const count = pages ? 500 : 1;
      return Response.json(Array.from({ length: count }, (_, index) => ({ id: `t${offset + index}`, user_id: badOwner ? 'other' : owner,
        date: '2026-05-01', amount: 1, currency: 'EUR', type: 'expense', category_id: null, description: null, deleted_at: null,
        ...(duplicate ? { id: 'same' } : {}),
      })));
    }
    return Response.json([]);
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it('keeps the existing model and all 1464 chart points exactly', () => {
  for (const row of fixture.cases) {
    expect(forecastSpending(row.transactions as unknown as Transaction[], row.budgets as unknown as Budget[], row.recurringExpenses as RecurringExpense[], row.date)).toEqual(row.forecast);
    expect(decodeForecast(row.response, owner, 'Europe/Rome').forecast).toEqual(row.forecast);
  }
});
it('selects the server calendar date in the requested timezone including DST', () => {
  const midnight = new Date('2026-10-25T23:30:00Z');
  expect(forecastDate('Europe/Rome', midnight)).toBe('2026-10-26');
  expect(forecastDate('America/New_York', midnight)).toBe('2026-10-25');
  expect(() => forecastDate('not/a-zone', now)).toThrow();
  expect(forecastSpending([], [], [], '2028-02-10').points).toHaveLength(29);
  expect(forecastSpending([], [], [], '0001-02-10').points).toHaveLength(28);
  expect(forecastSpending([], [], [], '0004-02-10').points).toHaveLength(29);
});
it('reads complete owned pages and returns a versioned exact-cent response', async () => {
  pages = true;
  const result = await getForecast(req, now);
  expect(result.forecast.spent).toBe('0.00'); expect(result.forecast.historyDays).toBe(167);
  expect(calls.some(url => url.searchParams.get('offset') === '500')).toBe(true);
  expect(result.modelVersion).toBe('weekday-regular-occasional-v2');
  expect(decodeForecast(result, owner, 'Europe/Rome').forecast.total).not.toBeNull();
});
it('serves the same 12-month comparison to both clients from owned data and includes classification in the hash', async () => {
  const baseline = await getForecast(req, now);
  occasional = true;
  const result = await getForecast(req, now);
  expect(decodeForecast(result, owner, 'Europe/Rome').occasionalSpending).toMatchObject({
    startDate: '2025-11-01', endDate: '2026-10-15', months: 12,
    categories: [{ categoryId: 'dentist', averageMonthly: '25.00', expectedMonthly: '25.00', exceeded: false }],
  });
  expect(result.forecast.spent).toBe('100.00');
  expect(result.forecast.variable).toBe('12.90');
  expect(result.forecast.total).toBe('112.90');
  expect(result.inputSha256).not.toBe(baseline.inputSha256);
});
it('rejects missing authentication and user-supplied datasets before any read', async () => {
  await expect(getForecast({ ...req, headers: {} }, now)).rejects.toMatchObject({ status: 401 });
  await expect(getForecast({ ...req, body: { ...req.body, userId: owner } }, now)).rejects.toMatchObject({ status: 400 });
  expect(calls).toHaveLength(0);
});
it('does not return partial totals after a failed page or owner mismatch', async () => {
  failure = true; await expect(getForecast(req, now)).rejects.toMatchObject({ status: 502 });
  failure = false; badOwner = true; await expect(getForecast(req, now)).rejects.toMatchObject({ status: 502 });
  badOwner = false; duplicate = true; pages = true; await expect(getForecast(req, now)).rejects.toMatchObject({ status: 502 });
});
it('rejects incompatible schemas, decimal numbers, wrong accounts and malformed charts', () => {
  const original = fixture.cases[3].response;
  expect(() => decodeForecast({ ...original, schemaVersion: 2 }, owner, 'Europe/Rome')).toThrow();
  expect(() => decodeForecast(original, 'other', 'Europe/Rome')).toThrow();
  expect(() => decodeForecast(original, owner, 'UTC')).toThrow();
  expect(() => decodeForecast({ ...original, forecast: { ...original.forecast, spent: 1.01 } }, owner, 'Europe/Rome')).toThrow();
  expect(() => decodeForecast({ ...original, forecast: { ...original.forecast, points: [] } }, owner, 'Europe/Rome')).toThrow();
  // Model upgrades remain compatible while the response schema stays at version 1.
  expect(decodeForecast({ ...original, modelVersion: 'improved-v2' }, owner, 'Europe/Rome').modelVersion).toBe('improved-v2');
});

it('rejects expired and anonymous sessions and treats transport failures as upstream errors', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(Response.json({}, { status: 401 }));
  await expect(getForecast(req, now)).rejects.toMatchObject({ status: 401 });
  vi.mocked(fetch).mockResolvedValueOnce(Response.json({ id: owner, is_anonymous: true }));
  await expect(getForecast(req, now)).rejects.toMatchObject({ status: 401 });
  vi.mocked(fetch).mockRejectedValueOnce(new TypeError('offline'));
  await expect(getForecast(req, now)).rejects.toMatchObject({ status: 502 });
});
it('keeps HTTP responses private and rejects unsupported methods', async () => {
  const { default: handler } = await import('../../api/spending-forecast');
  const headers = new Map<string, unknown>(); let status = 0;
  const res = { setHeader: (key: string, value: unknown) => headers.set(key, value), status: (value: number) => { status = value; return res; }, json: (value: unknown) => value };
  await handler({ ...req, method: 'GET' }, res as unknown as import('../../api/vercel').VercelResponse);
  expect(status).toBe(405); expect(headers.get('Allow')).toBe('POST');
  expect(headers.get('Cache-Control')).toContain('private, no-store'); expect(headers.get('Vary')).toBe('Authorization');
  await handler({ ...req, headers: {} }, res as unknown as import('../../api/vercel').VercelResponse);
  expect(status).toBe(401);
});
