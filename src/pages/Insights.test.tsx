// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Insights from './Insights';
import type { SpendingForecast } from '@/lib/spendingForecast';

const mocks = vi.hoisted(() => ({ useInsights: vi.fn(), retry: vi.fn(), userId: 'insights-user' }));
vi.mock('@/hooks/useInsights', () => ({ useInsights: mocks.useInsights }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: mocks.userId } }) }));
vi.mock('@/components/layout/MainLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => null, Line: () => null, ReferenceLine: () => null, Tooltip: () => null, XAxis: () => null, YAxis: () => null,
}));

const forecast: SpendingForecast = {
  available: true, date: '2026-10-20', historyDays: 180, spent: 1200, scheduled: 150, variable: 300, total: 1650,
  budget: { limit: 1800 }, points: [{ day: 20, actual: 1200, projected: 1200 }, { day: 31, actual: null, projected: 1650 }], unsupportedRecurring: 0, unsupportedBudgets: 0,
};
function state() {
  return { forecast, referenceDate: new Date(2026, 9, 20), isLoading: false, isError: false, dataError: false, hasTransactions: true, retry: mocks.retry,
    insights: [
      { id: 'a', kind: 'budget_exceeded', severity: 'warning', title: 'Alimentari oltre il budget', message: '340 euro su 300', href: '/budget', details: [{ label: 'Budget della categoria', value: '300 €' }] },
      { id: 'b', kind: 'new_recurring_detected', severity: 'info', title: 'Ricorrente da verificare', message: 'Streaming', href: '/recurring' },
    ] };
}
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); mocks.userId = 'insights-user'; mocks.useInsights.mockReturnValue(state()); });
afterEach(cleanup);
const show = () => render(<MemoryRouter><Insights /></MemoryRouter>);

it('mostra previsione, somma dei budget e margine senza testi dimostrativi o link Dashboard', () => {
  show();
  expect(screen.getByText('1.650,00€')).toBeTruthy();
  expect(screen.getByText('1.800,00€')).toBeTruthy();
  expect(screen.getByText('Somma dei budget mensili delle categorie')).toBeTruthy();
  expect(screen.getByText('Margine previsto:')).toBeTruthy();
  expect(screen.queryByRole('link', { name: 'Dashboard' })).toBeNull();
  expect(screen.queryByText(/Il totale unisce|In questa anteprima|vengono trattate separatamente|non vengono contate due volte/)).toBeNull();
});

it('filtra i segnali e mantiene la previsione senza confronti o link Apri', () => {
  show();
  fireEvent.click(screen.getByRole('button', { name: /Da verificare/ }));
  expect(screen.queryByText('Alimentari oltre il budget')).toBeNull();
  expect(screen.getByText('1.650,00€')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /Tutti/ }));
  expect(screen.getByText('Alimentari oltre il budget')).toBeTruthy();
  expect(screen.getByText('340 euro su 300')).toBeTruthy();
  expect(screen.queryByText('Vedi confronto')).toBeNull();
  expect(screen.queryByText('Budget della categoria')).toBeNull();
  expect(screen.queryAllByRole('link', { name: /^Apri/ })).toHaveLength(0);
});

it('mostra lo sforamento previsto rispetto alla somma dei budget', () => {
  mocks.useInsights.mockReturnValue({ ...state(), forecast: { ...forecast, total: 2000 } });
  show();
  expect(screen.getByText('Sforamento previsto:')).toBeTruthy();
  expect(screen.getByText('200,00€')).toBeTruthy();
});

it('un errore non diventa un messaggio di tutto sotto controllo e consente di riprovare', () => {
  mocks.useInsights.mockReturnValue({ ...state(), isError: true, insights: [] });
  show();
  expect(screen.getByRole('alert')).toBeTruthy();
  expect(screen.queryByText('1.650,00€')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));
  expect(mocks.retry).toHaveBeenCalledOnce();
});

it('non espone una previsione con storico insufficiente', () => {
  mocks.useInsights.mockReturnValue({ ...state(), forecast: { ...forecast, total: null, available: false, historyDays: 20 }, insights: [] });
  show();
  expect(screen.getByText('Previsione non disponibile')).toBeTruthy();
  expect(screen.queryByText('Entro il budget stimato')).toBeNull();
  expect(screen.queryByText('1.650,00€')).toBeNull();
});

it('distingue assenza di transazioni e caricamento', () => {
  mocks.useInsights.mockReturnValue({ ...state(), isLoading: true });
  const view = show();
  expect(screen.getByRole('status')).toBeTruthy();
  mocks.useInsights.mockReturnValue({ ...state(), forecast: null, insights: [], hasTransactions: false });
  view.rerender(<MemoryRouter><Insights /></MemoryRouter>);
  expect(screen.getByText('Nessuna transazione disponibile')).toBeTruthy();
  expect(screen.queryByRole('link', { name: 'Apri transazioni' })).toBeNull();
});

it('shows category estimates, occasional labels, unbudgeted spending and reconciled totals', () => {
  mocks.useInsights.mockReturnValue({ ...state(),
    categories: [{ id: 'food', name: 'Alimentari', icon: '🛒', spending_pattern: 'occasional' }],
    forecast: { ...forecast, categories: [
      { categoryId: 'food', spent: 1100, scheduled: 150, variable: 300, total: 1550, budget: { limit: 1500 } },
      { categoryId: null, spent: 100, scheduled: 0, variable: 0, total: 100, budget: null },
    ] },
  });
  show();
  const table = screen.getByRole('table', { name: 'Previsione per categoria' });
  const food = within(table).getByRole('row', { name: /Alimentari/ });
  expect(within(food).getByText('Spesa saltuaria')).toBeTruthy();
  expect(within(table).getByRole('columnheader', { name: 'Previsto' })).toBeTruthy();
  expect(within(table).queryByRole('columnheader', { name: 'Fine mese' })).toBeNull();
  expect(within(table).getAllByRole('columnheader')).toHaveLength(5);
  expect(within(food).getByText('450,00€')).toBeTruthy();
  expect(within(food).getByText('+50,00€')).toBeTruthy();
  expect(within(food).getByText('+50,00€').className).toContain('text-destructive');
  const uncategorized = within(table).getByRole('row', { name: /Senza categoria/ });
  expect(within(uncategorized).getAllByText('—')).toHaveLength(2);
  const total = within(table).getByRole('row', { name: /Totale/ });
  expect(within(total).getByText('-150,00€').className).toContain('text-success');
  const toggle = screen.getByRole('button', { name: 'Previsione per categoria' });
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  fireEvent.click(toggle);
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(screen.queryByRole('table', { name: 'Previsione per categoria' })).toBeNull();
  expect(screen.getByRole('heading', { name: 'Previsione per categoria' })).toBeTruthy();
  fireEvent.click(toggle);
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  expect(screen.getByRole('table', { name: 'Previsione per categoria' })).toBeTruthy();
});

it('does not turn insufficient history into category forecasts or an overspend', () => {
  mocks.useInsights.mockReturnValue({ ...state(), forecast: { ...forecast, available: false, total: null, historyDays: 1,
    categories: [{ categoryId: null, spent: 1200, scheduled: 0, variable: 0, total: null, budget: null }],
  } });
  show();
  const table = screen.getByRole('table', { name: 'Previsione per categoria' });
  const row = within(table).getByRole('row', { name: /Senza categoria/ });
  expect(within(row).getAllByText('—')).toHaveLength(3);
});

it('remembers open and closed states after remounting and keeps the preference separate for each user', () => {
  mocks.useInsights.mockReturnValue({ ...state(), forecast: { ...forecast, categories: [
    { categoryId: null, spent: 1200, scheduled: 150, variable: 300, total: 1650, budget: null },
  ] } });
  const toggle = () => screen.getByRole('button', { name: 'Previsione per categoria' });
  let view = show();
  fireEvent.click(toggle());
  view.unmount();
  view = show();
  expect(toggle().getAttribute('aria-expanded')).toBe('false');
  mocks.userId = 'another-user';
  view.rerender(<MemoryRouter><Insights /></MemoryRouter>);
  expect(toggle().getAttribute('aria-expanded')).toBe('true');
  mocks.userId = 'insights-user';
  view.rerender(<MemoryRouter><Insights /></MemoryRouter>);
  expect(toggle().getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(toggle());
  view.unmount();
  show();
  expect(toggle().getAttribute('aria-expanded')).toBe('true');
});

it('colors a negative category variance green and leaves a zero variance neutral', () => {
  mocks.useInsights.mockReturnValue({ ...state(), forecast: { ...forecast, categories: [
    { categoryId: 'food', spent: 100, scheduled: 0, variable: 50, total: 150, budget: { limit: 200 } },
    { categoryId: null, spent: 100, scheduled: 0, variable: 0, total: 100, budget: { limit: 100 } },
  ] } });
  show();
  const table = screen.getByRole('table', { name: 'Previsione per categoria' });
  expect(within(table).getByText('-50,00€').className).toContain('text-success');
  const row = within(table).getByRole('row', { name: /Senza categoria/ });
  const variance = within(row).getAllByRole('cell').at(-1)!;
  expect(variance.className).not.toMatch(/text-success|text-destructive/);
});
