export type CurrencyCode = 'EUR' | 'USD' | 'GBP' | 'CHF' | 'JPY' | 'CNY' | 'IDR';
export type TransactionType = 'income' | 'expense';
export type AssetType = 'stock' | 'etf' | 'crypto' | 'bond' | 'cash' | 'real_estate' | 'other';

/**
 * Chiavi dei permessi utente
 */
export type PermissionKey = 'admin' | 'poker' | 'fumo' | 'statistics_deep_dive' | 'fire' | 'tcg';

/**
 * Struttura dei permessi utente
 */
export interface Permissions {
  admin: boolean;
  poker: boolean;
  fumo: boolean;
  statistics_deep_dive: boolean;
  fire: boolean;
  tcg: boolean;
}

/**
 * @deprecated Usare Permissions invece
 */
export interface UserPermissions {
  admin: boolean;
  poker: boolean;
  fumo: boolean;
  statistics_deep_dive: boolean;
  fire: boolean;
  tcg: boolean;
}

export type TcgGame = 'magic' | 'pokemon' | 'yugioh';

export type CardCondition = 'near_mint' | 'lightly_played' | 'moderately_played' | 'heavily_played' | 'damaged';

export const CARD_CONDITION_LABELS: Record<CardCondition, string> = {
  near_mint: 'Near Mint',
  lightly_played: 'Lightly Played',
  moderately_played: 'Moderately Played',
  heavily_played: 'Heavily Played',
  damaged: 'Damaged',
};

export const TCG_GAME_LABELS: Record<TcgGame, string> = {
  magic: 'Magic: The Gathering',
  pokemon: 'Pokémon TCG',
  yugioh: 'Yu-Gi-Oh!',
};

export interface TcgCard {
  id: string;
  user_id: string;
  name: string;
  category: TcgGame;
  card_id: string | null;
  set_code: string | null;
  collector_number: string | null;
  condition: CardCondition;
  language: string;
  quantity: number;
  purchase_price: number;
  purchase_date: string;
  current_price: number | null;
  image_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  default_currency: CurrencyCode;
  permissions: Permissions;
  created_at: string;
  updated_at: string;
}

/**
 * @deprecated Usare Permissions invece
 */
export interface UserPermissions {
  admin: boolean;
  poker: boolean;
  fumo: boolean;
  statistics_deep_dive: boolean;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  type: TransactionType;
  created_at: string;
  deleted_at: string | null;
}

export interface Transaction {
  id: string;
  user_id: string;
  category_id: string | null;
  type: TransactionType;
  amount: number;
  currency: CurrencyCode;
  description: string | null;
  date: string;
  exchange_rate_eur: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  category?: Category;
}

export interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  amount: number;
  currency: CurrencyCode;
  month: number;
  year: number;
  created_at: string;
  updated_at: string;
  category?: Category;
}

export interface PortfolioAsset {
  id: string;
  user_id: string;
  name: string;
  symbol: string | null;
  type: AssetType;
  quantity: number;
  purchase_price: number;
  current_price: number | null;
  currency: CurrencyCode;
  purchase_date: string;
  sold_at: string | null;
  sold_price: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavingsGoal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  currency: CurrencyCode;
  deadline: string | null;
  icon: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface PokerMonthlyExpense {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  is_mandatory: boolean;
  created_at: string;
  updated_at: string;
}

export interface PokerNextCut {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  deal: number;
  profit_loss: number;
  created_at: string;
  updated_at: string;
}
