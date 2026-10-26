// @vitest-environment jsdom
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useTransactions } from './useTransactions';

const mocks = vi.hoisted(() => ({ user: { id: 'u1' } as { id: string } | null, from: vi.fn() }));
vi.mock('./useAuth', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mocks.from } }));

type Page = { data: { id: string; date: string }[] | null; count: number | null; error: Error | null };
let pages: Page[];
const chain = {
  select: vi.fn(() => chain), eq: vi.fn(() => chain), is: vi.fn(() => chain),
  order: vi.fn(() => chain), range: vi.fn(() => chain), abortSignal: vi.fn(() => chain),
  then: (resolve: (result: Page) => void) => Promise.resolve().then(() => resolve(pages.shift()!)),
};

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(useTransactions, { wrapper }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: 'u1' };
  mocks.from.mockReturnValue(chain);
  pages = [];
});
afterEach(cleanup);

it('carica tutte le 1221 righe, anche quando molte condividono la data', async () => {
  const first = Array.from({ length: 1000 }, (_, index) => ({ id: `recent-${index}`, date: '2026-10-01' }));
  const last = Array.from({ length: 221 }, (_, index) => ({ id: `old-${index}`, date: '2023-06-01' }));
  pages = [{ data: first, count: 1221, error: null }, { data: last, count: 1221, error: null }];
  const { result } = setup();
  await waitFor(() => expect(result.current.transactions).toHaveLength(1221));
  expect(result.current.transactions.map(row => row.id)).toEqual([...first, ...last].map(row => row.id));
  expect(chain.range.mock.calls).toEqual([[0, 999], [1000, 1999]]);
  expect(chain.order.mock.calls).toEqual([
    ['date', { ascending: false }], ['id', { ascending: false }],
    ['date', { ascending: false }], ['id', { ascending: false }],
  ]);
  expect(chain.eq).toHaveBeenCalledWith('user_id', 'u1');
  expect(chain.is).toHaveBeenCalledWith('deleted_at', null);
});

it('continua anche se il server restituisce pagine più piccole del limite richiesto', async () => {
  pages = [
    { data: [{ id: 'a', date: '2026-10-01' }], count: 2, error: null },
    { data: [{ id: 'b', date: '2026-09-01' }], count: 2, error: null },
  ];
  const { result } = setup();
  await waitFor(() => expect(result.current.transactions).toHaveLength(2));
  expect(chain.range.mock.calls).toEqual([[0, 999], [1, 1000]]);
});

it.each(['error', 'empty', 'count-changed', 'duplicate'] as const)(
  'non pubblica uno storico parziale quando la seconda pagina è %s', async (failure) => {
    const row = { id: 'a', date: '2026-10-01' };
    pages = [
      { data: [row], count: 2, error: null },
      {
        data: failure === 'empty' ? [] : [row],
        count: failure === 'count-changed' ? 3 : 2,
        error: failure === 'error' ? new Error('network failure') : null,
      },
    ];
    const { result, client } = setup();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.transactions).toEqual([]);
    expect(client.getQueryState(['transactions', 'u1'])?.status).toBe('error');
  },
);

it('restituisce lo storico vuoto con una sola richiesta', async () => {
  pages = [{ data: [], count: 0, error: null }];
  const { result } = setup();
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.transactions).toEqual([]);
  expect(mocks.from).toHaveBeenCalledTimes(1);
});

it('non interroga il database senza sessione', () => {
  mocks.user = null;
  setup();
  expect(mocks.from).not.toHaveBeenCalled();
});
