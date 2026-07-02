import type { PortfolioAsset, AssetType } from './types';

/**
 * Net worth calculation — extracted from the Dashboard so it can be reused by
 * the Net Worth history page and by the daily snapshot logic (SQL mirror in
 * the snapshot_net_worth_for_user() function).
 *
 * Formula (unchanged from the original Dashboard implementation):
 *   netWorth = cashflow + portfolioPL + realEstateDiscounted
 * where:
 *   - cashflow               = totalIncome − totalExpense (all transactions)
 *   - portfolioPL            = sum over OPEN investment assets
 *                              (current_price − purchase_price) * quantity,
 *                              excluding cash / real_estate / other.
 *   - realEstateDiscounted   = real_estate market value * 0.75 (25% haircut).
 *
 * NOTE: cash holdings in portfolio_assets are intentionally excluded (they are
 * already accounted for via cashflow). "other" assets are excluded too.
 */

/** Asset types that count toward portfolio P&L (investment instruments only). */
const INVESTMENT_TYPES: ReadonlySet<AssetType> = new Set([
  'stock',
  'etf',
  'crypto',
  'bond',
] as AssetType[]);

export interface NetWorthComponents {
  /** Total income minus total expenses across ALL transactions (all-time). */
  cashflow: number;
  /** P&L of open investment positions (stocks/etf/crypto/bonds). */
  portfolioPL: number;
  /** Market value of real estate, discounted by 25%. */
  realEstateDiscounted: number;
  /** Cashflow + portfolioPL + realEstateDiscounted. */
  netWorth: number;
}

export interface NetWorthInput {
  transactions: Array<{ type: 'income' | 'expense'; amount: number | string }>;
  /** Open (non-sold) portfolio assets. */
  assets: PortfolioAsset[];
}

/**
 * Compute net worth and its components from raw transactions + open assets.
 * Pure function — safe to unit-test.
 */
export function calculateNetWorth({ transactions, assets }: NetWorthInput): NetWorthComponents {
  const totalIncome = sumAmounts(transactions.filter((t) => t.type === 'income'));
  const totalExpense = sumAmounts(transactions.filter((t) => t.type === 'expense'));
  const cashflow = totalIncome - totalExpense;

  // Portfolio P&L: only investment instruments (excludes cash, real_estate, other).
  const openAssets = assets.filter((a) => !a.sold_at || a.sold_price === null);
  const portfolioPL = openAssets
    .filter((a) => INVESTMENT_TYPES.has(a.type))
    .reduce((sum, a) => {
      const price = a.current_price ?? a.purchase_price;
      return sum + (price - a.purchase_price) * a.quantity;
    }, 0);

  // Real estate market value with a 25% prudential haircut.
  const realEstateValue = openAssets
    .filter((a) => a.type === 'real_estate')
    .reduce((sum, a) => {
      const price = a.current_price ?? a.purchase_price;
      return sum + price * a.quantity;
    }, 0);
  const realEstateDiscounted = realEstateValue * 0.75;

  const netWorth = cashflow + portfolioPL + realEstateDiscounted;

  // Round to cents to avoid floating-point noise.
  return {
    cashflow: round2(cashflow),
    portfolioPL: round2(portfolioPL),
    realEstateDiscounted: round2(realEstateDiscounted),
    netWorth: round2(netWorth),
  };
}

function sumAmounts(rows: Array<{ amount: number | string }>): number {
  return rows.reduce((sum, t) => sum + Number(t.amount), 0);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Convenience helper: the open investment portfolio market value
 * (current_price * quantity, for stocks/etf/crypto/bonds only).
 * Useful for display alongside net worth.
 */
export function calculateInvestmentPortfolioValue(assets: PortfolioAsset[]): number {
  const openAssets = assets.filter((a) => !a.sold_at || a.sold_price === null);
  return round2(
    openAssets
      .filter((a) => INVESTMENT_TYPES.has(a.type))
      .reduce((sum, a) => {
        const price = a.current_price ?? a.purchase_price;
        return sum + price * a.quantity;
      }, 0)
  );
}
