// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AndroidDownloadSection from './AndroidDownloadSection';

const mocks = vi.hoisted(() => ({ user: { id: 'user' } as { id: string } | null, getSession: vi.fn(), download: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getSession: mocks.getSession } } }));
vi.mock('@/lib/androidDownload', () => ({ downloadAndroidApk: mocks.download }));
beforeEach(() => {
  mocks.user = { id: 'user' }; mocks.getSession.mockReset(); mocks.download.mockReset();
  mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'user' }, access_token: 'session' } } });
});
afterEach(cleanup);

it('does not offer APK downloads to a signed-out visitor', () => {
  mocks.user = null; render(<AndroidDownloadSection />);
  expect(screen.queryByRole('button')).toBeNull();
});

it('prevents downloads when the saved session has expired or belongs to another user', async () => {
  for (const session of [null, { user: { id: 'other' }, access_token: 'other-session' }]) {
    mocks.getSession.mockResolvedValue({ data: { session } });
    const view = render(<AndroidDownloadSection />);
    fireEvent.click(screen.getByRole('button', { name: 'Scarica APK Android' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Accedi di nuovo'));
    expect(mocks.download).not.toHaveBeenCalled(); view.unmount();
  }
});

it('disables duplicate requests, reports errors and enables retry', async () => {
  let reject!: (error: Error) => void;
  mocks.download.mockImplementation(() => new Promise((_resolve, failure) => { reject = failure; }));
  render(<AndroidDownloadSection />);
  const button = screen.getByRole('button'); fireEvent.click(button);
  await waitFor(() => expect(mocks.download).toHaveBeenCalledTimes(1));
  expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button);
  expect(mocks.download).toHaveBeenCalledTimes(1);
  reject(new Error('Download Android incompleto. Riprova.'));
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('incompleto'));
  expect((button as HTMLButtonElement).disabled).toBe(false);
});

it('aborts an active download when leaving settings', async () => {
  mocks.download.mockImplementation(() => new Promise(() => {}));
  const view = render(<AndroidDownloadSection />); fireEvent.click(screen.getByRole('button'));
  await waitFor(() => expect(mocks.download).toHaveBeenCalledTimes(1));
  const signal = mocks.download.mock.calls[0][1] as AbortSignal;
  view.unmount(); expect(signal.aborted).toBe(true);
});
