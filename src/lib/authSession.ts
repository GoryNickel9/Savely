/** Reads an identifier for display; this does not verify or authorize a JWT. */
export function getSessionId(session: { access_token: string } | null): string | null {
  if (!session?.access_token) return null;
  try {
    const payload = session.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { session_id } = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')));
    return typeof session_id === 'string' && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(session_id)
      ? session_id : null;
  } catch {
    return null;
  }
}
