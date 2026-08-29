// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { useAuthMock, getUserPermissionsMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  getUserPermissionsMock: vi.fn(),
}));

vi.mock('@/hooks/useAuth', () => ({ useAuth: useAuthMock }));

vi.mock('@/lib/permissions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/permissions')>();
  return {
    ...actual,
    getUserPermissions: getUserPermissionsMock,
  };
});

import { usePermissions, FETCH_ATTEMPTS, RETRY_DELAY_MS } from './usePermissions';
import { getDefaultPermissions } from '@/lib/permissions';
import type { Permissions } from '@/lib/types';

const STORAGE_KEY = 'savely_permissions';
const adminPerms = { ...getDefaultPermissions(), admin: true };
const pokerPerms = { ...getDefaultPermissions(), poker: true };

const writeCache = (userId: string, permissions: Permissions | Record<string, unknown>) =>
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ userId, permissions }));

describe('usePermissions', () => {
  beforeEach(() => {
    localStorage.clear();
    getUserPermissionsMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('inizializza dalla cache localStorage, normalizzando i valori non booleani', async () => {
    // {admin: 'hack'} deve diventare false (guard TD-008), {poker: true} resta
    writeCache('u1', { admin: 'hack', poker: true });
    useAuthMock.mockReturnValue({ user: { id: 'u1' } });
    getUserPermissionsMock.mockResolvedValue(adminPerms);

    const { result } = renderHook(() => usePermissions());

    // Stato iniziale: cache già normalizzata, prima del fetch dal DB
    expect(result.current.permissions).toEqual({
      ...getDefaultPermissions(),
      poker: true,
    });

    await waitFor(() => {
      expect(result.current.permissions?.admin).toBe(true);
    });
    expect(localStorage.getItem(STORAGE_KEY)).toContain('"admin":true');
  });

  it('parte in loading e attende il fetch prima di esporre i permessi', async () => {
    useAuthMock.mockReturnValue({ user: { id: 'u1' } });
    let resolveFetch!: (p: Permissions) => void;
    getUserPermissionsMock.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );

    const { result } = renderHook(() => usePermissions());

    expect(result.current.loading).toBe(true);
    expect(result.current.permissions).toBeNull();

    await act(async () => {
      resolveFetch(adminPerms);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.permissions).toEqual(adminPerms);
  });

  it('carica i permessi dal DB e li salva in cache legati all\'utente', async () => {
    useAuthMock.mockReturnValue({ user: { id: 'u1' } });
    getUserPermissionsMock.mockResolvedValue(adminPerms);

    const { result } = renderHook(() => usePermissions());

    await waitFor(() => {
      expect(result.current.permissions).toEqual(adminPerms);
    });
    expect(getUserPermissionsMock).toHaveBeenCalledWith('u1');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(
      JSON.stringify({ userId: 'u1', permissions: adminPerms })
    );
  });

  it('scarta i permessi in cache appartenenti a un altro utente', async () => {
    // Browser condiviso: la sessione è di uB ma la cache risale a uA
    writeCache('uA', adminPerms);
    useAuthMock.mockReturnValue({ user: { id: 'uB' } });
    let resolveFetch!: (p: Permissions) => void;
    getUserPermissionsMock.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );

    const { result } = renderHook(() => usePermissions());

    // Appena l'auth rivela l'utente, la cache di uA viene scartata mentre
    // si attende il fetch per uB
    expect(result.current.permissions).toBeNull();

    await act(async () => {
      resolveFetch(pokerPerms);
    });

    expect(result.current.permissions).toEqual(pokerPerms);
    expect(getUserPermissionsMock).toHaveBeenCalledWith('uB');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(
      JSON.stringify({ userId: 'uB', permissions: pokerPerms })
    );
  });

  it('riprova dopo un errore transitorio e poi riscrive la cache', async () => {
    vi.useFakeTimers();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    useAuthMock.mockReturnValue({ user: { id: 'u1' } });
    getUserPermissionsMock
      .mockRejectedValueOnce(new Error('token scaduto'))
      .mockResolvedValueOnce(adminPerms);

    const { result } = renderHook(() => usePermissions());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS + 500);
    });

    expect(getUserPermissionsMock).toHaveBeenCalledTimes(2);
    expect(result.current.permissions).toEqual(adminPerms);
    expect(result.current.loading).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toContain('"userId":"u1"');
    consoleErrorSpy.mockRestore();
  });

  it('dopo errori persistenti conserva cache e stato invece di azzerarli', async () => {
    vi.useFakeTimers();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    writeCache('u1', adminPerms);
    useAuthMock.mockReturnValue({ user: { id: 'u1' } });
    getUserPermissionsMock.mockRejectedValue(new Error('db down'));

    const { result } = renderHook(() => usePermissions());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(FETCH_ATTEMPTS * RETRY_DELAY_MS + 1000);
    });

    expect(getUserPermissionsMock).toHaveBeenCalledTimes(FETCH_ATTEMPTS);
    expect(result.current.permissions).toEqual(adminPerms);
    expect(result.current.loading).toBe(false);
    // La cache non viene corrotta: un errore non è "permessi tutti falsi"
    expect(localStorage.getItem(STORAGE_KEY)).toBe(
      JSON.stringify({ userId: 'u1', permissions: adminPerms })
    );
    consoleErrorSpy.mockRestore();
  });

  it('senza utente azzera i permessi e rimuove la cache', async () => {
    writeCache('u1', adminPerms);
    useAuthMock.mockReturnValue({ user: null });

    const { result } = renderHook(() => usePermissions());

    await waitFor(() => {
      expect(result.current.permissions).toBeNull();
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(getUserPermissionsMock).not.toHaveBeenCalled();
  });
});
