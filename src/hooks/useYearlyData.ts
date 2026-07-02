import { useMemo } from 'react';
import { parseLocalDate } from '@/lib/utils';

/**
 * Tipo per campi aggiuntivi dinamici nei dati annuali
 */
type AdditionalFields = Record<string, number>;

interface YearlyData<T> {
  year: string;
  total: number;
  data: T[];
  [key: string]: number | string | T[] | undefined; // Per campi aggiuntivi dinamici
}

interface UseYearlyDataOptions<T> {
  items: T[];
  getDate: (item: T) => string;
  getValue: (item: T) => number;
  additionalFields?: Record<string, (group: T[]) => number>;
}

/**
 * Hook per raggruppare dati annuali con campi aggiuntivi calcolati
 *
 * @template T - Tipo degli item da raggruppare
 * @param options - Opzioni di configurazione
 * @returns Array di dati raggruppati per anno
 *
 * @example
 * ```tsx
 * const yearlyData = useYearlyData({
 *   items: transactions,
 *   getDate: (t) => t.date,
 *   getValue: (t) => t.amount,
 *   additionalFields: {
 *     count: (group) => group.length,
 *     avg: (group) => group.reduce((sum, t) => sum + t.amount, 0) / group.length
 *   }
 * });
 * ```
 */
export function useYearlyData<T>(
  options: UseYearlyDataOptions<T>
): YearlyData<T>[] {
  const { items, getDate, getValue, additionalFields = {} } = options;

  return useMemo(() => {
    const grouped = items.reduce((acc: YearlyData<T>[], item) => {
      const year = parseLocalDate(getDate(item)).getFullYear().toString();
      const existing = acc.find(g => g.year === year);
      
      if (existing) {
        existing.total += getValue(item);
        existing.data.push(item);
        
        // Aggiorna campi aggiuntivi
        Object.entries(additionalFields).forEach(([key, calculator]) => {
          existing[key] = calculator(existing.data);
        });
      } else {
        const newGroup: YearlyData<T> = {
          year,
          total: getValue(item),
          data: [item]
        };
        
        // Calcola campi aggiuntivi iniziali
        Object.entries(additionalFields).forEach(([key, calculator]) => {
          newGroup[key] = calculator([item]);
        });
        
        acc.push(newGroup);
      }
      
      return acc;
    }, []);
    
    return grouped.sort((a, b) => b.year.localeCompare(a.year));
  }, [items, getDate, getValue, additionalFields]);
}
