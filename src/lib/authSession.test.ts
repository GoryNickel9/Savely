import { expect, it } from 'vitest';
import { getSessionId } from './authSession';

const id = '11111111-1111-4111-8111-111111111111';
const session = (payload: unknown) => ({ access_token: `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature` });

it('reads the documented session_id claim from a base64url JWT', () => {
  expect(getSessionId(session({ session_id: id, name: 'Mario è qui' }))).toBe(id);
});
it('does not substitute sid or another unvalidated identifier', () => {
  for (const payload of [{ sid: id }, { session_id: 123 }, { session_id: 'arbitrary' }, null, {}]) {
    expect(getSessionId(session(payload))).toBeNull();
  }
});
it('handles absent, malformed and incomplete tokens', () => {
  expect(getSessionId(null)).toBeNull();
  for (const access_token of ['', 'broken', 'a.!.b', 'a.bnVsbA.b']) expect(getSessionId({ access_token })).toBeNull();
});
