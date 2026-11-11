import { expect, it } from 'vitest';
import { getCoupleCategoryIcon } from './coupleCategoryIcon';
import type { Category } from './types';
import type { SharedExpenseViewRow } from '@/hooks/useSharedExpenses';

const category = { id: 'food', name: 'Cibo', type: 'expense', icon: '🍔', deleted_at: null } as Category;
const shared = { id: 'a', couple_category_name: 'Cibo', category_icon: '🛒', date: '2026-10-20', created_at: '2026-10-20', tx_deleted_at: null } as SharedExpenseViewRow;

it('uses the same personal expense icon as Budget, with normalized category names', () => {
  expect(getCoupleCategoryIcon(' cIbO ', [category], [shared])).toBe('🍔');
});
it('uses shared metadata for partner-only and renamed family categories', () => {
  expect(getCoupleCategoryIcon('Vacanze insieme', [], [{ ...shared, couple_category_name: 'Vacanze insieme', category_icon: '✈️' }])).toBe('✈️');
});
it('ignores deleted and income categories, and uses the latest active shared source deterministically', () => {
  const old = { ...shared, id: 'b', date: '2026-10-01', category_icon: '🍎' };
  expect(getCoupleCategoryIcon('Cibo', [{ ...category, type: 'income' }, { ...category, deleted_at: '2026-10-01' }], [old, shared])).toBe('🛒');
  expect(getCoupleCategoryIcon('Cibo', [], [shared, old])).toBe('🛒');
  expect(getCoupleCategoryIcon('Cibo', [], [old, { ...shared, tx_deleted_at: '2026-10-21' }])).toBe('🍎');
});
it('uses a neutral folder for categories with no available icon metadata', () => {
  expect(getCoupleCategoryIcon('Altro', [], [shared])).toBe('📂');
});
