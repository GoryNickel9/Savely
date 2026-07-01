import { describe, expect, it } from 'vitest';
import { calculateMean, calculateMedian, calculateWinsorizedMean } from './statistics';

describe('statistics calculations', () => {
  it('calculates mean and returns zero for empty inputs', () => {
    expect(calculateMean([10, 20, 30])).toBe(20);
    expect(calculateMean([])).toBe(0);
  });

  it('calculates median for odd, even and empty inputs', () => {
    expect(calculateMedian([30, 10, 20])).toBe(20);
    expect(calculateMedian([10, 40, 20, 30])).toBe(25);
    expect(calculateMedian([])).toBe(0);
  });

  it('winsorizes outliers before calculating the mean', () => {
    expect(calculateWinsorizedMean([1, 2, 3, 4, 100], 0.2)).toBe(3);
  });

  it('rejects invalid winsorization percentiles', () => {
    expect(() => calculateWinsorizedMean([1, 2, 3], 0.5)).toThrow(
      'Percentile deve essere tra 0 e 0.5 (escluso)'
    );
  });
});
