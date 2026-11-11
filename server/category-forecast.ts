import type { CategorySpendingForecast } from '../src/lib/spendingForecast.js';

export type CategoryAmounts = { spent: number; scheduled: number; variable: number };

/** Largest remainder rounding preserves each published component's existing total. */
function allocateCents(amounts: number[], total: number): number[] {
  const raw = amounts.map(amount => amount * 100);
  const result = raw.map(Math.floor);
  const remainder = Math.round(total * 100) - result.reduce((sum, amount) => sum + amount, 0);
  if (!Number.isSafeInteger(Math.round(total * 100)) || !Number.isInteger(remainder) || remainder < 0 || remainder > amounts.length) {
    throw new Error('Category forecast cannot be reconciled');
  }
  const order = raw.map((amount, index) => ({ index, fraction: amount - result[index] }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let index = 0; index < remainder; index++) result[order[index].index]++;
  return result.map(amount => amount / 100);
}

export function categoryForecasts(
  amounts: Map<string | null, CategoryAmounts>, budgets: Map<string, number>, totals: CategoryAmounts, available: boolean,
): CategorySpendingForecast[] {
  const entries = [...amounts].sort(([a], [b]) => (a ?? '').localeCompare(b ?? '', 'en'));
  const spent = allocateCents(entries.map(([, value]) => value.spent), totals.spent);
  const scheduled = allocateCents(entries.map(([, value]) => value.scheduled), totals.scheduled);
  const variable = allocateCents(entries.map(([, value]) => value.variable), totals.variable);
  return entries.map(([categoryId], index) => ({
    categoryId, spent: spent[index], scheduled: scheduled[index], variable: variable[index],
    total: available ? Math.round((spent[index] + scheduled[index] + variable[index]) * 100) / 100 : null,
    budget: categoryId !== null && budgets.has(categoryId) ? { limit: budgets.get(categoryId)! } : null,
  }));
}
