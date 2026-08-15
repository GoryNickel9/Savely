/**
 * Tipi condivisi per i dialog di import
 * Questi tipi vengono utilizzati da BankImportDialog e RevolutImportDialog
 */

/**
 * Transazione BBVA
 */
export interface BBVATransaction {
  date: string;
  nota: string;
  amount: number;
  isIncome: boolean;
}

/**
 * Transazione BBVA con categoria assegnata
 */
export interface AutoImportTransaction extends BBVATransaction {
  categoryId: string;
  editedNota: string;
}

/**
 * Transazione Revolut
 */
export interface RevolutTransaction {
  Type: string;
  Product: string;
  'Started Date': string | number | Date;
  'Completed Date': string | number | Date;
  Description: string;
  Amount: number;
  Fee: number;
  Currency: string;
  State: string;
  Balance: number;
}

/**
 * Transazione in attesa di categorizzazione
 */
export interface PendingTransaction {
  description: string;
  amount: number;
  date: string;
  categoryId?: string;
}

/**
 * Nuova categoria da creare durante l'import
 */
export interface NewCategory {
  name: string;
  icon: string;
  color: string;
  mappedTo?: string; // ID of existing category to map to
}

/**
 * Categoria esistente
 */
export interface ExistingCategory {
  id: string;
  name: string;
  icon: string | null;
}

/**
 * Transazione duplicata
 */
export interface DuplicateTransaction {
  csvRow: Record<string, unknown>;
  existing: {
    id: string;
    amount: number;
    date: string;
    description: string | null;
    category_name: string | null;
  };
  keep: 'existing' | 'new' | 'both';
}

/**
 * Progresso dell'importazione
 */
export interface ImportProgress {
  current: number;
  total: number;
  status: string;
}

/**
 * Tipo di importazione
 */
export type ImportType = 'income' | 'expense' | 'investment';

/**
 * Step dell'importazione
 */
export type ImportStep = 'upload' | 'review' | 'importing' | 'complete' | 'select-type' | 'preview-categories' | 'resolve-duplicates';

/**
 * Icone predefinite per categorie
 */
export const DEFAULT_ICONS_INCOME = ['💰', '💵', '📈', '💳', '🏦', '💎', '🎯', '🎁'] as const;
export const DEFAULT_ICONS_EXPENSE = ['💸', '🛒', '🍔', '🚗', '🏠', '💊', '🎬', '📦'] as const;

/**
 * Colori predefiniti per categorie
 */
export const DEFAULT_COLORS = [
  '#22c55e',
  '#3b82f6',
  '#8b5cf6',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
  '#14b8a6',
  '#6b7280'
] as const;
