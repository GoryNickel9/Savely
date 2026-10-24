import type { IncomingHttpHeaders, ServerResponse } from 'node:http';

/**
 * Tipi minimi per le Vercel Functions, in sostituzione di @vercel/node
 * (che trascinava dipendenze transitive con advisories — v. report TD-013).
 * Aggiunge query/body alla richiesta Node e status/json alla risposta Node;
 * lo stream APK usa la risposta HTTP nativa e la sua backpressure.
 */
export interface VercelRequest {
  method?: string;
  headers: IncomingHttpHeaders;
  query?: Record<string, string | string[] | undefined>;
  /** Body JSON già parsato dal runtime Vercel. */
  body?: Record<string, unknown>;
}

export interface VercelResponse extends ServerResponse {
  status(code: number): VercelResponse;
  json(payload: unknown): VercelResponse;
}
