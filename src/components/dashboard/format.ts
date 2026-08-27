import { CURRENCY_SYMBOLS } from '@/lib/constants';

/** Formatta un importo nello stile dell'applicazione (es. € 1.234,56). */
export function formatEUR(amount: number): string {
  return `${CURRENCY_SYMBOLS.EUR}${(Number(amount) || 0).toLocaleString('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Formatta una percentuale già in scala 0–100 con al massimo un decimale (it-IT). */
export function formatPercent(percent: number): string {
  return `${(Number(percent) || 0).toLocaleString('it-IT', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })}%`;
}
