// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { useAuthMock, getUserPermissionsMock, clearPermissionsCacheMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  getUserPermissionsMock: vi.fn(),
  clearPermissionsCacheMock: vi.fn(),
}));

vi.mock('@/hooks/useAuth', () => ({ useAuth: useAuthMock }));

vi.mock('@/lib/permissions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/permissions')>();
  return {
    ...actual,
    getUserPermissions: getUserPermissionsMock,
    clearPermissionsCache: clearPermissionsCacheMock,
  };
});

import { usePermissions } from './usePermissions';
import { getDefaultPermissions } from '@/lib/permissions';

const STORAGE_KEY = 'savely_permissions';
const adminPerms = { ...getDefaultPermissions(), admin: true };

describe('usePermissions', () => {
  beforeEach(() => {
    localStorage.clear();
    getUserPermissionsMock.mockReset();
    clearPermissionsCacheMock.mockReset();
  });

  it('inizializza dalla cache localStorage, normalizzando i valori non booleani', async () => {
    // {admin: 'hack'} deve diventare false (guard TD-008), {poker: true} resta
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ admin: 'hack', poker: true }));
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

  it('carica i permessi dal DB e li salva in cache', async () => {
    useAuthMock.mockReturnValue({ user: { id: 'u1' } });
    getUserPermissionsMock.mockResolvedValue(adminPerms);

    const { result } = renderHook(() => usePermissions());

    await waitFor(() => {
      expect(result.current.permissions).toEqual(adminPerms);
    });
    expect(getUserPermissionsMock).toHaveBeenCalledWith('u1');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(adminPerms));
  });

  it('senza utente azzera i permessi e rimuove la cache', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(adminPerms));
    useAuthMock.mockReturnValue({ user: null });

    const { result } = renderHook(() => usePermissions());

    await waitFor(() => {
      expect(result.current.permissions).toBeNull();
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(getUserPermissionsMock).not.toHaveBeenCalled();
  });

  it('in caso di errore azzera permessi e cache e invalida la cache interna', async () => {
    useAuthMock.mockReturnValue({ user: { id: 'u1' } });
    getUserPermissionsMock.mockRejectedValue(new Error('db down'));

    const { result } = renderHook(() => usePermissions());

    await waitFor(() => {
      expect(result.current.permissions).toBeNull();
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(clearPermissionsCacheMock).toHaveBeenCalledWith('u1');
  });
});
