import type { VercelRequest, VercelResponse } from './vercel.js';
import { getQuery, noStore, pinnedRelease, replyError, requireUser, streamApk } from '../server/android-release.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  noStore(res);
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
  try {
    await requireUser(req);
    const release = await pinnedRelease(getQuery(req, 'tag'), getQuery(req, 'sha256'));
    await streamApk(release, res);
  } catch (error) { replyError(res, error); }
}
