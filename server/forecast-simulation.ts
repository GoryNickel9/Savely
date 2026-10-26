export interface SimulationPoint { date: string; median: number; lower80: number; upper80: number; mean: number }
export function quantile(sorted: number[], fraction: number): number {
  const position = (sorted.length - 1) * fraction, low = Math.floor(position), weight = position - low;
  return sorted[low] * (1 - weight) + sorted[Math.ceil(position)] * weight;
}
export function randomGenerator(seed: number): () => number {
  let state = seed >>> 0;
  // Mulberry32: fixed integer arithmetic, reproducible across Node and browser runtimes.
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
export function dateSeed(seed: number, date: string): number {
  let result = seed >>> 0;
  for (const char of date) result = Math.imul(result ^ char.charCodeAt(0), 16777619) >>> 0;
  return result;
}
