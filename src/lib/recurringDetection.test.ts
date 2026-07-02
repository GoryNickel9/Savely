import { describe, it, expect } from 'vitest';
import {
  detectRecurringCandidates,
  normalizeDescription,
  matchFrequency,
  type DetectionTransaction,
} from './recurringDetection';

function tx(date: string, amount: number, description: string): DetectionTransaction {
  return { date, amount, description, type: 'expense' };
}

describe('normalizeDescription', () => {
  it('lowercase + trim + collapse spazi', () => {
    expect(normalizeDescription('  NETFLIX   COM  ')).toBe('netflix com');
  });

  it('rimuove numeri di riferimento lunghi', () => {
    expect(normalizeDescription('Spesa Amazon 1234567890')).toBe('spesa amazon');
  });

  it('rimuove prefissi di pagamento comuni', () => {
    expect(normalizeDescription('Pagamento Netflix')).toBe('netflix');
    expect(normalizeDescription('ADDEBITO Spotify')).toBe('spotify');
  });

  it('ritorna stringa vuota per null', () => {
    expect(normalizeDescription(null)).toBe('');
  });
});

describe('matchFrequency', () => {
  it('match weekly per gap medio ~7', () => {
    expect(matchFrequency([7, 7, 7])?.frequency).toBe('weekly');
  });

  it('match monthly per gap medio ~30', () => {
    expect(matchFrequency([30, 31, 29])?.frequency).toBe('monthly');
  });

  it('ritorna null per cadenza irregolare', () => {
    // media = (3+50+150)/3 ≈ 67.7 → fuori da tutte le tolleranze
    expect(matchFrequency([3, 50, 150])).toBeNull();
  });

  it('ritorna null per array vuoto', () => {
    expect(matchFrequency([])).toBeNull();
  });
});

describe('detectRecurringCandidates', () => {
  it('rileva un abbonamento mensile con 3+ occorrenze', () => {
    const candidates = detectRecurringCandidates([
      tx('2026-01-15', 12.99, 'Netflix'),
      tx('2026-02-15', 12.99, 'Netflix'),
      tx('2026-03-15', 12.99, 'Netflix'),
      tx('2026-04-15', 12.99, 'Netflix'),
    ]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].frequency).toBe('monthly');
    expect(candidates[0].medianAmount).toBe(12.99);
    expect(candidates[0].occurrenceCount).toBe(4);
    expect(candidates[0].confidence).toBe('high');
  });

  it('ignora gruppi con meno di 3 occorrenze', () => {
    const candidates = detectRecurringCandidates([
      tx('2026-01-15', 100, 'Affitto'),
      tx('2026-02-15', 100, 'Affitto'),
    ]);
    expect(candidates).toHaveLength(0);
  });

  it('scarta gruppi con importi troppo variabili', () => {
    const candidates = detectRecurringCandidates([
      tx('2026-01-15', 10, 'Bar'),
      tx('2026-01-22', 50, 'Bar'),
      tx('2026-01-29', 5, 'Bar'),
    ]);
    expect(candidates).toHaveLength(0);
  });

  it('scarta gruppi senza cadenza regolare (spit notturno rumoroso)', () => {
    const candidates = detectRecurringCandidates([
      tx('2026-01-03', 5, 'Bar Centrale'),
      tx('2026-01-10', 5, 'Bar Centrale'),
      tx('2026-02-20', 5, 'Bar Centrale'),
      tx('2026-03-01', 5, 'Bar Centrale'),
    ]);
    expect(candidates).toHaveLength(0);
  });

  it('normalizza descrizioni con rumore prima di raggruppare', () => {
    const candidates = detectRecurringCandidates([
      tx('2026-01-15', 7.99, 'Pagamento Disney Plus'),
      tx('2026-02-15', 7.99, 'Disney Plus 999888'),
      tx('2026-03-15', 7.99, 'Disney Plus'),
    ]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].occurrenceCount).toBe(3);
  });

  it('rileva più candidati e li ordina per confidence/occorrenze', () => {
    const candidates = detectRecurringCandidates([
      // Netflix: 5 occorrenze → high confidence
      tx('2026-01-15', 12.99, 'Netflix'),
      tx('2026-02-15', 12.99, 'Netflix'),
      tx('2026-03-15', 12.99, 'Netflix'),
      tx('2026-04-15', 12.99, 'Netflix'),
      tx('2026-05-15', 12.99, 'Netflix'),
      // Gym: 3 occorrenze → medium confidence
      tx('2026-01-05', 30, 'Gym'),
      tx('2026-02-05', 30, 'Gym'),
      tx('2026-03-05', 30, 'Gym'),
    ]);
    expect(candidates).toHaveLength(2);
    expect(candidates[0].confidence).toBe('high');
    expect(candidates[0].description).toBe('Netflix');
  });

  it('esclude entrate (solo spese)', () => {
    const candidates = detectRecurringCandidates([
      { date: '2026-01-15', amount: 2000, description: 'Stipendio', type: 'income' },
      { date: '2026-02-15', amount: 2000, description: 'Stipendio', type: 'income' },
      { date: '2026-03-15', amount: 2000, description: 'Stipendio', type: 'income' },
    ]);
    expect(candidates).toHaveLength(0);
  });

  it('calcola suggestedNextDueDate dalla ultima occorrenza', () => {
    const candidates = detectRecurringCandidates([
      tx('2026-01-15', 12.99, 'Netflix'),
      tx('2026-02-15', 12.99, 'Netflix'),
      tx('2026-03-15', 12.99, 'Netflix'),
    ]);
    expect(candidates[0].lastDate).toBe('2026-03-15');
    // next = 2026-03-15 + 30 days ≈ 2026-04-14
    expect(candidates[0].suggestedNextDueDate).toMatch(/^2026-04-1[34]$/);
  });
});
