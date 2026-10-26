// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Insights from './Insights';
import type { SpendingForecast } from '@/lib/spendingForecast';

const mocks = vi.hoisted(() => ({ useInsights: vi.fn(), retry: vi.fn() }));
vi.mock('@/hooks/useInsights', () => ({ useInsights: mocks.useInsights }));
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
beforeEach(() => { vi.clearAllMocks(); mocks.useInsights.mockReturnValue(state()); });
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
