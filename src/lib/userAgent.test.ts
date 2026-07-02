import { describe, it, expect } from 'vitest';
import { parseUserAgent } from './userAgent';

describe('parseUserAgent', () => {
  it('riconosce Chrome su Windows desktop', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
    const parsed = parseUserAgent(ua);
    expect(parsed.browser).toBe('Chrome');
    expect(parsed.os).toBe('Windows');
    expect(parsed.kind).toBe('desktop');
  });

  it('riconosce Safari su iPhone mobile', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    const parsed = parseUserAgent(ua);
    expect(parsed.browser).toBe('Safari');
    expect(parsed.os).toBe('iOS');
    expect(parsed.kind).toBe('mobile');
  });

  it('riconosce Firefox su macOS desktop', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.0; rv:121.0) Gecko/20100101 Firefox/121.0';
    const parsed = parseUserAgent(ua);
    expect(parsed.browser).toBe('Firefox');
    expect(parsed.os).toBe('macOS');
    expect(parsed.kind).toBe('desktop');
  });

  it('riconosce Edge (prima di Chrome) su Windows', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
    const parsed = parseUserAgent(ua);
    expect(parsed.browser).toBe('Microsoft Edge');
  });

  it('gestisce input nullo o vuoto', () => {
    expect(parseUserAgent(null).browser).toBe('Sconosciuto');
    expect(parseUserAgent('').browser).toBe('Sconosciuto');
    expect(parseUserAgent(undefined).kind).toBe('unknown');
  });

  it('riconosce Android mobile', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';
    const parsed = parseUserAgent(ua);
    expect(parsed.os).toBe('Android');
    expect(parsed.kind).toBe('mobile');
  });
});
