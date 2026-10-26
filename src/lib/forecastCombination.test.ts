import { expect, it } from 'vitest';
import { equalWeightForecastTotal } from '../../server/forecast-combination';

it('uses fixed equal weights on the two published-scale component totals', () => {
  expect(equalWeightForecastTotal(800, 1000)).toBe(900);
  expect(equalWeightForecastTotal(123.45, 123.45)).toBe(123.45);
  expect(equalWeightForecastTotal(0, 0)).toBe(0);
});
it('rounds an odd cent sum upwards without floating point tie errors', () => {
  expect(equalWeightForecastTotal(0.28, 0.29)).toBe(0.29);
  expect(equalWeightForecastTotal(1, 1.01)).toBe(1.01);
  expect(equalWeightForecastTotal(0, 0.01)).toBe(0.01);
});
it('does not count shared spending or commitments twice', () => {
  const spent = 200, scheduled = 100;
  expect(equalWeightForecastTotal(spent + scheduled + 40, spent + scheduled + 80)).toBe(spent + scheduled + 60);
});
it('is symmetric and stays inside the component range', () => {
  for (const [a, b] of [[10.01, 20.03], [45, 12.99], [0, 1000], [42, 42]]) {
    const value = equalWeightForecastTotal(a, b);
    expect(equalWeightForecastTotal(b, a)).toBe(value);
    expect(value).toBeGreaterThanOrEqual(Math.min(a, b));
    expect(value).toBeLessThanOrEqual(Math.max(a, b));
  }
});
it('rejects unavailable, non-finite, negative and fractional-cent inputs', () => {
  for (const invalid of [NaN, Infinity, -Infinity, -1, 0.001, 1e20]) expect(() => equalWeightForecastTotal(invalid, 1)).toThrow('Invalid forecast amount');
});
it('rejects an unsafe cent sum instead of silently losing precision', () => {
  expect(() => equalWeightForecastTotal(5e13, 5e13)).toThrow('Forecast combination overflow');
});
