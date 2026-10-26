// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Permissions } from '@/lib/types';
import Sidebar from './Sidebar';

const mocks = vi.hoisted(() => ({ permissions: null as Permissions | null }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ signOut: vi.fn(), user: { email: 'test@example.com' } }),
}));
vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => ({ permissions: mocks.permissions }),
}));

beforeEach(() => {
  mocks.permissions = {
    admin: false, couple_expenses: true, poker: true, fumo: true,
    fire: true, tcg: true, libreria: true,
  };
});
afterEach(cleanup);

function renderSidebar(path = '/', collapsed = false) {
  const onMobileOpenChange = vi.fn();
  render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar mobileOpen onMobileOpenChange={onMobileOpenChange} collapsed={collapsed} />
    </MemoryRouter>,
  );
  return { onMobileOpenChange };
}

it('raggruppa e ordina le voci richieste nel menu desktop e mobile', () => {
  renderSidebar();
  for (const nav of screen.getAllByRole('navigation')) {
    expect(within(nav).getAllByRole('heading').map((heading) => heading.textContent))
      .toEqual(['Dashboard', 'Budgeting', 'Finance', 'Altro']);
    const expected = [
      ['Dashboard', 'Transazioni'],
      ['Budget', 'Budget Familiare'],
      ['Portfolio', 'Insights', 'Grafici'],
      ['Poker', 'Fumo', 'FIRE', 'TCG', 'Libreria'],
    ];
    expect(within(nav).getAllByRole('region').map((group) =>
      within(group).getAllByRole('link').map((link) => link.textContent),
    )).toEqual(expected);
    expect(within(nav).queryByRole('link', { name: 'Uscite Ricorrenti' })).toBeNull();
  }
});

it('nasconde le voci riservate e il gruppo Altro quando i permessi sono assenti', () => {
  mocks.permissions = null;
  renderSidebar();
  for (const nav of screen.getAllByRole('navigation')) {
    expect(within(nav).queryByRole('region', { name: 'Altro' })).toBeNull();
    expect(within(nav).queryByRole('link', { name: 'Budget Familiare' })).toBeNull();
    expect(within(nav).getAllByRole('link').map((link) => link.getAttribute('href')))
      .toEqual(['/', '/transactions', '/budget', '/portfolio', '/insights', '/charts']);
  }
});

it('mostra soltanto i moduli abilitati senza cambiare il loro ordine', () => {
  mocks.permissions = { ...mocks.permissions!, couple_expenses: false, poker: false, fire: false, libreria: false };
  renderSidebar();
  for (const nav of screen.getAllByRole('navigation')) {
    const other = within(nav).getByRole('region', { name: 'Altro' });
    expect(within(other).getAllByRole('link').map((link) => link.textContent)).toEqual(['Fumo', 'TCG']);
  }
});

it('mantiene i nomi accessibili in modalità compatta e attiva il modulo della sottopagina', () => {
  const { onMobileOpenChange } = renderSidebar('/tcg/collection', true);
  for (const nav of screen.getAllByRole('navigation')) {
    expect(within(nav).getByRole('link', { name: 'TCG' }).getAttribute('aria-current')).toBe('page');
    expect(within(nav).getByRole('link', { name: 'Dashboard' }).hasAttribute('aria-current')).toBe(false);
  }
  fireEvent.click(within(screen.getAllByRole('navigation')[0]).getByRole('link', { name: 'Budget' }));
  expect(onMobileOpenChange).toHaveBeenCalledWith(false);
});
