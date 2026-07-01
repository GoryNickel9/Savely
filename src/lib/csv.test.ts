import { describe, expect, it } from 'vitest';
import { parseCsvObjects, parseCsvRows, serializeCsvRows } from './csv';

describe('csv utilities', () => {
  it('parses semicolon-delimited rows with quoted delimiters', () => {
    expect(parseCsvRows('data;descrizione;importo\n2026-01-01;"bar; mercato";12,50')).toEqual([
      ['data', 'descrizione', 'importo'],
      ['2026-01-01', 'bar; mercato', '12,50'],
    ]);
  });

  it('parses objects using the header row', () => {
    expect(parseCsvObjects('Type,State,Amount\nCard Payment,COMPLETED,-12.50')).toEqual([
      {
        Type: 'Card Payment',
        State: 'COMPLETED',
        Amount: '-12.50',
      },
    ]);
  });

  it('serializes object rows and escapes special values', () => {
    expect(serializeCsvRows([{ name: 'A,B', note: 'hello "world"' }])).toBe(
      'name,note\n"A,B","hello ""world"""'
    );
  });
});
