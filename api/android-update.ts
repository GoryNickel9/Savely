import type { VercelRequest, VercelResponse } from './vercel.js';
import { getQuery, latestRelease, noStore, publicMetadata, replyError } from '../server/android-release.js';

/** Public version metadata, like PokerQuant; the APK endpoint requires a Savely session. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  noStore(res);
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
  try { return res.status(200).json(publicMetadata(await latestRelease(getQuery(req, 'channel') ?? 'stable'))); }
  catch (error) { replyError(res, error); }
}
