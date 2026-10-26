import { createHash } from 'node:crypto';
import type { VercelRequest } from '../api/vercel.js';
import { forecastResponseSchema } from '../src/lib/forecastContract.js';
import type { Transaction, Budget, Category } from '../src/lib/types.js';
import { occasionalSpending } from './occasional-spending.js';
import { forecastSpending, type RecurringExpense } from './spending-forecast.js';

export class ForecastError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
export function forecastDate(timeZone: unknown, now: Date): string {
  if (typeof timeZone !== 'string' || timeZone.length > 80 || !timeZone) throw new ForecastError(400, 'Invalid timezone');
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const part = (type: string) => parts.find(p => p.type === type)!.value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  } catch { throw new ForecastError(400, 'Invalid timezone'); }
}
async function json(response: Response): Promise<unknown> {
  if (!response.body) throw new ForecastError(502, 'Empty data response');
  const reader = response.body.getReader(); let size = 0; const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength; if (size > 4_000_000) throw new ForecastError(502, 'Data response too large');
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally { await reader.cancel(); }
}

/** Only verified user JWTs are used for database reads: RLS remains active. */
export async function getForecast(req: VercelRequest, now = new Date()) {
  const auth = req.headers.authorization;
  if (typeof auth !== 'string' || !/^Bearer [^\s]+$/.test(auth) || auth.length > 16384) throw new ForecastError(401, 'Sign in required');
  if (!req.body || req.body.schemaVersion !== 1 || Object.keys(req.body).some(key => !['schemaVersion', 'timeZone'].includes(key))) throw new ForecastError(400, 'Invalid forecast request');
  const timeZone = req.body.timeZone;
  const asOf = forecastDate(timeZone, now);
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  const base = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  if (!key || !base || !base.startsWith('https://')) throw new ForecastError(503, 'Forecast service not configured');
  const headers = { apikey: key, Authorization: auth };
  const signal = AbortSignal.timeout(45_000);
  async function request(path: string) {
    let response: Response;
    try { response = await fetch(`${base}${path}`, { headers, redirect: 'error', signal }); }
    catch { throw new ForecastError(502, 'Forecast data unavailable'); }
    if (response.status === 401 || response.status === 403) throw new ForecastError(401, 'Session expired');
    if (!response.ok) throw new ForecastError(502, 'Forecast data unavailable');
    try { return await json(response); } catch (error) { if (error instanceof ForecastError) throw error; throw new ForecastError(502, 'Invalid data response'); }
  }
  const user = await request('/auth/v1/user') as { id?: unknown; is_anonymous?: boolean } | null;
  if (!user || typeof user.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id) || user.is_anonymous === true) throw new ForecastError(401, 'Sign in required');
  const userId = user.id;
  async function rows(table: string, fields: string): Promise<Record<string, unknown>[]> {
    const all: Record<string, unknown>[] = []; const ids = new Set<string>();
    for (;;) {
      const page = await request(`/rest/v1/${table}?select=${fields}&user_id=eq.${userId}&${table !== 'budgets' ? 'deleted_at=is.null&' : ''}order=id.asc&limit=500&offset=${all.length}`);
      if (!Array.isArray(page) || page.length > 500 || page.length + all.length > 100_000) throw new ForecastError(502, 'Incomplete forecast dataset');
      if (!page.length) return all;
      for (const row of page) {
        if (!row || typeof row !== 'object' || typeof row.id !== 'string' || row.user_id !== userId || ids.has(row.id)) throw new ForecastError(502, 'Forecast dataset changed');
        ids.add(row.id); all.push(row);
      }
    }
  }
  const [transactions, budgets, recurring, categories] = await Promise.all([
    rows('transactions', 'id,user_id,type,amount,currency,exchange_rate_eur,date,description,category_id,deleted_at,updated_at'),
    rows('budgets', 'id,user_id,category_id,amount,currency,updated_at'),
    rows('recurring_expenses', 'id,user_id,category_id,name,amount,currency,frequency,next_due_date,is_active,week_interval,deleted_at,updated_at'),
    rows('categories', 'id,user_id,type,spending_pattern,deleted_at'),
  ]);
  if (transactions.some(row => !['income', 'expense'].includes(String(row.type)) || typeof row.currency !== 'string' ||
      row.description !== null && typeof row.description !== 'string' || row.category_id !== null && typeof row.category_id !== 'string') ||
    budgets.some(row => typeof row.category_id !== 'string' || typeof row.currency !== 'string') ||
    recurring.some(row => typeof row.is_active !== 'boolean' || row.category_id !== null && typeof row.category_id !== 'string') ||
    categories.some(row => !['regular', 'occasional'].includes(String(row.spending_pattern)) || !['income', 'expense'].includes(String(row.type)))) {
    throw new ForecastError(422, 'Invalid financial data');
  }
  const forecast = forecastSpending(transactions as unknown as Transaction[], budgets as unknown as Budget[], recurring as unknown as RecurringExpense[], asOf);
  const money = (value: number | null) => {
    if (value === null) return null;
    if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(Math.round(value * 100))) throw new ForecastError(422, 'Forecast amount outside supported range');
    return value.toFixed(2);
  };
  return forecastResponseSchema.parse({
    schemaVersion: 1, modelVersion: 'weekday-history-v1', userId, timeZone, generatedAt: now.toISOString(),
    inputSha256: createHash('sha256').update(JSON.stringify([asOf, timeZone, transactions, budgets, recurring, categories])).digest('hex'),
    occasionalSpending: occasionalSpending(transactions as unknown as Transaction[], budgets as unknown as Budget[], categories as unknown as Category[], asOf),
    forecast: { ...forecast, spent: money(forecast.spent), scheduled: money(forecast.scheduled), variable: money(forecast.variable),
      total: money(forecast.total), budget: forecast.budget && { limit: money(forecast.budget.limit) },
      points: forecast.points.map(p => ({ ...p, actual: money(p.actual), projected: money(p.projected) })),
    },
  });
}
