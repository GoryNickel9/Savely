/**
 * User-agent parsing helpers (pure, unit-tested).
 * Used by the "Accessi recenti" UI to show a friendly device/browser label
 * instead of a raw UA string.
 */

export type DeviceKind = 'mobile' | 'desktop' | 'unknown';

export interface ParsedUserAgent {
  browser: string;
  os: string;
  kind: DeviceKind;
}

/**
 * Parse a navigator.userAgent string into a friendly browser/os/kind triple.
 * Defensive: returns 'unknown' values for empty or malformed input.
 */
export function parseUserAgent(ua: string | null | undefined): ParsedUserAgent {
  if (!ua || typeof ua !== 'string') {
    return { browser: 'Sconosciuto', os: 'Sconosciuto', kind: 'unknown' };
  }

  return {
    browser: detectBrowser(ua),
    os: detectOs(ua),
    kind: detectKind(ua),
  };
}

function detectBrowser(ua: string): string {
  // Order matters: Edg must be checked before Chrome, OPR before Chrome, etc.
  if (/edg\//i.test(ua)) return 'Microsoft Edge';
  if (/opr\/|opera/i.test(ua)) return 'Opera';
  if (/firefox|fxios/i.test(ua)) return 'Firefox';
  if (/chrome|crios/i.test(ua)) return 'Chrome';
  if (/safari/i.test(ua)) return 'Safari';
  return 'Browser';
}

function detectOs(ua: string): string {
  if (/windows nt/i.test(ua)) return 'Windows';
  if (/android/i.test(ua)) return 'Android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
  if (/mac os x|macintosh/i.test(ua)) return 'macOS';
  if (/linux/i.test(ua)) return 'Linux';
  return 'Sconosciuto';
}

function detectKind(ua: string): DeviceKind {
  if (/mobi|iphone|ipod|android.*mobile|windows phone/i.test(ua)) return 'mobile';
  if (/ipad|tablet|android(?!.*mobile)/i.test(ua)) return 'mobile';
  return 'desktop';
}
