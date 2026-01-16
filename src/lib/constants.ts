import { CurrencyCode, AssetType } from './types';

/**
 * Opzioni di emoji per categorie e icone
 */
export const EMOJI_OPTIONS = [
  '🍔', '🚗', '🏠', '🎬', '💊', '📦', '💰', '📈', '💵', '✈️',
  '🎮', '🎵', '🏋️', '☕', '🎁', '🍕', '🎨', '🏥', '⚽', '📱',
  '🔧', '🚲', '🚌', '👕', '🚬', '♠️', '🤖', '👨‍⚕️', '🍣', '⚖️',
  '📉', '🎲', '🐶', '📖', '🛒', '🔄', '🏛️'
];

/**
 * Opzioni di colori per categorie e icone
 */
export const COLOR_OPTIONS = [
  '#f97316', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#ef4444',
  '#6b7280', '#22c55e', '#14b8a6', '#06b6d4'
];

/**
 * Simboli delle valute
 */
export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
  CHF: 'CHF',
  JPY: '¥',
  CAD: 'C$',
  AUD: 'A$',
  CNY: '¥',
};

/**
 * Etichette per i tipi di asset
 */
export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  stock: 'Azioni',
  etf: 'ETF',
  crypto: 'Crypto',
  bond: 'Obbligazioni',
  cash: 'Liquidità',
  real_estate: 'Immobili',
  other: 'Altro',
};

/**
 * Numero di giorni da considerare per il calcolo della media delle spese
 */
export const MEAN_CALCULATION_DAYS = 365;

/**
 * Numero di giorni da considerare per il calcolo della mediana delle spese
 */
export const MEDIAN_CALCULATION_DAYS = 730;

/**
 * Numero di giorni da considerare per il calcolo della media winsorizzata delle spese
 */
export const WINSORIZED_MEAN_CALCULATION_DAYS = 730;