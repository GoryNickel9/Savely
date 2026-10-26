// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Budget, Transaction } from '@/lib/types';
import BudgetsWidget from './BudgetsWidget';
const remote = vi.hoisted(() => ({ useSpendingForecast: vi.fn() }));
vi.mock('@/hooks/useSpendingForecast', () => ({ useSpendingForecast: remote.useSpendingForecast }));

const budget: Budget = {
  id: 'budget-food', user_id: 'user', category_id: 'food', amount: 300,
  currency: 'EUR', month: 1, year: 2000, created_at: '', updated_at: '',
  category: {
    id: 'food', user_id: 'user', name: 'Alimentari', icon: '🛒',
    color: '#123456', type: 'expense', created_at: '', deleted_at: null,
  },
};

function expense(date: string, amount: number, overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: date, user_id: 'user', category_id: 'food', type: 'expense', amount,
    currency: 'EUR', description: null, date, exchange_rate_eur: 1,
    created_at: '', updated_at: '', deleted_at: null, ...overrides,
  };
}

beforeEach(() => {
  remote.useSpendingForecast.mockReturnValue({ data: undefined, isLoading: false });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 26, 12));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it('confronta il budget con la mediana dei totali mensili degli ultimi 730 giorni', () => {
  const transactions = [
    expense('2026-08-05', 180),
    expense('2026-08-20', 60),
    expense('2026-09-10', 360),
    expense('2026-10-10', 120),
    expense('2023-01-10', 9000),
    expense('2026-09-15', 9000, { type: 'income' }),
    expense('2026-09-20', 9000, { category_id: 'other' }),
  ];
  const view = render(
    <MemoryRouter><BudgetsWidget budgets={[budget]} transactions={transactions} /></MemoryRouter>
  );

  expect(screen.getByText('Mediana mensile (ultimi 730 giorni)')).toBeTruthy();
  const row = within(screen.getByRole('listitem'));
  expect(row.getByText('€240,00', { exact: false })).toBeTruthy();
  expect(row.getByText('/ €300,00')).toBeTruthy();
  expect(row.getByText('80%')).toBeTruthy();
  expect(row.getByRole('progressbar').className).toContain('[&>div]:bg-warning');

  view.rerender(
    <MemoryRouter>
      <BudgetsWidget budgets={[budget]} transactions={[...transactions, expense('2026-10-20', 240)]} />
    </MemoryRouter>
  );
  expect(row.getByText('€360,00', { exact: false })).toBeTruthy();
  expect(row.getByText('120%')).toBeTruthy();
  expect(row.getByRole('progressbar').className).toContain('[&>div]:bg-destructive');
  expect(row.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
});

it('mostra zero per una categoria senza spese nello storico', () => {
  render(
    <MemoryRouter><BudgetsWidget budgets={[budget]} transactions={[]} /></MemoryRouter>
  );
  const row = within(screen.getByRole('listitem'));
  expect(row.getByText('€0,00', { exact: false })).toBeTruthy();
  expect(row.getByText('0%')).toBeTruthy();
});

it('uses the server average for occasional categories and never renders missing data as zero', () => {
  const occasional = { ...budget, category: { ...budget.category!, spending_pattern: 'occasional' as const } };
  const view = render(<MemoryRouter><BudgetsWidget budgets={[occasional]} transactions={[]} /></MemoryRouter>);
  expect(screen.getByText('Confronto delle spese saltuarie non disponibile. Riprova.')).toBeTruthy();
  expect(screen.queryByRole('progressbar')).toBeNull();
  remote.useSpendingForecast.mockReturnValue({ data: { occasionalSpending: { categories: [
    { categoryId: 'food', expectedMonthly: '300.00', averageMonthly: '25.00' },
  ] } }, isLoading: false });
  view.rerender(<MemoryRouter><BudgetsWidget budgets={[occasional]} transactions={[]} /></MemoryRouter>);
  expect(screen.getByText('€25,00', { exact: false })).toBeTruthy();
  expect(screen.getByRole('progressbar')).toBeTruthy();
});
