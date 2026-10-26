import type { VercelRequest, VercelResponse } from './vercel.js';
import { noStore } from '../server/android-release.js';
import { ForecastError, getForecast } from '../server/forecast-api.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  noStore(res);
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
  try { return res.status(200).json(await getForecast(req)); }
  catch (error) {
    return res.status(error instanceof ForecastError ? error.status : 422).json({ error: error instanceof ForecastError ? error.message : 'Forecast unavailable. Check your financial data and retry.' });
  }
}
