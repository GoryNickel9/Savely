function fractionForecastTotal(current: number, weekly: number, numerator: number, denominator: number): number {
  const toCents = (value: number): number => {
    const amount = Math.round(value * 100);
    if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(amount) || Math.abs(value - amount / 100) > 1e-9) {
      throw new Error('Invalid forecast amount');
    }
    return amount;
  };
  const first = toCents(current), second = toCents(weekly);
  const sum = first * numerator + second * (denominator - numerator);
  if (!Number.isSafeInteger(sum)) throw new Error('Forecast combination overflow');
  // Compare the integer remainder: dividing large sums by five can turn 0.4 into 0.5.
  const rounded = Math.floor(sum / denominator) + (2 * (sum % denominator) >= denominator ? 1 : 0);
  return rounded / 100;
}

/** Offline fixed weights: currentQuarters=3 means 75% current / 25% weekly. */
export function quarterWeightForecastTotal(current: number, weekly: number, currentQuarters: 1 | 2 | 3): number {
  if (![1, 2, 3].includes(currentQuarters)) throw new Error('Invalid forecast weights');
  // Preserve the original 50/50 precision limit by reducing 2/4 to 1/2.
  return fractionForecastTotal(current, weekly, currentQuarters === 2 ? 1 : currentQuarters, currentQuarters === 2 ? 2 : 4);
}

/** Offline fixed weights: currentFifths=3 means 60% current / 40% weekly. */
export function fifthWeightForecastTotal(current: number, weekly: number, currentFifths: 2 | 3): number {
  if (![2, 3].includes(currentFifths)) throw new Error('Invalid forecast weights');
  return fractionForecastTotal(current, weekly, currentFifths, 5);
}

/** Offline fixed weights: currentTwentieths=11 means 55% current / 45% weekly. */
export function twentiethWeightForecastTotal(current: number, weekly: number, currentTwentieths: 9 | 11): number {
  if (![9, 11].includes(currentTwentieths)) throw new Error('Invalid forecast weights');
  return fractionForecastTotal(current, weekly, currentTwentieths, 20);
}

/** Compatibility entry point for the fixed 50/50 experiment. */
export function equalWeightForecastTotal(current: number, weekly: number): number {
  return quarterWeightForecastTotal(current, weekly, 2);
}
