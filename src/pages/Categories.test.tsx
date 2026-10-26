// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Categories from './Categories';
import CategoriesSection from '@/components/settings/CategoriesSection';
import type { SpendingPattern } from '@/lib/types';
import i18n from '@/i18n';

const mocks = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }));
vi.mock('@/components/layout/MainLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/hooks/useCategories', () => ({ useCategories: () => ({ categories: [],
  createCategory: { mutateAsync: mocks.create, isPending: false },
  updateCategory: { mutateAsync: mocks.update, isPending: false }, deleteCategory: {},
}) }));
// Test form-to-mutation wiring independently of Radix pointer handling in jsdom.
vi.mock('@/components/SpendingPatternSelect', () => ({ default: ({ value, onChange }: {
  value: SpendingPattern; onChange: (value: SpendingPattern) => void;
}) => <select aria-label="Andamento delle spese" value={value} onChange={event => onChange(event.target.value as SpendingPattern)}>
  <option value="regular">Regolari</option><option value="occasional">Saltuarie</option>
</select> }));
beforeEach(() => { vi.clearAllMocks(); void i18n.changeLanguage('it'); mocks.create.mockResolvedValue({}); });
afterEach(cleanup);

it.each([['Categorie', Categories], ['Impostazioni', CategoriesSection]] as const)('%s salva la scelta saltuaria e riparte da regolare per una nuova categoria', async (_, Component) => {
  render(<Component />);
  fireEvent.click(screen.getByRole('button', { name: 'Nuova Categoria' }));
  expect((screen.getByLabelText('Andamento delle spese') as HTMLSelectElement).value).toBe('regular');
  fireEvent.change(screen.getByPlaceholderText('Nome categoria'), { target: { value: 'Dentista' } });
  fireEvent.change(screen.getByLabelText('Andamento delle spese'), { target: { value: 'occasional' } });
  fireEvent.click(screen.getByRole('button', { name: 'Crea Categoria' }));
  await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Dentista', type: 'expense', spending_pattern: 'occasional' })));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  fireEvent.click(screen.getByRole('button', { name: 'Nuova Categoria' }));
  expect((screen.getByLabelText('Andamento delle spese') as HTMLSelectElement).value).toBe('regular');
});
