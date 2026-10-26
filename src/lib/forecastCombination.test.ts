import { expect, it } from 'vitest';
import { equalWeightForecastTotal, quarterWeightForecastTotal, fifthWeightForecastTotal, twentiethWeightForecastTotal } from '../../server/forecast-combination';

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
it('distinguishes 75% current from 75% weekly without tuning weights', () => {
  expect(quarterWeightForecastTotal(800, 1000, 3)).toBe(850);
  expect(quarterWeightForecastTotal(800, 1000, 1)).toBe(950);
  expect(quarterWeightForecastTotal(800, 1000, 2)).toBe(900);
});
it('rounds quarter-cent values once and keeps the shared commitments unchanged', () => {
  expect(quarterWeightForecastTotal(0.28, 0.30, 3)).toBe(0.29);
  expect(quarterWeightForecastTotal(0.28, 0.30, 1)).toBe(0.30);
  expect(quarterWeightForecastTotal(0, 0.01, 3)).toBe(0);
  expect(quarterWeightForecastTotal(0, 0.01, 1)).toBe(0.01);
  expect(quarterWeightForecastTotal(340, 380, 3)).toBe(350);
  expect(quarterWeightForecastTotal(340, 380, 1)).toBe(370);
});
it('preserves the previous equal-weight result including its valid precision boundary', () => {
  for (const [first, second] of [[0, 0], [10.01, 20.03], [45, 12.99], [3e13, 3e13]]) {
    expect(quarterWeightForecastTotal(first, second, 2)).toBe(equalWeightForecastTotal(first, second));
  }
  expect(equalWeightForecastTotal(3e13, 3e13)).toBe(3e13);
});
it('rejects unsupported weights and unsafe weighted cent sums', () => {
  expect(() => quarterWeightForecastTotal(1, 2, 0 as 1)).toThrow('Invalid forecast weights');
  expect(() => quarterWeightForecastTotal(1, 2, 1.5 as 1)).toThrow('Invalid forecast weights');
  expect(() => quarterWeightForecastTotal(3e13, 3e13, 3)).toThrow('Forecast combination overflow');
});
it('distinguishes 60% current from 60% weekly with fixed fifth weights', () => {
  expect(fifthWeightForecastTotal(800, 1000, 3)).toBe(880);
  expect(fifthWeightForecastTotal(800, 1000, 2)).toBe(920);
});
it('rounds fifth-cent values once without duplicating shared commitments', () => {
  expect(fifthWeightForecastTotal(0.28, 0.29, 3)).toBe(0.28);
  expect(fifthWeightForecastTotal(0.28, 0.29, 2)).toBe(0.29);
  expect(fifthWeightForecastTotal(0, 0.01, 3)).toBe(0);
  expect(fifthWeightForecastTotal(0, 0.01, 2)).toBe(0.01);
  expect(fifthWeightForecastTotal(340, 380, 3)).toBe(356);
  expect(fifthWeightForecastTotal(340, 380, 2)).toBe(364);
  // Exact numerator 8,000,000,000,000,002 cents: remainder 2/5 must round down.
  expect(fifthWeightForecastTotal(16e12, 16e12 + 0.01, 3)).toBe(16e12);
});
it('preserves identical inputs and symmetry under exchanging fifth-weight components', () => {
  expect(fifthWeightForecastTotal(123.45, 123.45, 3)).toBe(123.45);
  expect(fifthWeightForecastTotal(123.45, 123.45, 2)).toBe(123.45);
  for (const [a, b] of [[10.01, 20.03], [45, 12.99], [0, 1000], [42, 42]]) {
    const value = fifthWeightForecastTotal(a, b, 3);
    expect(value).toBe(fifthWeightForecastTotal(b, a, 2));
    expect(value).toBeGreaterThanOrEqual(Math.min(a, b));
    expect(value).toBeLessThanOrEqual(Math.max(a, b));
  }
});
it('rejects unsupported fifth weights, invalid amounts and unsafe weighted sums', () => {
  expect(() => fifthWeightForecastTotal(1, 2, 1 as 2)).toThrow('Invalid forecast weights');
  expect(() => fifthWeightForecastTotal(1, 2, 2.5 as 2)).toThrow('Invalid forecast weights');
  expect(() => fifthWeightForecastTotal(NaN, 2, 3)).toThrow('Invalid forecast amount');
  expect(() => fifthWeightForecastTotal(3e13, 3e13, 3)).toThrow('Forecast combination overflow');
});
it('distinguishes 55% current from 55% weekly with the requested fixed weights', () => {
  expect(twentiethWeightForecastTotal(800, 1000, 11)).toBe(890);
  expect(twentiethWeightForecastTotal(800, 1000, 9)).toBe(910);
});
it('rounds twentieth-cent values once and preserves shared commitments', () => {
  expect(twentiethWeightForecastTotal(0.28, 0.29, 11)).toBe(0.28);
  expect(twentiethWeightForecastTotal(0.28, 0.29, 9)).toBe(0.29);
  expect(twentiethWeightForecastTotal(0, 0.10, 11)).toBe(0.05);
  expect(twentiethWeightForecastTotal(0, 0.10, 9)).toBe(0.06);
  expect(twentiethWeightForecastTotal(340, 380, 11)).toBe(358);
  expect(twentiethWeightForecastTotal(340, 380, 9)).toBe(362);
});
it('keeps twentieth-weight results within range and symmetric under swapping components', () => {
  expect(twentiethWeightForecastTotal(123.45, 123.45, 11)).toBe(123.45);
  expect(twentiethWeightForecastTotal(0, 0, 9)).toBe(0);
  for (const [a, b] of [[10.01, 20.03], [45, 12.99], [0, 1000], [42, 42]]) {
    const value = twentiethWeightForecastTotal(a, b, 11);
    expect(value).toBe(twentiethWeightForecastTotal(b, a, 9));
    expect(value).toBeGreaterThanOrEqual(Math.min(a, b));
    expect(value).toBeLessThanOrEqual(Math.max(a, b));
  }
});
it('rejects unsupported twentieth weights, fractional cents and unsafe sums', () => {
  expect(() => twentiethWeightForecastTotal(1, 2, 10 as 9)).toThrow('Invalid forecast weights');
  expect(() => twentiethWeightForecastTotal(1, 2, 9.5 as 9)).toThrow('Invalid forecast weights');
  expect(() => twentiethWeightForecastTotal(0.001, 2, 11)).toThrow('Invalid forecast amount');
  expect(() => twentiethWeightForecastTotal(1e13, 1e13, 11)).toThrow('Forecast combination overflow');
});
