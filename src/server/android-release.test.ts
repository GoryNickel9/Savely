import { Writable } from 'node:stream';
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import download from '../../api/android-download';
import update from '../../api/android-update';
import { DOWNLOAD_URL, MAX_APK_BYTES, validTag } from '../../server/android-release';
import type { VercelRequest, VercelResponse } from '../../api/vercel';

const bytes = Buffer.from('signed APK fixture');
const digest = createHash('sha256').update(bytes).digest('hex');
const tag = 'v0.1.33-alpha';
function release(version = tag, overrides: Record<string, unknown> = {}) {
  return { tag_name: version, draft: false, prerelease: version.includes('-'),
    html_url: `https://github.com/GoryNickel9/Savely-Android/releases/tag/${version}`,
    assets: [{ id: 123, name: 'Savely.apk', state: 'uploaded', size: bytes.length, digest: `sha256:${digest}` }], ...overrides };
}
class ResponseSink extends Writable {
  statusCode = 200;
  headersSent = false;
  headers = new Map<string, string>();
  chunks: Buffer[] = [];
  payload: unknown;
  status(code: number) { this.statusCode = code; return this; }
  setHeader(name: string, value: string) { this.headers.set(name.toLowerCase(), value); return this; }
  json(value: unknown) { this.payload = value; this.end(); return this; }
  _write(chunk: Buffer, _encoding: string, callback: (error?: Error | null) => void) { this.headersSent = true; this.chunks.push(Buffer.from(chunk)); callback(); }
  get response() { return this as unknown as VercelResponse; }
}
const request = (overrides: Partial<VercelRequest> = {}): VercelRequest => ({ method: 'GET', headers: { authorization: 'Bearer user-session' }, query: { tag, sha256: digest }, ...overrides });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubEnv('GH_TOKEN', 'private-github-token');
  vi.stubEnv('SUPABASE_ANON_KEY', 'public-project-key');
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation(async url => {
    if (String(url).includes('/auth/v1/user')) return json({ id: 'savely-user', is_anonymous: false });
    if (String(url).endsWith('/assets/123')) return new Response(bytes, { headers: { 'Content-Length': String(bytes.length) } });
    return json(release());
  });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('authenticated APK proxy', () => {
  it('rejects missing, malformed and multiple bearer headers before contacting any service', async () => {
    for (const authorization of [undefined, '', 'Basic abc', 'Bearer a b', ['Bearer a', 'Bearer b']]) {
      const res = new ResponseSink();
      await download(request({ headers: { authorization } as VercelRequest['headers'] }), res.response);
      expect(res.statusCode).toBe(401);
      expect(res.headers.get('cache-control')).toContain('no-store');
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects expired sessions and anonymous accounts without consulting GitHub', async () => {
    for (const response of [json({}, 401), json({}, 403), json({ id: 'anonymous', is_anonymous: true }), json({})]) {
      fetchMock.mockResolvedValueOnce(response);
      const res = new ResponseSink();
      await download(request(), res.response);
      expect(res.statusCode).toBe(401);
    }
    expect(fetchMock.mock.calls.every(([url]) => String(url).includes('/auth/v1/user'))).toBe(true);
  });

  it('streams verified bytes with private caching and never forwards the user token to GitHub', async () => {
    const res = new ResponseSink();
    await download(request(), res.response);
    expect(res.statusCode).toBe(200);
    expect(Buffer.concat(res.chunks)).toEqual(bytes);
    expect(res.headers.get('content-type')).toBe('application/vnd.android.package-archive');
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="Savely.apk"');
    expect(res.headers.get('content-length')).toBe(String(bytes.length));
    expect(res.headers.get('vercel-cdn-cache-control')).toBe('no-store');
    expect(fetchMock.mock.calls).toHaveLength(3);
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({ Authorization: 'Bearer user-session' });
    expect(fetchMock.mock.calls[1][1]?.headers).toMatchObject({ Authorization: 'Bearer private-github-token' });
    expect(JSON.stringify(res.payload)).toBeUndefined();
  });

  it('rejects a replaced APK and malformed queries', async () => {
    for (const query of [{ tag, sha256: '0'.repeat(64) }, { tag: '../../secrets', sha256: digest }, { tag: [tag, tag], sha256: digest }, { tag }]) {
      const res = new ResponseSink();
      await download(request({ query }), res.response);
      expect(res.statusCode).toBe(query.sha256 === '0'.repeat(64) ? 409 : 400);
      expect(res.chunks).toHaveLength(0);
    }
  });

  it('fails closed when GitHub configuration or authentication service is unavailable', async () => {
    vi.stubEnv('GH_TOKEN', '');
    const missing = new ResponseSink();
    await download(request(), missing.response);
    expect(missing.statusCode).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockResolvedValueOnce(json({}, 503));
    const unavailable = new ResponseSink();
    await download(request(), unavailable.response);
    expect(unavailable.statusCode).toBe(502);
  });

  it('strips credentials from GitHub asset redirects and refuses untrusted destinations', async () => {
    for (const target of ['https://release-assets.githubusercontent.com/apk?signature=temporary', 'https://attacker.invalid/apk', 'http://release-assets.githubusercontent.com/apk', 'https://release-assets.githubusercontent.com:444/apk']) {
      fetchMock.mockClear();
      fetchMock.mockImplementation(async url => {
        if (String(url).includes('/auth/v1/user')) return json({ id: 'user' });
        if (String(url).endsWith('/assets/123')) return new Response(null, { status: 302, headers: { location: target } });
        if (String(url) === target) return new Response(bytes);
        return json(release());
      });
      const res = new ResponseSink();
      await download(request(), res.response);
      if (target.includes('?signature=')) {
        expect(Buffer.concat(res.chunks)).toEqual(bytes);
        expect(fetchMock.mock.lastCall?.[1]?.headers).not.toHaveProperty('Authorization');
      } else {
        expect(res.statusCode).toBe(502);
        expect(fetchMock.mock.calls.some(([url]) => String(url) === target)).toBe(false);
      }
    }
  });

  it('rejects an inconsistent length before responding and truncation or corruption during streaming', async () => {
    for (const body of [bytes.subarray(1), Buffer.from('x'.repeat(bytes.length)), Buffer.concat([bytes, bytes])]) {
      fetchMock.mockImplementation(async url => String(url).includes('/auth/v1/user') ? json({ id: 'user' }) :
        String(url).endsWith('/assets/123') ? new Response(body) : json(release()));
      const res = new ResponseSink();
      await download(request(), res.response);
      expect(res.destroyed).toBe(true);
    }
    fetchMock.mockImplementation(async url => String(url).includes('/auth/v1/user') ? json({ id: 'user' }) :
      String(url).endsWith('/assets/123') ? new Response(bytes, { headers: { 'Content-Length': '1' } }) : json(release()));
    const res = new ResponseSink();
    await download(request(), res.response);
    expect(res.statusCode).toBe(502);
    expect(res.chunks).toHaveLength(0);
  });

  it('accepts GET only on both endpoints', async () => {
    for (const handler of [download, update]) {
      const res = new ResponseSink();
      await handler(request({ method: 'POST' }), res.response);
      expect(res.statusCode).toBe(405); expect(res.headers.get('allow')).toBe('GET');
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('cancels the upstream stream when the client disconnects', async () => {
    const cancelled = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(bytes.subarray(0, 1)); },
      cancel: cancelled,
    });
    fetchMock.mockImplementation(async url => String(url).includes('/auth/v1/user') ? json({ id: 'user' }) :
      String(url).endsWith('/assets/123') ? new Response(body) : json(release()));
    const res = new ResponseSink();
    res._write = (_chunk, _encoding, callback) => { res.headersSent = true; res.destroy(); callback(); };
    await download(request(), res.response);
    expect(res.destroyed).toBe(true);
    expect(cancelled).toHaveBeenCalledOnce();
  });
});

describe('release metadata contract', () => {
  it('selects the newest numeric version including alpha and returns only a pinned Savely URL', async () => {
    fetchMock.mockResolvedValueOnce(json([release('v0.1.9-alpha'), release('v0.1.34-alpha', { draft: true }), release('v0.1.10-alpha')]));
    const res = new ResponseSink();
    await update(request({ headers: {}, query: { channel: 'preview' } }), res.response);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.github.com/repos/GoryNickel9/Savely-Android/releases?per_page=100');
    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({ schema: 1, tag_name: 'v0.1.10-alpha', assets: [{ browser_download_url: `${DOWNLOAD_URL}?tag=v0.1.10-alpha&sha256=${digest}` }] });
    const encoded = JSON.stringify(res.payload);
    expect(encoded).not.toContain('private-github-token'); expect(encoded).not.toContain('api.github.com');
    expect(encoded).not.toContain('user-session'); expect(encoded).not.toContain('"id":');
  });

  it('stable excludes previews and wins over a preview at the same numeric version', async () => {
    fetchMock.mockResolvedValueOnce(json(release('v1.0.0')));
    const stable = new ResponseSink(); await update(request({ query: {} }), stable.response);
    expect(stable.payload).toMatchObject({ tag_name: 'v1.0.0', prerelease: false });
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/latest$/);
    fetchMock.mockResolvedValueOnce(json([release('v1.0.0-alpha'), release('v1.0.0')]));
    const preview = new ResponseSink(); await update(request({ query: { channel: 'preview' } }), preview.response);
    expect(preview.payload).toMatchObject({ tag_name: 'v1.0.0' });
  });

  it('reports absence and upstream failures without a false up-to-date answer', async () => {
    for (const [response, status] of [[json([], 200), 404], [json({}, 403), 502], [json({}, 404), 404]] as const) {
      fetchMock.mockResolvedValueOnce(response);
      const res = new ResponseSink(); await update(request({ query: { channel: 'preview' } }), res.response);
      expect(res.statusCode).toBe(status);
    }
    const res = new ResponseSink(); await update(request({ query: { channel: 'invalid' } }), res.response);
    expect(res.statusCode).toBe(400);
  });

  it('rejects missing checksums, ambiguous APKs, oversized assets and foreign releases', async () => {
    const good = release('v1.0.0');
    const asset = good.assets[0];
    for (const invalid of [release('v1.0.0', { assets: [{ ...asset, digest: null }] }),
      release('v1.0.0', { assets: [asset, asset] }), release('v1.0.0', { assets: [{ ...asset, size: MAX_APK_BYTES + 1 }] }),
      release('v1.0.0', { assets: [{ ...asset, name: '../Savely.apk' }] }), release('v1.0.0', { html_url: 'https://attacker.invalid' }),
      release('v1.0.0', { draft: true }), release('v1.0.0', { prerelease: true }), release('v1.0.0', { assets: [] })]) {
      fetchMock.mockResolvedValueOnce(json(invalid));
      const res = new ResponseSink(); await update(request({ query: {} }), res.response);
      expect(res.statusCode).toBe(502);
    }
  });

  it('validates tags using the same numeric limits as Android', () => {
    for (const tag of ['', '1.2', '01.2.3', '2147483648.1.0', 'v1.2.3/../secret', '1.2.3-']) expect(validTag(tag)).toBe(false);
    expect(validTag('v1.2.3-alpha.1')).toBe(true);
  });
});
