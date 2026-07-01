import { describe, expect, it } from 'vitest';
import { calculateDerivedFields } from './fumoCalculations';

describe('fumo derived fields', () => {
  it('calculates duration, daily quantity, daily cost and monthly cost', () => {
    expect(calculateDerivedFields('2026-01-01', '2026-01-31', 30, 150)).toEqual({
      giorni_durata: 30,
      quantita_al_giorno: 1,
      euro_al_giorno: 5,
      costo_mensile: 150,
    });
  });

  it('returns null derived fields when finish date or quantity is missing', () => {
    expect(calculateDerivedFields('2026-01-01', null, 30, 150)).toEqual({
      giorni_durata: null,
      quantita_al_giorno: null,
      euro_al_giorno: null,
      costo_mensile: null,
    });

    expect(calculateDerivedFields('2026-01-01', '2026-01-31', 0, 150)).toEqual({
      giorni_durata: null,
      quantita_al_giorno: null,
      euro_al_giorno: null,
      costo_mensile: null,
    });
  });

  it('returns null derived fields when dates are invalid or reversed', () => {
    expect(calculateDerivedFields('invalid-date', '2026-01-31', 30, 150)).toEqual({
      giorni_durata: null,
      quantita_al_giorno: null,
      euro_al_giorno: null,
      costo_mensile: null,
    });

    expect(calculateDerivedFields('2026-01-31', '2026-01-01', 30, 150)).toEqual({
      giorni_durata: null,
      quantita_al_giorno: null,
      euro_al_giorno: null,
      costo_mensile: null,
    });
  });
});
