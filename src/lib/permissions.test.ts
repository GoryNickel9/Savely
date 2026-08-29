import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  parsePermissions,
  getDefaultPermissions,
  clearAllPermissionsCache,
  getUserPermissions,
} from './permissions';

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: fromMock },
}));

describe('parsePermissions', () => {
  it('returns all defaults for null, undefined or non-object values', () => {
    const defaults = getDefaultPermissions();

    expect(parsePermissions(null)).toEqual(defaults);
    expect(parsePermissions(undefined)).toEqual(defaults);
    expect(parsePermissions('admin')).toEqual(defaults);
    expect(parsePermissions(42)).toEqual(defaults);
  });

  it('returns all defaults for arrays', () => {
    // Un array è un oggetto: deve comunque essere rifiutato.
    expect(parsePermissions(['admin'])).toEqual(getDefaultPermissions());
  });

  it('returns all defaults for an empty object', () => {
    expect(parsePermissions({})).toEqual(getDefaultPermissions());
  });

  it('preserves valid booleans', () => {
    const result = parsePermissions({ admin: true, poker: false, fire: true });

    expect(result.admin).toBe(true);
    expect(result.poker).toBe(false);
    expect(result.fire).toBe(true);
    expect(result.fumo).toBe(false);
  });

  it('coerces non-boolean values to false (hardened localStorage guard, TD-008)', () => {
    // Prima del fix un valore truthy come "ciao" superava il type guard
    // e finiva nello stato dei permessi.
    const result = parsePermissions({ admin: 'ciao', poker: 1, tcg: true });

    expect(result.admin).toBe(false);
    expect(result.poker).toBe(false);
    expect(result.tcg).toBe(true);
  });

  it('ignores unknown extra keys', () => {
    const result = parsePermissions({ admin: true, hacker: true, superuser: 1 });

    expect(result).toEqual({ ...getDefaultPermissions(), admin: true });
    expect('hacker' in result).toBe(false);
    expect('superuser' in result).toBe(false);
  });

  it('handles null and undefined field values', () => {
    const result = parsePermissions({ admin: null, poker: undefined, fumo: true });

    expect(result.admin).toBe(false);
    expect(result.poker).toBe(false);
    expect(result.fumo).toBe(true);
  });
});

describe('getUserPermissions', () => {
  type QueryResult = { data: unknown; error: { message: string } | null };

  /** Catena thenable che replica il builder Supabase (select → eq → maybeSingle). */
  const chain = (result: QueryResult) => ({
    select: () => ({
      eq: () => ({
        maybeSingle: () => Promise.resolve(result),
      }),
    }),
  });

  beforeEach(() => {
    fromMock.mockReset();
    clearAllPermissionsCache();
  });

  it('restituisce i permessi del profilo quando la riga esiste', async () => {
    fromMock.mockImplementation(() => chain({ data: { permissions: { admin: true } }, error: null }));

    await expect(getUserPermissions('u1')).resolves.toEqual({
      ...getDefaultPermissions(),
      admin: true,
    });
  });

  it('profilo assente senza errore restituisce i default (utente in attesa del trigger)', async () => {
    fromMock.mockImplementation(() => chain({ data: null, error: null }));

    await expect(getUserPermissions('u1')).resolves.toEqual(getDefaultPermissions());
  });

  it('un errore DB propaga l\'eccezione invece di restituire i default', async () => {
    // Prima del fix un errore (token in rinnovo, rete) veniva mascherato dai
    // default tutti-false, che finivano anche in cache corrompendola.
    fromMock.mockImplementation(() => chain({ data: null, error: { message: 'JWT expired' } }));

    await expect(getUserPermissions('u1')).rejects.toEqual({ message: 'JWT expired' });
  });

  it('usa la cache interna entro il TTL senza interrogare di nuovo il DB', async () => {
    fromMock.mockImplementation(() => chain({ data: { permissions: { tcg: true } }, error: null }));

    await getUserPermissions('u1');
    await getUserPermissions('u1');

    expect(fromMock).toHaveBeenCalledTimes(1);
  });
});
