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
  CNY: '¥',
  IDR: 'Rp',
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

/**
 * Singola fonte di verita per le tabelle utente con scope `user_id`.
 *
 * Usata da:
 *  - useSupabaseData (whitelist anti-SQL-injection + VALID_TABLES)
 *  - Settings.tsx (export GDPR art. 20)
 *
 * Aggiungere qui ogni nuova tabella utente creata via migration, in modo che
 * export e whitelist restino allineati (previene il drift tipo il bug C2 del
 * round 1, dove `poker_monthly_expenses` era presente nell'export ma mancava
 * nella whitelist).
 */
export const USER_TABLES = [
  'transactions',
  'categories',
  'budgets',
  'savings_goals',
  'recurring_expenses',
  'portfolio_assets',
  'asset_price_history',
  'manual_price_updates',
  'price_update_logs',
  'category_mappings',
  'isin_mappings',
  'poker_manual_expenses',
  'poker_monthly_expenses',
  'poker_next_cut',
  'poker_hourly_earnings',
  'poker_rakeback',
  'liquido_sigaretta',
  'cbd',
  'thc',
  'tgc_cards',
  'library_items',
  'couple_connection_requests',
  'couple_connections',
  'couple_budgets',
  'shared_expenses',
] as const;

/** Type alias per i nomi tabella validi (utile per i cast tipizzati). */
export type UserTableName = (typeof USER_TABLES)[number];