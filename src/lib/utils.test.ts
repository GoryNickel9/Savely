import { describe, expect, it } from 'vitest';
import { parseAmount, parseLocalDate } from './utils';

describe('parseAmount (H4 - tolleranza formato italiano)', () => {
  it('parsa la virgola come separatore decimale', () => {
    expect(parseAmount('10,50')).toBe(10.5);
  });

  it('parsa il formato italiano con migliaia e decimali', () => {
    expect(parseAmount('1.234,56')).toBe(1234.56);
  });

  it('parsa il formato con punto decimale', () => {
    expect(parseAmount('10.50')).toBe(10.5);
  });

  it('gestisce valori numerici in ingresso', () => {
    expect(parseAmount(42)).toBe(42);
  });

  it('ritorna NaN per stringa vuota o null', () => {
    expect(parseAmount('')).toBeNaN();
    expect(parseAmount(null)).toBeNaN();
    expect(parseAmount(undefined)).toBeNaN();
  });

  it('ritorna NaN per input non numerici', () => {
    expect(parseAmount('abc')).toBeNaN();
  });

  it('gestisce i whitespace', () => {
    expect(parseAmount('  12,30  ')).toBe(12.3);
  });
});

describe('parseLocalDate (H5 - parsing ora locale)', () => {
  it('parsa le date solo-data ("YYYY-MM-DD") come mezzanotte locale', () => {
    const d = parseLocalDate('2026-07-15');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6); // luglio (0-indexed)
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(0);
  });

  it('preserva il giorno corretto indipendentemente dal fuso orario', () => {
    // Una data "2026-01-01" non deve mai diventare 31 dicembre dell'anno prima
    const d = parseLocalDate('2026-01-01');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(1);
  });

  it('passa invariate le stringhe ISO datetime complete', () => {
    const d = parseLocalDate('2026-07-15T10:30:00');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getHours()).toBe(10);
  });

  it('ritorna una data invalida per stringa vuota', () => {
    expect(isNaN(parseLocalDate('').getTime())).toBe(true);
  });
});
