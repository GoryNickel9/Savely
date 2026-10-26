// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import BudgetProgress from './BudgetProgress';
import { Progress } from './ui/progress';
import { formatPercent } from './dashboard/format';

afterEach(cleanup);

it.each([
  [0, 'success'], [74.99, 'success'], [75, 'warning'], [99.99, 'warning'],
  [100, 'destructive'], [250, 'destructive'], [291.5, 'destructive'],
] as const)('colora il budget al %s%% con %s e limita la larghezza', (value, color) => {
  render(<BudgetProgress value={value} />);
  const bar = screen.getByRole('progressbar');
  expect(bar.className).toContain(`[&>div]:bg-${color}`);
  expect(bar.getAttribute('aria-valuenow')).toBe(String(Math.min(value, 100)));
  expect((bar.firstElementChild as HTMLElement).style.transform).not.toContain('--');
});

it('riempie la barra quando passa da zero a 250%, conservando il dato reale nel testo', () => {
  const view = render(<BudgetProgress value={0} />);
  view.rerender(<BudgetProgress value={250} />);
  const bar = screen.getByRole('progressbar');
  expect((bar.firstElementChild as HTMLElement).style.transform).toBe('translateX(0%)');
  expect(bar.getAttribute('aria-valuenow')).toBe('100');
  expect(formatPercent(250, 2)).toBe('250%');
  expect(formatPercent(99.99, 2)).toBe('99,99%');
});

it.each([-10, Number.NaN, Number.POSITIVE_INFINITY])('gestisce il valore non valido %s', (value) => {
  render(<Progress value={value} />);
  expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
});

it('rispetta un massimo diverso da cento', () => {
  render(<Progress value={100} max={200} />);
  const bar = screen.getByRole('progressbar');
  expect(bar.getAttribute('aria-valuemax')).toBe('200');
  expect((bar.firstElementChild as HTMLElement).style.transform).toBe('translateX(-50%)');
});
