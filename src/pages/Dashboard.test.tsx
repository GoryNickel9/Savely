// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Dashboard from './Dashboard';

const mocks = vi.hoisted(() => ({ balance: vi.fn() }));
vi.mock('@/hooks/useTransactionBalance', () => ({ useTransactionBalance: mocks.balance }));
vi.mock('@/hooks/useTransactions', () => ({ useTransactions: () => ({ transactions: [] }) }));
vi.mock('@/hooks/useBudgets', () => ({ useBudgets: () => ({ budgets: [] }) }));
vi.mock('@/components/layout/MainLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/components/dashboard/PeriodPicker', () => ({ default: () => null }));
vi.mock('@/components/dashboard/IncomeExpenseChart', () => ({ default: () => null }));
vi.mock('@/components/dashboard/CategoryDonut', () => ({ default: () => null }));
vi.mock('@/components/dashboard/RecentTransactions', () => ({ default: () => null }));
vi.mock('@/components/dashboard/BudgetsWidget', () => ({ default: () => null }));

beforeEach(() => {
  mocks.balance.mockReturnValue({ data: { balance: 12345.67, previousBalance: 10000 }, isError: false });
});
afterEach(cleanup);

it('mostra il saldo SQL anche senza movimenti caricati nel browser', () => {
  render(<Dashboard />);
  expect(screen.getByText('€12.345,67')).toBeTruthy();
});

it('mostra un errore invece di spacciare il risultato precedente per il saldo aggiornato', () => {
  mocks.balance.mockReturnValue({ data: { balance: 12345.67, previousBalance: 10000 }, isError: true });
  render(<Dashboard />);
  expect(screen.getByText('Impossibile caricare il saldo')).toBeTruthy();
  expect(screen.queryByText('€12.345,67')).toBeNull();
  expect(screen.getByText('—')).toBeTruthy();
});

it('non mostra un saldo zero mentre attende la risposta SQL', () => {
  mocks.balance.mockReturnValue({ data: undefined, isError: false });
  render(<Dashboard />);
  expect(screen.getByText('Caricamento...')).toBeTruthy();
  expect(screen.getByText('—')).toBeTruthy();
});
