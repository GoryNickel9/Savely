import { describe, it, expect } from 'vitest';
import { validateTotpCode, extractSecretFromUri, extractLabelFromUri } from './mfa';

describe('validateTotpCode', () => {
  it('accetta un codice di 6 cifre', () => {
    expect(validateTotpCode('123456')).toBeNull();
  });

  it('accetta codici con spazi o trattini (vengono ignorati)', () => {
    expect(validateTotpCode('123 456')).toBeNull();
    expect(validateTotpCode('123-456')).toBeNull();
  });

  it('rifiuta codici con lettere', () => {
    expect(validateTotpCode('12a456')).toBe('Il codice deve essere di 6 cifre');
  });

  it('rifiuta codici troppo corti o troppo lunghi', () => {
    expect(validateTotpCode('12345')).toBe('Il codice deve essere di 6 cifre');
    expect(validateTotpCode('1234567')).toBe('Il codice deve essere di 6 cifre');
  });

  it('rifiuta input non stringa', () => {
    expect(validateTotpCode(123456 as unknown as string)).toBe('Codice non valido');
  });
});

describe('extractSecretFromUri', () => {
  it('estrae il secret da un otpauth URI valido', () => {
    const uri = 'otpauth://totp/Savely:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Savely';
    expect(extractSecretFromUri(uri)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('estrae il secret anche quando non è il primo parametro', () => {
    const uri = 'otpauth://totp/Savely:user?issuer=Savely&secret=ABCDEFG12345';
    expect(extractSecretFromUri(uri)).toBe('ABCDEFG12345');
  });

  it('ritorna null se manca il secret', () => {
    expect(extractSecretFromUri('otpauth://totp/Savely?issuer=Savely')).toBeNull();
  });

  it('ritorna null per input non stringa', () => {
    expect(extractSecretFromUri(null as unknown as string)).toBeNull();
  });
});

describe('extractLabelFromUri', () => {
  it('estrae il label dal path', () => {
    const uri = 'otpauth://totp/Savely:user@example.com?secret=X';
    expect(extractLabelFromUri(uri)).toBe('Savely:user@example.com');
  });

  it('ritorna null per URI malformato', () => {
    expect(extractLabelFromUri('https://example.com')).toBeNull();
  });
});
