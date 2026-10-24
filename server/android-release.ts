import { createHash } from 'node:crypto';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import type { VercelRequest, VercelResponse } from '../api/vercel.js';

const REPOSITORY = 'GoryNickel9/Savely-Android';
const API = `https://api.github.com/repos/${REPOSITORY}/releases`;
const RELEASES = `https://github.com/${REPOSITORY}/releases`;
export const DOWNLOAD_URL = 'https://www.savely.cc/api/android-download';
export const MAX_APK_BYTES = 100_000_000;
const MAX_METADATA_BYTES = 2_000_000;

export class ReleaseError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

export function noStore(res: VercelResponse) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vary', 'Authorization');
}

export function getQuery(req: VercelRequest, key: string): string | undefined {
  const value = req.query?.[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new ReleaseError(400, 'Invalid query parameter');
  return value;
}

export function validTag(tag: unknown): tag is string {
  if (typeof tag !== 'string' || tag.length > 80) return false;
  const match = /^v?(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-([A-Za-z0-9]+(?:[.-][A-Za-z0-9]+)*))?$/.exec(tag);
  return !!match && match.slice(1, 4).every(n => Number(n) <= 2_147_483_647);
}

async function readJson(response: Response): Promise<unknown> {
  if (!response.body) throw new ReleaseError(502, 'Empty upstream response');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_METADATA_BYTES) throw new ReleaseError(502, 'Upstream metadata too large');
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally { await reader.cancel(); }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ReleaseError(502, 'Invalid release metadata');
  return value as Record<string, unknown>;
}

function githubToken(): string {
  const token = process.env.GH_TOKEN;
  if (!token) throw new ReleaseError(503, 'Android distribution is not configured');
  return token;
}

export async function requireUser(req: VercelRequest): Promise<void> {
  const authorization = req.headers.authorization;
  if (typeof authorization !== 'string' || !/^Bearer [^\s]+$/.test(authorization) || authorization.length > 16384) {
    throw new ReleaseError(401, 'Sign in to download Savely');
  }
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new ReleaseError(503, 'Authentication is not configured');
  const base = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? 'https://crqnfbahytzenisospcx.supabase.co';
  const response = await fetch(`${base}/auth/v1/user`, {
    headers: { apikey: key, Authorization: authorization }, redirect: 'error', signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 401 || response.status === 403) throw new ReleaseError(401, 'Session expired. Sign in again');
  if (!response.ok) throw new ReleaseError(502, 'Authentication service unavailable');
  const user = object(await readJson(response));
  // Supabase anonymous accounts are authenticated JWTs, but are not logged-in Savely users.
  if (typeof user.id !== 'string' || !user.id || user.is_anonymous === true) throw new ReleaseError(401, 'Sign in to download Savely');
}

async function githubJson(endpoint: string): Promise<unknown> {
  const response = await fetch(`${API}${endpoint.startsWith('?') ? '' : '/'}${endpoint}`, {
    headers: { Authorization: `Bearer ${githubToken()}`, Accept: 'application/vnd.github+json', 'User-Agent': 'Savely-Android-distribution' },
    redirect: 'error', signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 404) throw new ReleaseError(404, 'No Android release available');
  if (!response.ok) throw new ReleaseError(502, 'GitHub release service unavailable');
  return readJson(response);
}

function compareTags(a: string, b: string): number {
  const parts = (tag: string) => tag.replace(/^v/, '').split('-')[0].split('.').map(Number);
  const x = parts(a), y = parts(b);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return Number(!a.includes('-')) - Number(!b.includes('-'));
}

export interface AndroidRelease {
  tag: string;
  preview: boolean;
  asset: { id: number; name: string; size: number; sha256: string };
}

function parseRelease(value: unknown, allowPreviews: boolean): AndroidRelease {
  const release = object(value);
  const tag = release.tag_name;
  if (!validTag(tag) || release.draft !== false || typeof release.prerelease !== 'boolean' ||
    release.prerelease !== tag.includes('-') || (!allowPreviews && release.prerelease) ||
    release.html_url !== `${RELEASES}/tag/${tag}` || !Array.isArray(release.assets) || release.assets.length > 100) {
    throw new ReleaseError(502, 'Invalid Android release');
  }
  const assets = release.assets.map(object).filter(a => typeof a.name === 'string' && a.name.endsWith('.apk') && a.state === 'uploaded');
  if (assets.length !== 1) throw new ReleaseError(502, 'Release must contain exactly one APK');
  const asset = assets[0];
  if (typeof asset.name !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}\.apk$/.test(asset.name) ||
    !Number.isSafeInteger(asset.id) || Number(asset.id) <= 0 || !Number.isSafeInteger(asset.size) ||
    Number(asset.size) < 1 || Number(asset.size) > MAX_APK_BYTES || typeof asset.digest !== 'string' ||
    !/^sha256:[a-fA-F0-9]{64}$/.test(asset.digest)) throw new ReleaseError(502, 'Invalid APK metadata or missing SHA-256');
  return { tag, preview: release.prerelease, asset: { id: Number(asset.id), name: asset.name, size: Number(asset.size), sha256: asset.digest.slice(7).toLowerCase() } };
}

export async function latestRelease(channel: string): Promise<AndroidRelease> {
  if (!['stable', 'preview'].includes(channel)) throw new ReleaseError(400, 'Invalid release channel');
  if (channel === 'stable') return parseRelease(await githubJson('latest'), false);
  // shortcut: inspect the last 100 published releases; paginate if the release history requires it.
  const list = await githubJson('?per_page=100');
  if (!Array.isArray(list) || list.length > 100) throw new ReleaseError(502, 'Invalid release list');
  const candidates = list.map(object).filter(r => r.draft === false && validTag(r.tag_name));
  candidates.sort((a, b) => compareTags(String(b.tag_name), String(a.tag_name)));
  if (!candidates.length) throw new ReleaseError(404, 'No Android release available');
  return parseRelease(candidates[0], true);
}

export function publicMetadata(release: AndroidRelease) {
  const { tag, preview, asset } = release;
  return {
    schema: 1, tag_name: tag, draft: false, prerelease: preview, html_url: `${RELEASES}/tag/${tag}`,
    assets: [{ name: asset.name, state: 'uploaded', size: asset.size, digest: `sha256:${asset.sha256}`,
      browser_download_url: `${DOWNLOAD_URL}?tag=${tag}&sha256=${asset.sha256}` }],
  };
}

export async function pinnedRelease(tag: string | undefined, sha256: string | undefined): Promise<AndroidRelease> {
  if (!validTag(tag) || !sha256 || !/^[a-f0-9]{64}$/.test(sha256)) throw new ReleaseError(400, 'A valid release tag and SHA-256 are required');
  const release = parseRelease(await githubJson(`tags/${encodeURIComponent(tag)}`), true);
  if (release.tag !== tag || release.asset.sha256 !== sha256) throw new ReleaseError(409, 'Release changed. Check for updates again');
  return release;
}

export async function streamApk(release: AndroidRelease, res: VercelResponse): Promise<void> {
  const token = githubToken();
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 180_000);
  const closed = () => { if (!res.writableFinished) controller.abort(); };
  res.on('close', closed);
  try {
    let url = `https://api.github.com/repos/${REPOSITORY}/releases/assets/${release.asset.id}`;
    let response: Response | undefined;
    for (let redirects = 0; redirects <= 5; redirects++) {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || (parsed.port && parsed.port !== '443') || parsed.username || parsed.password || parsed.hash ||
        !['api.github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com', 'github-releases.githubusercontent.com'].includes(parsed.hostname)) {
        throw new ReleaseError(502, 'Untrusted APK redirect');
      }
      response = await fetch(url, {
        headers: { Accept: 'application/octet-stream', 'User-Agent': 'Savely-Android-distribution',
          ...(parsed.hostname === 'api.github.com' ? { Authorization: `Bearer ${token}` } : {}) },
        redirect: 'manual', signal: controller.signal,
      });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location || redirects === 5) throw new ReleaseError(502, 'Invalid APK redirect');
      url = new URL(location, url).href;
    }
    if (!response?.ok || !response.body) throw new ReleaseError(502, 'APK download unavailable');
    const length = response.headers.get('content-length');
    if (length !== null && Number(length) !== release.asset.size) {
      await response.body.cancel();
      throw new ReleaseError(502, 'APK size does not match release');
    }
    const hash = createHash('sha256');
    let bytes = 0;
    const verifier = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        bytes += chunk.length;
        if (bytes > release.asset.size) return callback(new Error('APK exceeds declared size'));
        hash.update(chunk); callback(null, chunk);
      },
      flush(callback) {
        callback(bytes === release.asset.size && hash.digest('hex') === release.asset.sha256 ? null : new Error('APK integrity check failed'));
      },
    });
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', `attachment; filename="${release.asset.name}"`);
    res.setHeader('Content-Length', String(release.asset.size));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    await pipeline(Readable.fromWeb(response.body as NodeReadableStream<Uint8Array>), verifier, res);
  } finally {
    clearTimeout(deadline); controller.abort(); res.off('close', closed);
  }
}

export function replyError(res: VercelResponse, error: unknown) {
  if (res.headersSent || res.destroyed) { if (!res.destroyed) res.destroy(); return; }
  const status = error instanceof ReleaseError ? error.status : 502;
  res.status(status).json({ error: error instanceof ReleaseError ? error.message : 'Android distribution unavailable. Try again later' });
}
