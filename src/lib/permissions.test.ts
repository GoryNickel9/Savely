import { describe, expect, it } from 'vitest';
import { parsePermissions, getDefaultPermissions } from './permissions';

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
