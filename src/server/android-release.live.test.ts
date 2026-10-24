import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { expect, it } from 'vitest';
import { latestRelease, noStore, streamApk } from '../../server/android-release';
import type { VercelResponse } from '../../api/vercel';

/** Read-only opt-in check: actual GitHub bytes through a local HTTP streaming response. */
it.skipIf(process.env.VERIFY_ANDROID_GITHUB !== '1')('streams the current real GitHub APK with its published checksum', async () => {
  const release = await latestRelease('preview');
  const server = createServer(async (_req, res) => {
    try { noStore(res as VercelResponse); await streamApk(release, res as VercelResponse); }
    catch { res.destroy(); }
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing test address');
    const response = await fetch(`http://127.0.0.1:${address.port}/apk`);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    const bytes = Buffer.from(await response.arrayBuffer());
    expect(bytes.length).toBe(release.asset.size);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(release.asset.sha256);
    console.info(JSON.stringify({ tag: release.tag, size: bytes.length, sha256: release.asset.sha256 }));
  } finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}, 180_000);
