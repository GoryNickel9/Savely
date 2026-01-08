export type CurrencyCode = 'EUR' | 'USD' | 'GBP' | 'CHF' | 'JPY' | 'CAD' | 'AUD' | 'CNY';
export type TransactionType = 'income' | 'expense';
export type AssetType = 'stock' | 'etf' | 'crypto' | 'bond' | 'cash' | 'real_estate';

/**
 * Chiavi dei permessi utente
 */
export type PermissionKey = 'admin' | 'poker' | 'fumo' | 'statistics_deep_dive';

/**
 * Struttura dei permessi utente
 */
export interface Permissions {
  admin: boolean;
  poker: boolean;
  fumo: boolean;
  statistics_deep_dive: boolean;
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
  created_at: string;
  updated_at: string;
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
