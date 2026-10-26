/** Offline point-forecast combination: fixed 50/50, no fitted weights or interval claim. */
export function equalWeightForecastTotal(current: number, weekly: number): number {
  const toCents = (value: number): number => {
    const amount = Math.round(value * 100);
    if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(amount) || Math.abs(value - amount / 100) > 1e-9) {
      throw new Error('Invalid forecast amount');
    }
    return amount;
  };
  const first = toCents(current), second = toCents(weekly);
  const sum = first + second;
  if (!Number.isSafeInteger(sum)) throw new Error('Forecast combination overflow');
  // Components already use cents; round a positive half-cent upwards exactly once.
  return Math.round(sum / 2) / 100;
}
