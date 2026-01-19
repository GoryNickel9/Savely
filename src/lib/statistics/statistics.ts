/**
 * Modulo centralizzato per funzioni statistiche
 * 
 * Questo modulo fornisce funzioni riutilizzabili per il calcolo di statistiche
 * avanzate su array di valori numerici.
 */

/**
 * Calcola la media aritmetica dei valori
 * @param values Array di valori numerici
 * @returns Media aritmetica
 */
export function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  
  const sum = values.reduce((acc, val) => acc + val, 0);
  return sum / values.length;
}

/**
 * Calcola la mediana dei valori (inclusi i valori zero)
 * @param values Array di valori numerici
 * @returns Mediana
 */
export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  
  // Ordina i valori (inclusi i valori zero)
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Calcola la media winsorizzata (sostituisce i valori estremi con i valori al percentile specificato)
 * @param values Array di valori numerici
 * @param percentile Percentile per winsorizzazione (default: 0.10 per 10% su entrambi i lati)
 * @returns Media winsorizzata
 * @throws Error se il percentile non è valido
 */
export function calculateWinsorizedMean(values: number[], percentile: number = 0.10): number {
  if (values.length === 0) return 0;
  
  // Validazione del percentile
  if (percentile < 0 || percentile >= 0.5) {
    throw new Error('Percentile deve essere tra 0 e 0.5 (escluso)');
  }
  
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  
  // Calcola il numero di elementi da winsorizzare su ogni lato
  const k = Math.floor(n * percentile);
  
  if (k === 0) {
    // Se non ci sono elementi da winsorizzare, calcola la media normale
    const sum = sorted.reduce((acc, val) => acc + val, 0);
    return sum / n;
  }
  
  // Identifica i valori di soglia
  const lowerBound = sorted[k];
  const upperBound = sorted[n - 1 - k];
  
  // Sostituisci i valori estremi con i valori al percentile specificato
  const winsorized = sorted.map((val, index) => {
    if (index < k) return lowerBound;
    if (index > n - 1 - k) return upperBound;
    return val;
  });
  
  const sum = winsorized.reduce((acc, val) => acc + val, 0);
  return sum / n;
}
