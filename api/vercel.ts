import type { IncomingHttpHeaders } from 'node:http';

/**
 * Tipi minimi per le Vercel Functions, in sostituzione di @vercel/node
 * (che trascinava dipendenze transitive con advisories — v. report TD-013).
 * Copre solo ciò che api/*.ts usa effettivamente: method, headers, body JSON
 * e la catena res.status().json().
 */
export interface VercelRequest {
  method?: string;
  headers: IncomingHttpHeaders;
  /** Body JSON già parsato dal runtime Vercel. */
  body?: Record<string, unknown>;
}

export interface VercelResponse {
  status(code: number): VercelResponse;
  json(payload: unknown): VercelResponse;
}
