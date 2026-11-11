import type { Category } from './types';
import type { SharedExpenseViewRow } from '@/hooks/useSharedExpenses';

/** Personal categories take precedence; shared custom names use the latest source icon. */
export function getCoupleCategoryIcon(name: string, categories: Category[], expenses: SharedExpenseViewRow[]): string {
  const normalized = name.trim().toLocaleLowerCase('it');
  const personal = categories.find(category => category.type === 'expense' && !category.deleted_at
    && category.name.trim().toLocaleLowerCase('it') === normalized && category.icon);
  if (personal) return personal.icon;
  const shared = expenses.filter(expense => !expense.tx_deleted_at && expense.category_icon
    && expense.couple_category_name?.trim().toLocaleLowerCase('it') === normalized)
    .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));
  return shared[0]?.category_icon || '📂';
}
