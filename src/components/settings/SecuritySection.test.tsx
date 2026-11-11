// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SecuritySection from './SecuritySection';

const current = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const mocks = vi.hoisted(() => ({ remove: vi.fn(), signOut: vi.fn(), refetch: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ session: { access_token: `a.${btoa(JSON.stringify({ session_id: current }))}.b` } }) }));
vi.mock('@/hooks/useMfa', () => ({
  useFactors: () => ({ data: { factors: [], aalCurrent: 'aal1' }, isLoading: false }),
  useEnrollTotp: () => ({}), useVerifyEnrollment: () => ({}), useUnenrollFactor: () => ({}), challengeAndVerify: vi.fn(),
}));
vi.mock('@/hooks/useActiveSessions', () => ({
  useActiveSessions: () => ({ data: [current, other].map(id => ({ id, session_id: id,
    user_agent: navigator.userAgent, created_at: '2026-10-20T12:00:00Z' })), isLoading: false, refetch: mocks.refetch }),
  useDeleteSession: () => ({ mutateAsync: mocks.remove }),
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { signOut: mocks.signOut } } }));
beforeEach(() => { vi.clearAllMocks(); mocks.remove.mockResolvedValue(undefined); mocks.signOut.mockResolvedValue({ error: null }); });
afterEach(cleanup);

it('keeps two sessions with the same browser and marks only the exact current session', () => {
  render(<SecuritySection />);
  expect(screen.getAllByRole('listitem')).toHaveLength(2);
  expect(screen.getAllByText('Attuale')).toHaveLength(1);
  expect(screen.getAllByText(/Questo dispositivo/)).toHaveLength(1);
  expect(screen.getAllByRole('button', { name: 'Disconnetti questo dispositivo' })).toHaveLength(1);
});
it('disconnects the selected session by identifier', async () => {
  render(<SecuritySection />);
  fireEvent.click(screen.getByRole('button', { name: 'Disconnetti questo dispositivo' }));
  await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith(other));
});
it('signs out the other sessions and refreshes the actual session list', async () => {
  render(<SecuritySection />);
  fireEvent.click(screen.getByRole('button', { name: 'Disconnetti altre sessioni' }));
  await waitFor(() => expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'others' }));
  await waitFor(() => expect(mocks.refetch).toHaveBeenCalledOnce());
});
