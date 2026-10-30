// @vitest-environment jsdom
import { useState, type ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import TcgCollectionPage from './TcgCollectionPage';
import type { CardTraderCard } from '@/hooks/useCardTraderSearch';

vi.mock('@/components/layout/MainLayout', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/hooks/useTcgCards', () => ({
  useTcgCards: () => ({ cards: [], isLoading: false, totalValue: 0, totalCost: 0, totalGain: 0, totalGainPercent: 0 }),
}));

vi.mock('@/hooks/useCardTraderPrices', () => ({ fetchCtZeroPrice: vi.fn() }));

vi.mock('@/hooks/useCardTraderSearch', () => ({
  useCardTraderSearch: function useCardTraderSearch() {
    const [results, setResults] = useState<CardTraderCard[]>([]);
    return {
      results, loading: false, error: null, reset: () => setResults([]),
      search: (name: string) => setResults(name === 'Castform' ? [
        { id: '1', name: 'Castform', set: { name: 'Chilling Reign' } },
        { id: '2', name: 'Castform', set: { name: 'Other Set' } },
      ] : [
        { id: '306305', name: 'Castform Sunny Form', set: { name: 'Surging Sparks' } },
      ]),
    };
  },
}));

// Native select keeps this regression focused on the page's filter state.
vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, children }: { value: string; onValueChange: (value: string) => void; children: ReactNode }) =>
    <select value={value} onChange={event => onValueChange(event.target.value)}>{children}</select>,
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => <option value={value}>{children}</option>,
}));

afterEach(cleanup);

it.each(['click', 'Enter'])('resets the previous set filter when searching via %s', (method) => {
  render(<MemoryRouter><TcgCollectionPage
    category="pokemon" title="Pokemon" subtitle="Collection" addCardTitle="Add Pokemon"
    addDialogMaxWidth="max-w-xl" searchPlaceholder="Search Pokemon"
  /></MemoryRouter>);

  fireEvent.click(screen.getByRole('button', { name: 'Aggiungi Carta' }));
  const input = screen.getByPlaceholderText('Search Pokemon');
  const searchButton = input.parentElement!.querySelector('button')!;
  const search = () => method === 'click'
    ? fireEvent.click(searchButton)
    : fireEvent.keyDown(input, { key: 'Enter' });

  fireEvent.change(input, { target: { value: 'Castform' } });
  search();
  fireEvent.change(screen.getByDisplayValue('Tutti i set (2)'), { target: { value: 'Chilling Reign' } });
  expect(screen.queryByRole('button', { name: 'Castform Other Set' })).toBeNull();

  fireEvent.change(input, { target: { value: 'Castform Sunny Form' } });
  search();
  expect(screen.getByRole('button', { name: 'Castform Sunny Form Surging Sparks' })).toBeTruthy();
});
