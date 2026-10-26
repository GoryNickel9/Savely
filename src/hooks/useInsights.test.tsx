// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useInsights } from './useInsights';
import type { Transaction } from '@/lib/types';
import i18n from '@/i18n';

const mocks = vi.hoisted(() => ({ transactions: [] as Transaction[], txError: false, recurringError: false, forecastDate: null as string | null }));
vi.mock('./useTransactions', () => ({ useTransactions: () => ({ transactions: mocks.transactions, isLoading: false, isError: mocks.txError }) }));
vi.mock('./useBudgets', () => ({ useBudgets: () => ({ budgets: [], isLoading: false, isError: false }) }));
vi.mock('./usePortfolio', () => ({ usePortfolio: () => ({ assets: [], isLoading: false, isError: false }) }));
vi.mock('./useNetWorthHistory', () => ({ useNetWorthHistory: () => ({ data: [], isLoading: false, isError: false }) }));
vi.mock('./useSpendingForecast', () => ({ useSpendingForecast: () => ({ data: mocks.forecastDate ? { forecast: { date: mocks.forecastDate } } : null, isLoading: false, isError: mocks.recurringError }) }));
vi.mock('./useRecurringCandidates', () => ({ useRecurringCandidates: () => ({ candidates: [], isLoading: false, isError: false }) }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 20));
  mocks.transactions = []; mocks.txError = false; mocks.recurringError = false; mocks.forecastDate = null;
});
afterEach(() => { cleanup(); vi.useRealTimers(); void i18n.changeLanguage('it'); });
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { ...renderHook(() => useInsights(), { wrapper }), client };
}

it('propaga gli errori delle fonti invece di dichiarare assenza di segnali', () => {
  mocks.txError = true;
  const { result } = setup();
  expect(result.current.isError).toBe(true);
});
it('non presenta una previsione completa se fallisce il caricamento delle ricorrenti', () => {
  mocks.recurringError = true;
  expect(setup().result.current.isError).toBe(true);
});
it('rende espliciti i dati non validi senza esporre importi NaN', () => {
  mocks.transactions = [{ date: '2026-99-99', amount: NaN, type: 'expense', currency: 'EUR', deleted_at: null } as Transaction];
  const { result } = setup();
  expect(result.current.dataError).toBe(true);
  expect(result.current.forecast).toBeNull();
});
it('riprova il caricamento di tutte le fonti utilizzate', async () => {
  const { result, client } = setup();
  const retry = vi.spyOn(client, 'invalidateQueries');
  await result.current.retry();
  expect(retry.mock.calls.map(call => call[0]?.queryKey?.[0])).toEqual(['transactions', 'budgets', 'portfolio', 'net-worth-history', 'recurring_expenses', 'spending-forecast']);
});

it('aggiorna i messaggi dei segnali quando cambia la lingua', async () => {
  mocks.transactions = ['2026-05-10', '2026-06-10', '2026-07-10', '2026-08-10', '2026-09-10'].map((date, index) => ({
    id: String(index), user_id: 'u', date, amount: index === 4 ? 15 : 12, type: 'expense', currency: 'EUR', exchange_rate_eur: 1,
    category_id: 'streaming', description: 'Streaming', deleted_at: null, created_at: date, updated_at: date,
  }));
  const { result } = setup();
  expect(result.current.insights.some(item => item.title.includes('Spesa ricorrente'))).toBe(true);
  await act(() => i18n.changeLanguage('en'));
  expect(result.current.insights.some(item => item.title.includes('Recurring expense'))).toBe(true);
});

it('usa la data del server anche se l’orologio del dispositivo è diverso', () => {
  mocks.forecastDate = '2026-10-19';
  mocks.transactions = [{ id: 'future', user_id: 'u', date: '2026-10-20', amount: 10, type: 'expense', currency: 'EUR', exchange_rate_eur: 1,
    category_id: 'food', description: null, deleted_at: null, created_at: '', updated_at: '' }];
  const { result } = setup();
  expect(result.current.referenceDate.getDate()).toBe(19);
  expect(result.current.hasTransactions).toBe(false);
});
