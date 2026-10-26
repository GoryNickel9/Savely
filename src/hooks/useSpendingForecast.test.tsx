// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import fixture from '../test/fixtures/forecast-baseline.json';
import { useSpendingForecast } from './useSpendingForecast';
const mock = vi.hoisted(() => ({ id: '11111111-1111-4111-8111-111111111111', login: '2026-10-15', token: 'synthetic' }));
vi.mock('./useAuth', () => ({ useAuth: () => ({ user: { id: mock.id }, session: { user: { id: mock.id, last_sign_in_at: mock.login } } }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { user: { id: mock.id, last_sign_in_at: mock.login }, access_token: mock.token } } }) } } }));
const response = () => ({ ...fixture.cases[3].response, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { ...renderHook(() => useSpendingForecast('2026-10-15'), { wrapper }), client };
}
beforeEach(() => { mock.id = fixture.cases[3].response.userId; mock.login = '2026-10-15'; vi.stubGlobal('fetch', vi.fn(async () => Response.json(response()))); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('loads only server cents using the current access token', async () => {
  const { result } = setup(); await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data?.forecast.total).toBe(fixture.cases[3].forecast.total);
  expect(fetch).toHaveBeenCalledWith('/api/spending-forecast', expect.objectContaining({ method: 'POST', cache: 'no-store', headers: expect.objectContaining({ Authorization: 'Bearer synthetic' }) }));
  const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
  expect(Object.keys(body).sort()).toEqual(['schemaVersion', 'timeZone']);
});
it('exposes network errors and keeps the last valid response in the account cache', async () => {
  const { result } = setup(); await waitFor(() => expect(result.current.isSuccess).toBe(true));
  const last = result.current.data;
  vi.mocked(fetch).mockRejectedValue(new TypeError('offline'));
  await result.current.refetch();
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.data).toBe(last);
});
it('does not publish an old response after changing accounts during the request', async () => {
  let resolve!: (value: Response) => void;
  vi.mocked(fetch).mockImplementation(() => new Promise(value => { resolve = value; }));
  const { result, client, rerender } = setup(); await waitFor(() => expect(fetch).toHaveBeenCalled());
  mock.id = '22222222-2222-4222-8222-222222222222';
  resolve(Response.json(response()));
  rerender();
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  const previous = client.getQueryCache().findAll({ queryKey: ['spending-forecast', fixture.cases[3].response.userId] })[0];
  expect(previous.state.data).toBeUndefined();
  expect(previous.state.fetchStatus).toBe('idle');
  expect(result.current.data).toBeUndefined();
});
