// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { useAuthMock, toastMock, toastErrorMock, fromMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  toastMock: vi.fn(),
  toastErrorMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock('@/hooks/useAuth', () => ({ useAuth: useAuthMock }));
vi.mock('sonner', () => ({ toast: Object.assign(toastMock, { error: toastErrorMock }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

type MockResult = { data: unknown[] | null; error: { message: string } | null };
let mockResult: MockResult = { data: [], error: null };

/** Catena thenable che replica il builder Supabase (select → eq → order). */
const chain = {
  select: vi.fn(() => chain),
  eq: vi.fn(() => chain),
  order: vi.fn(() => chain),
  then: (resolve: (r: MockResult) => void) => Promise.resolve().then(() => resolve(mockResult)),
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: fromMock },
}));

import { useSupabaseData } from './useSupabaseData';

interface Row {
  id: string;
  name: string;
}

/** Wrapper con QueryClient isolato per test (hook basato su React Query). */
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useSupabaseData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResult = { data: [], error: null };
    fromMock.mockImplementation(() => chain);
  });

  it('carica le righe filtrate per user_id e ordinate', async () => {
    useAuthMock.mockReturnValue({ user: { id: 'u1' } });
    mockResult = { data: [{ id: '1', name: 'spesa' }], error: null };

    const { result } = renderHook(
      () => useSupabaseData<Row>({ tableName: 'categories', orderBy: 'created_at' }),
      { wrapper: createWrapper() },
    );

    expect(result.current.loading).toBe(true);
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.data).toEqual([{ id: '1', name: 'spesa' }]);

    expect(fromMock).toHaveBeenCalledWith('categories');
    expect(chain.select).toHaveBeenCalledWith('*');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(toastMock).not.toHaveBeenCalled();
  });

  it('in caso di errore mostra il toast e mantiene data vuoto', async () => {
    useAuthMock.mockReturnValue({ user: { id: 'u1' } });
    mockResult = { data: null, error: { message: 'RLS violation' } };

    const { result } = renderHook(
      () => useSupabaseData<Row>({ tableName: 'budgets' }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.data).toEqual([]);
    expect(toastErrorMock).toHaveBeenCalledWith('Errore', {
      description: 'Impossibile caricare i dati',
    });
  });

  it('senza utente non esegue alcuna query', async () => {
    useAuthMock.mockReturnValue({ user: null });

    const { result } = renderHook(
      () => useSupabaseData<Row>({ tableName: 'budgets' }),
      { wrapper: createWrapper() },
    );

    // Un tick per far girare la query (disabilitata senza utente)
    await waitFor(() => {
      expect(result.current).toBeDefined();
    });
    expect(fromMock).not.toHaveBeenCalled();
  });
});
