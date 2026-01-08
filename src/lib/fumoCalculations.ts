/**
 * Costante per millisecondi al giorno
 */
const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;

export interface DerivedFields {
  giorni_durata: number | null;
  quantita_al_giorno: number | null;
  euro_al_giorno: number | null;
  costo_mensile: number | null;
}

/**
 * Calcola i campi derivati per i dati di fumo
 * @param arrivalDate Data di arrivo (formato stringa)
 * @param finishDate Data di fine (formato stringa o null)
 * @param quantity Quantità totale (number o null)
 * @param cost Costo totale
 * @returns Oggetto con i campi derivati calcolati
 *
 * @example
 * ```typescript
 * const result = calculateDerivedFields(
 *   '2024-01-01',
 *   '2024-01-31',
 *   30,
 *   150
 * );
 * // { giorni_durata: 30, quantita_al_giorno: 1, euro_al_giorno: 5, costo_mensile: 150 }
 * ```
 */
export const calculateDerivedFields = (
  arrivalDate: string,
  finishDate: string | null,
  quantity: number | null,
  cost: number
): DerivedFields => {
  if (!finishDate || !quantity || quantity === 0) {
    return getNullDerivedFields();
  }

  // Validazione delle date
  try {
    const arrival = new Date(arrivalDate);
    const finish = new Date(finishDate);

    if (isNaN(arrival.getTime()) || isNaN(finish.getTime())) {
      console.error('Date non valide:', { arrivalDate, finishDate });
      return getNullDerivedFields();
    }

    const giorni = Math.ceil((finish.getTime() - arrival.getTime()) / MILLISECONDS_PER_DAY);
    
    if (giorni > 0) {
      return {
        giorni_durata: giorni,
        quantita_al_giorno: quantity / giorni,
        euro_al_giorno: cost / giorni,
        costo_mensile: (cost / giorni) * 30
      };
    }
    
    return getNullDerivedFields();
  } catch (error) {
    console.error('Errore nel calcolo dei campi derivati:', error);
    return getNullDerivedFields();
  }
};

/**
 * Restituisce un oggetto DerivedFields con tutti i valori nulli
 */
function getNullDerivedFields(): DerivedFields {
  return {
    giorni_durata: null,
    quantita_al_giorno: null,
    euro_al_giorno: null,
    costo_mensile: null
  };
}
