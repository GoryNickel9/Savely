import { createHash, webcrypto } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { downloadAndroidApk } from './androidDownload';

const bytes = new TextEncoder().encode('APK fixture');
const sha256 = createHash('sha256').update(bytes).digest('hex');
const tag = 'v0.1.33-alpha';
const asset = { name: 'Savely.apk', size: bytes.length, digest: `sha256:${sha256}`,
  browser_download_url: `https://www.savely.cc/api/android-download?tag=${tag}&sha256=${sha256}` };
const metadata = (overrides = {}) => new Response(JSON.stringify({ schema: 1, tag_name: tag, draft: false, assets: [asset], ...overrides }));
const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto); vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset();
  fetchMock.mockResolvedValueOnce(metadata()).mockResolvedValueOnce(new Response(bytes));
});
afterEach(() => vi.unstubAllGlobals());

it('downloads the pinned APK with a bearer header and verifies its bytes before saving', async () => {
  const result = await downloadAndroidApk('savely-session', new AbortController().signal);
  expect(result.name).toBe('Savely.apk'); expect(new Uint8Array(await result.blob.arrayBuffer())).toEqual(bytes);
  expect(fetchMock.mock.calls[0][1]?.headers).toBeUndefined();
  expect(fetchMock.mock.calls[1][0]).toBe(`/api/android-download?tag=${tag}&sha256=${sha256}`);
  expect(fetchMock.mock.calls[1][1]).toMatchObject({ headers: { Authorization: 'Bearer savely-session' }, redirect: 'error', cache: 'no-store' });
});

it('rejects absent tokens without contacting the server', async () => {
  await expect(downloadAndroidApk('', new AbortController().signal)).rejects.toThrow('Accedi');
  expect(fetchMock).not.toHaveBeenCalled();
});

it('rejects forged metadata and URLs before sending the bearer token', async () => {
  for (const overrides of [{ schema: 2 }, { draft: true }, { tag_name: '../other' }, { assets: [asset, asset] },
    { assets: [{ ...asset, size: 100_000_001 }] }, { assets: [{ ...asset, digest: 'invalid' }] },
    { assets: [{ ...asset, browser_download_url: 'https://attacker.invalid/Savely.apk' }] }]) {
    fetchMock.mockReset().mockResolvedValueOnce(metadata(overrides));
    await expect(downloadAndroidApk('session', new AbortController().signal)).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  }
});

it('reports expired sessions and unavailable downloads', async () => {
  for (const status of [401, 409, 502]) {
    fetchMock.mockReset().mockResolvedValueOnce(metadata()).mockResolvedValueOnce(new Response('{}', { status }));
    await expect(downloadAndroidApk('session', new AbortController().signal)).rejects.toThrow(status === 401 ? 'Accedi' : 'non disponibile');
  }
});

it('refuses corrupted, incomplete and oversized downloads', async () => {
  for (const body of [new Uint8Array(bytes.length), bytes.subarray(1), new Uint8Array(bytes.length + 1)]) {
    fetchMock.mockReset().mockResolvedValueOnce(metadata()).mockResolvedValueOnce(new Response(body));
    await expect(downloadAndroidApk('session', new AbortController().signal)).rejects.toThrow();
  }
});

it('cancels when the settings component unmounts or the user signs out', async () => {
  const controller = new AbortController(); controller.abort();
  await expect(downloadAndroidApk('session', controller.signal)).rejects.toThrow();
});
