// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import Budget from './Budget';

const regular = { id: 'food', name: 'Cibo', type: 'expense', icon: '🍔', spending_pattern: 'regular' };
const occasional = { id: 'dentist', name: 'Dentista', type: 'expense', icon: '🦷', spending_pattern: 'occasional' };
vi.mock('@/components/layout/MainLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/hooks/useCategories', () => ({ useCategories: () => ({ expenseCategories: [regular, occasional] }) }));
vi.mock('@/hooks/useTransactions', () => ({ useTransactions: () => ({ transactions: [] }) }));
vi.mock('@/hooks/useBudgets', () => ({ useBudgets: () => ({
  budgets: [regular, occasional].map(category => ({ id: category.id, category_id: category.id, category, amount: 100 })),
  createBudget: {}, updateBudget: {}, deleteBudget: {},
}) }));
vi.mock('@/hooks/useSpendingForecast', () => ({ useSpendingForecast: () => ({ data: { budgetSpending: { categories: [
  { categoryId: 'dentist', spendingPattern: 'occasional', expectedMonthly: '100.00', averageMonthly: '25.00' },
] } } }) }));
afterEach(cleanup);

it('marks only occasional categories and removes the formula text from the heading and cards', () => {
  render(<Budget />);
  expect(screen.getAllByText('Spesa saltuaria')).toHaveLength(1);
  expect(screen.getByText('Dentista').parentElement?.textContent).toContain('Spesa saltuaria');
  expect(screen.getByText('Cibo').parentElement?.textContent).not.toContain('Spesa saltuaria');
  expect(screen.queryByText(/Mediana mensile \(ultimi 730 giorni\)|Media mensile su 12 mesi|Spese regolari:/)).toBeNull();
});
