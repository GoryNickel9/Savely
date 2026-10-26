/** Offline fixed weights: currentQuarters=3 means 75% current / 25% weekly. */
export function quarterWeightForecastTotal(current: number, weekly: number, currentQuarters: 1 | 2 | 3): number {
  if (![1, 2, 3].includes(currentQuarters)) throw new Error('Invalid forecast weights');
  const toCents = (value: number): number => {
    const amount = Math.round(value * 100);
    if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(amount) || Math.abs(value - amount / 100) > 1e-9) {
      throw new Error('Invalid forecast amount');
    }
    return amount;
  };
  const first = toCents(current), second = toCents(weekly);
  // Reduce 2/4 to 1/2 so the existing 50/50 precision limit remains unchanged.
  const sum = currentQuarters === 2 ? first + second : first * currentQuarters + second * (4 - currentQuarters);
  if (!Number.isSafeInteger(sum)) throw new Error('Forecast combination overflow');
  // Integer cent numerator and binary-exact denominator, with one final rounding.
  return Math.round(sum / (currentQuarters === 2 ? 2 : 4)) / 100;
}

/** Compatibility entry point for the fixed 50/50 experiment. */
export function equalWeightForecastTotal(current: number, weekly: number): number {
  return quarterWeightForecastTotal(current, weekly, 2);
}
