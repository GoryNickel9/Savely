export interface DerivedFields {
  giorni_durata: number | null;
  quantita_al_giorno: number | null;
  euro_al_giorno: number | null;
  costo_mensile: number | null;
}

export const calculateDerivedFields = (
  arrivalDate: string,
  finishDate: string | null,
  quantity: number | null,
  cost: number
): DerivedFields => {
  if (!finishDate || !quantity || quantity === 0) {
    return {
      giorni_durata: null,
      quantita_al_giorno: null,
      euro_al_giorno: null,
      costo_mensile: null
    };
  }
  
  const arrival = new Date(arrivalDate);
  const finish = new Date(finishDate);
  const giorni = Math.ceil((finish.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24));
  
  if (giorni > 0) {
    return {
      giorni_durata: giorni,
      quantita_al_giorno: quantity / giorni,
      euro_al_giorno: cost / giorni,
      costo_mensile: (cost / giorni) * 30
    };
  }
  
  return {
    giorni_durata: null,
    quantita_al_giorno: null,
    euro_al_giorno: null,
    costo_mensile: null
  };
};

export const calculateDerivedFieldsForInsertion = (
  arrivalDate: string,
  finishDate: string | null,
  quantity: number | null,
  cost: number
): DerivedFields => {
  return calculateDerivedFields(arrivalDate, finishDate, quantity, cost);
};
