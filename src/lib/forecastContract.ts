import { z } from 'zod';
import { validCalendarDate } from './spendingForecast.js';

const money = z.string().regex(/^(0|[1-9]\d{0,13})\.\d{2}$/).refine(value => Number.isSafeInteger(Math.round(Number(value) * 100)));
const date = z.string().refine(validCalendarDate);
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
export const forecastResponseSchema = z.object({
  schemaVersion: z.literal(1), modelVersion: z.string().min(1).max(80),
  userId: z.uuid(), timeZone: z.string().min(1).max(80),
  generatedAt: z.iso.datetime(), inputSha256: z.string().regex(/^[a-f0-9]{64}$/),
  occasionalSpending: occasionalSpendingSchema.optional(),
  forecast: z.object({
    date, historyDays: z.number().int().min(0).max(180), available: z.boolean(),
    spent: money, scheduled: money, variable: money, total: money.nullable(),
    budget: z.object({ limit: money }).nullable(),
    unsupportedRecurring: z.number().int().nonnegative(), unsupportedBudgets: z.number().int().nonnegative(),
    points: z.array(z.object({ day: z.number().int().min(1).max(31), actual: money.nullable(), projected: money.nullable() })).min(28).max(31),
  }),
}).superRefine(({ forecast: f, occasionalSpending }, ctx) => {
  const day = Number(f.date.slice(8));
  const days = new Date(`${f.date.slice(0, 7)}-01T00:00:00Z`); days.setUTCMonth(days.getUTCMonth() + 1); days.setUTCDate(0);
  if (occasionalSpending && occasionalSpending.endDate !== f.date || f.points.length !== days.getUTCDate() || f.available !== (f.total !== null) ||
    f.available && (f.historyDays < 56 || f.unsupportedRecurring > 0 || f.unsupportedBudgets > 0) ||
    f.points.some((p, i) => p.day !== i + 1 || (p.actual !== null) !== (p.day <= day) || (p.projected !== null) !== (f.available && p.day >= day))) {
    ctx.addIssue({ code: 'custom', message: 'Inconsistent spending forecast' });
  }
});
export type ForecastResponse = z.infer<typeof forecastResponseSchema>;
export function decodeForecast(value: unknown, userId: string, timeZone: string) {
  const response = forecastResponseSchema.parse(value);
  if (response.userId !== userId || response.timeZone !== timeZone) throw new Error('Forecast account or timezone changed');
  const f = response.forecast;
  return { ...response, forecast: { ...f,
    spent: Number(f.spent), scheduled: Number(f.scheduled), variable: Number(f.variable),
    total: f.total === null ? null : Number(f.total), budget: f.budget === null ? null : { limit: Number(f.budget.limit) },
    points: f.points.map(p => ({ ...p, actual: p.actual === null ? null : Number(p.actual), projected: p.projected === null ? null : Number(p.projected) })),
  } };
}
