// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useTransactionBalance } from './useTransactionBalance';

const mocks = vi.hoisted(() => ({ user: { id: 'u1' } as { id: string } | null, rpc: vi.fn(), single: vi.fn() }));
vi.mock('./useAuth', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: mocks.rpc } }));

const end = new Date(2026, 9, 26);
const previous = new Date(2026, 8, 30);
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(({ date }) => useTransactionBalance(date, previous), { wrapper, initialProps: { date: end } }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: 'u1' };
  mocks.rpc.mockReturnValue({ abortSignal: () => ({ single: mocks.single }) });
  mocks.single.mockResolvedValue({ data: { balance: '12345.67', previous_balance: '10000.00' }, error: null });
});
afterEach(cleanup);

it('usa date locali e converte gli importi numerici senza dipendere dalle righe caricate', async () => {
  const { result } = setup();
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(mocks.rpc).toHaveBeenCalledWith('get_transaction_balance', {
    p_date: '2026-10-26', p_previous_date: '2026-09-30',
  });
  expect(result.current.data).toEqual({ balance: 12345.67, previousBalance: 10000 });
});

it('ricarica il saldo quando il CRUD o un import invalida le transazioni', async () => {
  const { result, client } = setup();
  await waitFor(() => expect(result.current.data?.balance).toBe(12345.67));
  mocks.single.mockResolvedValue({ data: { balance: 16000, previous_balance: 15000 }, error: null });
  await act(async () => { await client.invalidateQueries({ queryKey: ['transactions'] }); });
  expect(mocks.rpc).toHaveBeenCalledTimes(2);
  await waitFor(() => expect(result.current.data?.balance).toBe(16000));
});

it('cambia query al cambiare della data finale', async () => {
  const { result, rerender } = setup();
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  rerender({ date: new Date(2026, 9, 1) });
  await waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(2));
  expect(mocks.rpc).toHaveBeenLastCalledWith('get_transaction_balance', {
    p_date: '2026-10-01', p_previous_date: '2026-09-30',
  });
});

it.each([
  { data: null, error: new Error('RPC failed') },
  { data: { balance: null, previous_balance: 0 }, error: null },
  { data: { balance: 'NaN', previous_balance: 0 }, error: null },
])('segnala un errore senza inventare un saldo zero', async (response) => {
  mocks.single.mockResolvedValue(response);
  const { result } = setup();
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.data).toBeUndefined();
});

it('accetta un saldo zero valido', async () => {
  mocks.single.mockResolvedValue({ data: { balance: 0, previous_balance: 0 }, error: null });
  const { result } = setup();
  await waitFor(() => expect(result.current.data?.balance).toBe(0));
});

it('non interroga il database senza sessione', () => {
  mocks.user = null;
  setup();
  expect(mocks.rpc).not.toHaveBeenCalled();
});
