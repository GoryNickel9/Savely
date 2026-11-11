import { z } from 'zod';
import { validCalendarDate } from './spendingForecast.js';

const money = z.string().regex(/^(0|[1-9]\d{0,13})\.\d{2}$/).refine(value => Number.isSafeInteger(Math.round(Number(value) * 100)));
const date = z.string().refine(validCalendarDate);
const categoryForecastSchema = z.object({
  categoryId: z.string().min(1).nullable(), spent: money, scheduled: money, variable: money,
  total: money.nullable(), budget: z.object({ limit: money }).nullable(),
});
const moneyCents = (value: string) => BigInt(value.replace('.', ''));
export const occasionalSpendingSchema = z.object({
  startDate: date, endDate: date, months: z.literal(12),
  categories: z.array(z.object({ categoryId: z.string().min(1), total: money, averageMonthly: money,
    expectedMonthly: money.nullable(), exceeded: z.boolean(), over: money })).max(100_000),
}).superRefine((value, ctx) => {
  const start = new Date(`${value.endDate.slice(0, 7)}-01T00:00:00Z`);
  start.setUTCMonth(start.getUTCMonth() - 11);
  if (value.startDate !== start.toISOString().slice(0, 10)
    || new Set(value.categories.map(category => category.categoryId)).size !== value.categories.length) {
    ctx.addIssue({ code: 'custom', message: 'Invalid occasional spending period or categories' });
  }
});
export type OccasionalSpending = z.infer<typeof occasionalSpendingSchema>;
export const budgetSpendingSchema = z.object({
  endDate: date,
  categories: z.array(z.object({ categoryId: z.string().min(1).nullable(), spendingPattern: z.enum(['regular', 'occasional']),
    startDate: date, endDate: date, historyDays: z.union([z.literal(180), z.literal(730)]), months: z.number().int().min(1).max(26),
    total: money, averageMonthly: money, expectedMonthly: money.nullable(), exceeded: z.boolean(), over: money })).max(100_000),
}).superRefine((value, ctx) => {
  const invalid = new Set(value.categories.map(row => row.categoryId)).size !== value.categories.length || value.categories.some(row => {
    const cutoff = new Date(`${value.endDate}T00:00:00Z`); cutoff.setUTCDate(cutoff.getUTCDate() - row.historyDays);
    const index = (day: string) => Number(day.slice(0, 4)) * 12 + Number(day.slice(5, 7));
    const total = moneyCents(row.total), limit = row.expectedMonthly === null ? null : moneyCents(row.expectedMonthly);
    const average = (total + BigInt(Math.floor(row.months / 2))) / BigInt(row.months);
    const exceeded = limit !== null && limit > 0n && total > limit * BigInt(row.months);
    return row.endDate !== value.endDate || row.historyDays !== (row.spendingPattern === 'occasional' ? 730 : 180)
      || row.startDate > row.endDate || row.startDate < cutoff.toISOString().slice(0, 10)
      || row.months !== index(row.endDate) - index(row.startDate) + 1 || moneyCents(row.averageMonthly) !== average
      || row.exceeded !== exceeded || moneyCents(row.over) !== (exceeded ? average - limit! : 0n);
  });
  if (invalid) ctx.addIssue({ code: 'custom', message: 'Invalid budget spending window or comparison' });
});
export type BudgetSpending = z.infer<typeof budgetSpendingSchema>;
export const forecastResponseSchema = z.object({
  schemaVersion: z.union([z.literal(1), z.literal(2)]), modelVersion: z.string().min(1).max(80),
  userId: z.uuid(), timeZone: z.string().min(1).max(80),
  generatedAt: z.iso.datetime(), inputSha256: z.string().regex(/^[a-f0-9]{64}$/),
  occasionalSpending: occasionalSpendingSchema.optional(),
  budgetSpending: budgetSpendingSchema.optional(),
  forecast: z.object({
    date, historyDays: z.number().int().min(0).max(730), available: z.boolean(),
    spent: money, scheduled: money, variable: money, total: money.nullable(),
    budget: z.object({ limit: money }).nullable(),
    categories: z.array(categoryForecastSchema).max(100_000).optional(),
    unsupportedRecurring: z.number().int().nonnegative(), unsupportedBudgets: z.number().int().nonnegative(),
    points: z.array(z.object({ day: z.number().int().min(1).max(31), actual: money.nullable(), projected: money.nullable() })).min(28).max(31),
  }),
}).superRefine(({ schemaVersion, forecast: f, occasionalSpending, budgetSpending }, ctx) => {
  const day = Number(f.date.slice(8));
  const days = new Date(`${f.date.slice(0, 7)}-01T00:00:00Z`); days.setUTCMonth(days.getUTCMonth() + 1); days.setUTCDate(0);
  if (schemaVersion === 1 && f.historyDays > 180 || schemaVersion === 2 && (!budgetSpending || budgetSpending.endDate !== f.date)
    || occasionalSpending && occasionalSpending.endDate !== f.date || f.points.length !== days.getUTCDate() || f.available !== (f.total !== null) ||
    f.available && (f.historyDays < 56 || f.unsupportedRecurring > 0 || f.unsupportedBudgets > 0) ||
    f.points.some((p, i) => p.day !== i + 1 || (p.actual !== null) !== (p.day <= day) || (p.projected !== null) !== (f.available && p.day >= day))) {
    ctx.addIssue({ code: 'custom', message: 'Inconsistent spending forecast' });
  }
  if (f.categories) {
    const categories = f.categories;
    const invalid = new Set(categories.map(category => category.categoryId)).size !== categories.length
      || categories.some(category => (category.total !== null) !== f.available
        || category.total !== null && moneyCents(category.total) !== moneyCents(category.spent) + moneyCents(category.scheduled) + moneyCents(category.variable))
      || (['spent', 'scheduled', 'variable'] as const).some(key => categories.reduce((sum, category) => sum + moneyCents(category[key]), 0n) !== moneyCents(f[key]))
      || f.total !== null && categories.reduce((sum, category) => sum + moneyCents(category.total!), 0n) !== moneyCents(f.total);
    if (invalid) ctx.addIssue({ code: 'custom', message: 'Inconsistent category forecasts' });
  }
});
export type ForecastResponse = z.infer<typeof forecastResponseSchema>;
export function decodeForecast(value: unknown, userId: string, timeZone: string) {
  const response = forecastResponseSchema.parse(value);
  if (response.userId !== userId || response.timeZone !== timeZone) throw new Error('Forecast account or timezone changed');
  const f = response.forecast;
  const { categories, ...aggregate } = f;
  return { ...response, forecast: { ...aggregate,
    spent: Number(f.spent), scheduled: Number(f.scheduled), variable: Number(f.variable),
    total: f.total === null ? null : Number(f.total), budget: f.budget === null ? null : { limit: Number(f.budget.limit) },
    ...(categories ? { categories: categories.map(category => ({ ...category,
      spent: Number(category.spent), scheduled: Number(category.scheduled), variable: Number(category.variable),
      total: category.total === null ? null : Number(category.total), budget: category.budget === null ? null : { limit: Number(category.budget.limit) },
    })) } : {}),
    points: f.points.map(p => ({ ...p, actual: p.actual === null ? null : Number(p.actual), projected: p.projected === null ? null : Number(p.projected) })),
  } };
}
