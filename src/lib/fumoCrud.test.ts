import { describe, it, expect } from 'vitest';
import { computeDerived, computeYearlyStats } from '@/lib/fumoCrud';
import type { FumoBaseEntry } from '@/lib/fumoCrud';

describe('FumoCrudPage - computeDerived', () => {
  it('ritorna tutti null quando data_finito è null (record ancora in corso)', () => {
    const r = computeDerived('2026-01-01', null, 10, 100);
    expect(r.giorni_durata).toBeNull();
    expect(r.quantita_al_giorno).toBeNull();
    expect(r.euro_al_giorno).toBeNull();
    expect(r.costo_mensile).toBeNull();
  });

  it('calcola giorni, quantità/giorno, euro/giorno e costo mensile per un intervallo valido', () => {
    // 10 giorni di durata, 20g totali, 100€
    const r = computeDerived('2026-01-01', '2026-01-11', 20, 100);
    expect(r.giorni_durata).toBe(10);
    expect(r.quantita_al_giorno).toBeCloseTo(2, 5);   // 20/10
    expect(r.euro_al_giorno).toBeCloseTo(10, 5);      // 100/10
    expect(r.costo_mensile).toBeCloseTo(300, 5);      // 10 * 30
  });

  it('gestisce quantità null (CBD/THC con grammi opzionali)', () => {
    const r = computeDerived('2026-01-01', '2026-01-11', null, 100);
    expect(r.giorni_durata).toBe(10);
    expect(r.quantita_al_giorno).toBeNull();
    expect(r.euro_al_giorno).toBeCloseTo(10, 5);
    expect(r.costo_mensile).toBeCloseTo(300, 5);
  });

  it('ritorna null quando le date sono invertite (giorni <= 0)', () => {
    const r = computeDerived('2026-01-11', '2026-01-01', 20, 100);
    expect(r.giorni_durata).toBeNull();
    expect(r.quantita_al_giorno).toBeNull();
    expect(r.euro_al_giorno).toBeNull();
    expect(r.costo_mensile).toBeNull();
  });

  it('arrotonda per eccesso i giorni (ceil) per frazioni di giorno', () => {
    // 1.5 giorni -> ceil = 2
    const r = computeDerived('2026-01-01', '2026-01-02T12:00:00', 10, 50);
    expect(r.giorni_durata).toBe(2);
  });
});

describe('FumoCrudPage - computeYearlyStats', () => {
  // Helper per costruire entry di test con campo data_arrivo dinamico.
  const makeEntry = (
    overrides: Partial<FumoBaseEntry> & { data_arrivo: string; costo: number; grammi?: number }
  ): FumoBaseEntry => ({
    id: overrides.id ?? '1',
    user_id: 'u1',
    costo: overrides.costo,
    data_arrivo: overrides.data_arrivo,
    data_finito: overrides.data_finito ?? null,
    giorni_durata: overrides.giorni_durata ?? null,
    euro_al_giorno: overrides.euro_al_giorno ?? null,
    costo_mensile: overrides.costo_mensile ?? null,
    created_at: '',
    updated_at: '',
    ...(overrides.grammi != null ? { grammi: overrides.grammi } : {}),
  });

  it('raggruppa per anno e somma costo + quantità', () => {
    const entries = [
      makeEntry({ id: '1', data_arrivo: '2026-01-01', costo: 100, grammi: 10 }),
      makeEntry({ id: '2', data_arrivo: '2026-06-01', costo: 50, grammi: 5 }),
      makeEntry({ id: '3', data_arrivo: '2025-01-01', costo: 200, grammi: 20 }),
    ];
    const stats = computeYearlyStats(entries, 'data_arrivo');
    // Ordinate per anno decrescente
    expect(stats.map((s) => s.anno)).toEqual([2026, 2025]);
    const y2026 = stats.find((s) => s.anno === 2026)!;
    expect(y2026.costoTotale).toBe(150);
    expect(y2026.extraTotal).toBe(15); // 10 + 5
    expect(y2026.costoMensile).toBeCloseTo(12.5, 5); // 150/12
  });

  it('usa dateArrivoField per leggere la data (supporta data_acquisto)', () => {
    // CBD/THC usano data_acquisto; la entry ha quello, non data_arrivo.
    const entry = {
      ...makeEntry({ id: '1', data_arrivo: '1900-01-01', costo: 100 }),
      data_acquisto: '2026-01-01',
      grammi: 10,
    };
    const stats = computeYearlyStats([entry], 'data_acquisto');
    expect(stats[0].anno).toBe(2026);
  });

  it('restituisce array vuoto per entry vuote', () => {
    expect(computeYearlyStats([], 'data_arrivo')).toEqual([]);
  });

  it('somma anche il campo millilitri quando presente (Liquido)', () => {
    const entry = {
      ...makeEntry({ id: '1', data_arrivo: '2026-01-01', costo: 30 }),
      millilitri: 60,
    };
    const stats = computeYearlyStats([entry], 'data_arrivo');
    expect(stats[0].extraTotal).toBe(60);
  });
});
