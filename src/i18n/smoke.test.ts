import { describe, it, expect } from 'vitest';
import i18n, { detectBrowserLanguage } from './index';

describe('rilevamento lingua dal browser', () => {
  it('browser in italiano → italiano', () => {
    expect(detectBrowserLanguage(['it-IT', 'en-US'])).toBe('it');
    expect(detectBrowserLanguage(['it'])).toBe('it');
    expect(detectBrowserLanguage(['it-CH'])).toBe('it');
  });

  it('browser in qualunque altra lingua → inglese', () => {
    expect(detectBrowserLanguage(['de-DE', 'it'])).toBe('it'); // il secondo in lista conta come preferenza italiana
    expect(detectBrowserLanguage(['de-DE', 'fr-FR'])).toBe('en');
    expect(detectBrowserLanguage(['en-US'])).toBe('en');
    expect(detectBrowserLanguage(['es-ES', 'pt-BR'])).toBe('en');
    expect(detectBrowserLanguage([undefined])).toBe('en');
    expect(detectBrowserLanguage([])).toBe('en');
  });
});

describe('i18n natural keys', () => {
  it('italiano: chiave mancante degrada alla chiave stessa', () => {
    i18n.changeLanguage('it');
    expect(i18n.t('Transazioni')).toBe('Transazioni');
  });

  it('inglese: traduce le chiavi note', () => {
    i18n.changeLanguage('en');
    expect(i18n.t('Transazioni')).not.toBe('Transazioni');
    expect(i18n.t('Transazioni')).toBe('Transactions');
  });

  it('inglese: chiave mancante degrada in italiano', () => {
    i18n.changeLanguage('en');
    expect(i18n.t('Chiave inesistente xyz')).toBe('Chiave inesistente xyz');
  });

  it('interpolazione preservata', () => {
    i18n.changeLanguage('en');
    expect(i18n.t('Totale: {{amount}}', { amount: 'X' })).toContain('X');
  });
});
