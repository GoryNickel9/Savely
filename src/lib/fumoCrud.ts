/**
 * Pure functions per la pagina CRUD Fumo (CBD / THC / Liquido Sigaretta).
 *
 * Estratte da src/components/fumo/FumoCrudPage.tsx (REF-12) in un modulo
 * separato senza dipendenze da React/Supabase, cosi' da poterle testare
 * senza istanziare il client Supabase (che richiede VITE_SUPABASE_URL).
 */

import type { ReactNode } from 'react';

/** Campi derivati comuni a tutte le tabelle Fumo. */
export interface FumoDerivedFields {
  giorni_durata: number | null;
  quantita_al_giorno: number | null;
  euro_al_giorno: number | null;
  costo_mensile: number | null;
}

/** Record base condiviso da CBD/THC/Liquido (campi derivati + audit). */
export interface FumoBaseEntry {
  id: string;
  user_id: string;
  costo: number;
  /** Data di arrivo/acquisto. Il nome del campo DB varia (data_acquisto | data_arrivo); viene letto dinamicamente tramite `dateArrivoField`. */
  data_arrivo?: string;
  data_acquisto?: string;
  data_finito: string | null;
  giorni_durata: number | null;
  euro_al_giorno: number | null;
  costo_mensile: number | null;
  created_at: string;
  updated_at: string;
}

export interface FumoYearRow {
  anno: number;
  costoTotale: number;
  costoMensile: number;
  /** Valore aggregato addizionale (grammi totali, ml totali, ecc.). */
  extraTotal: number;
}

export interface FumoYearColumn<T> {
  key: string;
  header: string;
  /** Render del valore per riga annuale. */
  render: (yearRow: FumoYearRow, entries: T[]) => ReactNode;
}

/**
 * Legge la data di arrivo/acquisto da una entry in base al nome del campo DB.
 */
export function readArrivo<T extends FumoBaseEntry>(entry: T, field: string): string {
  return ((entry as Record<string, unknown>)[field] as string) ?? entry.data_arrivo ?? entry.data_acquisto ?? '';
}

/**
 * Calcola i campi derivati (giorni, quantità/giorno, euro/giorno, costo mensile).
 * Versione generica condivisa; per CBD/THC `quantitaLabel` e' "grammi", per
 * Liquido e' "millilitri" (ma la chiave interna resta `quantita_al_giorno`).
 */
export function computeDerived(
  arrivo: string,
  finito: string | null,
  quantita: number | null,
  costo: number
): FumoDerivedFields {
  if (!finito) {
    return { giorni_durata: null, quantita_al_giorno: null, euro_al_giorno: null, costo_mensile: null };
  }
  const dataArrivo = new Date(arrivo);
  const dataFinito = new Date(finito);
  const giorni = Math.ceil((dataFinito.getTime() - dataArrivo.getTime()) / (1000 * 60 * 60 * 24));
  if (giorni > 0) {
    return {
      giorni_durata: giorni,
      quantita_al_giorno: quantita !== null ? quantita / giorni : null,
      euro_al_giorno: costo / giorni,
      costo_mensile: (costo / giorni) * 30,
    };
  }
  return { giorni_durata: null, quantita_al_giorno: null, euro_al_giorno: null, costo_mensile: null };
}

/**
 * Calcola le statistiche annuali a partire dalle entry.
 * Raggruppa per anno (su data_arrivo), somma costo, e raccoglie l'extraTotal
 * (grammi/ml) sommando il campo quantita' di ciascuna entry.
 */
export function computeYearlyStats<T extends FumoBaseEntry>(
  entries: T[],
  dateArrivoField: string
): FumoYearRow[] {
  const byYear = new Map<number, { costo: number; extra: number }>();
  entries.forEach((e) => {
    const year = new Date(readArrivo(e, dateArrivoField)).getFullYear();
    const cur = byYear.get(year) ?? { costo: 0, extra: 0 };
    cur.costo += Number(e.costo);
    const q = (e as Record<string, unknown>).quantita as number | null
      ?? (e as Record<string, unknown>).grammi as number | null
      ?? (e as Record<string, unknown>).millilitri as number | null
      ?? 0;
    cur.extra += Number(q);
    byYear.set(year, cur);
  });
  return Array.from(byYear.entries())
    .map(([anno, v]) => ({
      anno,
      costoTotale: v.costo,
      extraTotal: v.extra,
      costoMensile: v.costo / 12,
    }))
    .sort((a, b) => b.anno - a.anno);
}
