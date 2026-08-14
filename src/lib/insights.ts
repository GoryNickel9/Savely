/**
 * Insights / anomaly detection.
 *
 * Pure functions that analyze the user's financial data and surface notable
 * signals: spending anomalies vs the per-category median, budget overruns,
 * portfolio positions in heavy loss, net-worth milestones, above-average
 * saving months, growing category trends, and recurring-expense hints.
 *
 * Everything is derived from data already fetched by the existing hooks —
 * no Supabase calls, fully unit-testable. The thresholds are tuned to be
 * conservative (avoid noise) and live as module constants so they can be
 * tweaked in one place.
 */

import i18n from '@/i18n';
import type { Transaction, Budget, Category, PortfolioAsset } from './types';
import type { NetWorthSnapshot } from '@/hooks/useNetWorthHistory';
import type { RecurringCandidate } from './recurringDetection';
import { normalizeDescription } from './recurringDetection';
import { calculateMedian } from './statistics';
import { parseLocalDate } from './utils';
import { MEDIAN_CALCULATION_DAYS } from './constants';

// --- Public types -----------------------------------------------------------

export type InsightSeverity = 'positive' | 'info' | 'warning';

export type InsightKind =
  | 'spending_anomaly'
  | 'recurring_price_change'
  | 'budget_exceeded'
  | 'portfolio_loss'
  | 'net_worth_milestone'
  | 'saving_month'
  | 'category_trend'
  | 'new_recurring_detected';

export interface Insight {
  /** Deterministic slug, stable across renders (used as React key). */
  id: string;
  kind: InsightKind;
  severity: InsightSeverity;
  title: string;
  message: string;
  /** Numeric value relevant to the insight, for sorting/filtering (optional). */
  value?: number;
  /** Category name when the insight is category-scoped (optional). */
  category?: string;
}

export interface InsightsInput {
  transactions: Transaction[];
  budgets: Budget[];
  categories: Category[];
  openAssets: PortfolioAsset[];
  netWorthHistory: NetWorthSnapshot[];
  /** Recurring candidates already filtered (tracked/dismissed removed). */
  recurringCandidates?: RecurringCandidate[];
  /** Reference date — defaults to now(). Pass explicitly in tests. */
  referenceDate?: Date;
}

// --- Tunable thresholds -----------------------------------------------------

/** A category is anomalous if its current-month spend is at least this factor
 *  of the median monthly spend, AND ≥ ANOMALY_MIN_AMOUNT. */
const ANOMALY_FACTOR = 1.4;
const ANOMALY_MIN_AMOUNT = 50;

/** Portfolio position flagged as loss when unrealized P&L% ≤ this. */
const PORTFOLIO_LOSS_THRESHOLD = -0.15;

/** A month counts as a "saving month" if net saving ≥ SAVING_FACTOR × the
 *  average monthly saving over the past 12 months. */
const SAVING_FACTOR = 1.2;

/** A category is trending up if its 3-month median ≥ TREND_FACTOR × the
 *  12-month median. */
const TREND_FACTOR = 1.25;

/** A recurring expense's latest amount is flagged if it differs from the
 *  group median by at least this fraction. */
const RECURRING_PRICE_CHANGE = 0.1;

/** Net-worth milestone requires the latest snapshot to beat the previous max
 *  by at least this much (absolute EUR) to avoid noise. */
const NET_WORTH_MILESTONE_DELTA = 1;

// --- Entry point ------------------------------------------------------------

/**
 * Generate the full list of insights from the user's data.
 *
 * Detectors are independent: each returns its own slice of insights, which
 * are then merged and sorted by severity (warning → positive → info) and,
 * within the same severity, by descending absolute value.
 */
export function generateInsights(input: InsightsInput): Insight[] {
  const {
    transactions,
    budgets,
    categories,
    openAssets,
    netWorthHistory,
    recurringCandidates = [],
    referenceDate = new Date(),
  } = input;

  const categoryName = buildCategoryNameMap(categories);

  const insights: Insight[] = [
    ...detectSpendingAnomalies(transactions, categoryName, referenceDate),
    ...detectBudgetExceeded(transactions, budgets, categoryName, referenceDate),
    ...detectPortfolioLoss(openAssets),
    ...detectNetWorthMilestone(netWorthHistory),
    ...detectSavingMonth(transactions, referenceDate),
    ...detectCategoryTrend(transactions, categoryName, referenceDate),
    ...detectNewRecurring(recurringCandidates),
    ...detectRecurringPriceChange(transactions, recurringCandidates),
  ];

  return insights.sort(compareInsights);
}

// --- Detectors --------------------------------------------------------------

/**
 * For each category, compare the current-month expense total to the median
 * monthly expense over the trailing MEDIAN_CALCULATION_DAYS window. Flag when
 * the current month is ≥ ANOMALY_FACTOR × median and ≥ ANOMALY_MIN_AMOUNT.
 */
function detectSpendingAnomalies(
  transactions: Transaction[],
  categoryName: Map<string, string>,
  referenceDate: Date
): Insight[] {
  const windowStart = subDays(referenceDate, MEDIAN_CALCULATION_DAYS);
  const currentMonthKey = monthKey(referenceDate);

  const expenses = transactions.filter(
    (t) => t.type === 'expense' && t.category_id && parseLocalDate(t.date) >= windowStart
  );

  // Group monthly totals by category (exclude the current month from the baseline).
  const monthlyByCategory = new Map<string, number[]>();
  const currentByCategory = new Map<string, number>();

  for (const t of expenses) {
    const cat = t.category_id!;
    const mk = monthKey(parseLocalDate(t.date));
    const amount = Number(t.amount);
    if (mk === currentMonthKey) {
      currentByCategory.set(cat, (currentByCategory.get(cat) ?? 0) + amount);
    } else {
      if (!monthlyByCategory.has(cat)) monthlyByCategory.set(cat, []);
      monthlyByCategory.get(cat)!.push(amount);
    }
  }

  const insights: Insight[] = [];
  for (const [catId, currentAmount] of currentByCategory) {
    if (currentAmount < ANOMALY_MIN_AMOUNT) continue;
    const medians = monthlyByCategory.get(catId);
    if (!medians || medians.length === 0) continue;
    const median = calculateMedian(medians);
    if (median <= 0) continue;
    if (currentAmount >= median * ANOMALY_FACTOR) {
      const pct = Math.round(((currentAmount - median) / median) * 100);
      const name = categoryName.get(catId) ?? i18n.t('Senza categoria');
      insights.push({
        id: `spending_anomaly:${catId}`,
        kind: 'spending_anomaly',
        severity: 'warning',
        title: i18n.t('Spesa anomala in {{name}}', { name }),
        message: i18n.t('Hai speso {{amount}} questo mese, +{{pct}}% rispetto alla mediana mensile ({{median}}).', {
          amount: formatEur(currentAmount),
          pct,
          median: formatEur(median),
        }),
        value: currentAmount - median,
        category: name,
      });
    }
  }
  return insights;
}

/**
 * Flag budget overruns: current-month spending for a budgeted category above
 * the configured budget amount.
 */
function detectBudgetExceeded(
  transactions: Transaction[],
  budgets: Budget[],
  categoryName: Map<string, string>,
  referenceDate: Date
): Insight[] {
  const currentMonthKey = monthKey(referenceDate);
  const spentByCategory = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== 'expense' || !t.category_id) continue;
    if (monthKey(parseLocalDate(t.date)) !== currentMonthKey) continue;
    spentByCategory.set(
      t.category_id,
      (spentByCategory.get(t.category_id) ?? 0) + Number(t.amount)
    );
  }

  const insights: Insight[] = [];
  for (const b of budgets) {
    const spent = spentByCategory.get(b.category_id) ?? 0;
    if (b.amount > 0 && spent > b.amount) {
      const name = categoryName.get(b.category_id) ?? b.category?.name ?? i18n.t('Categoria');
      const over = spent - b.amount;
      insights.push({
        id: `budget_exceeded:${b.category_id}`,
        kind: 'budget_exceeded',
        severity: 'warning',
        title: i18n.t('Budget superato in {{name}}', { name }),
        message: i18n.t('Hai speso {{spent}} su un budget di {{budget}} ({{over}} oltre).', {
          spent: formatEur(spent),
          budget: formatEur(b.amount),
          over: formatEur(over),
        }),
        value: over,
        category: name,
      });
    }
  }
  return insights;
}

/**
 * Flag open investment positions with unrealized P&L% at or below the
 * PORTFOLIO_LOSS_THRESHOLD (default −15%).
 */
function detectPortfolioLoss(openAssets: PortfolioAsset[]): Insight[] {
  const insights: Insight[] = [];
  for (const a of openAssets) {
    if (!a.purchase_price || a.purchase_price <= 0) continue;
    const price = a.current_price ?? a.purchase_price;
    if (price == null) continue;
    const plPct = (price - a.purchase_price) / a.purchase_price;
    if (plPct <= PORTFOLIO_LOSS_THRESHOLD) {
      const pct = Math.round(plPct * 100);
      insights.push({
        id: `portfolio_loss:${a.id}`,
        kind: 'portfolio_loss',
        severity: 'warning',
        title: i18n.t('Posizione in perdita: {{name}}', { name: a.name }),
        message: i18n.t('{{symbol}} è al {{pct}}% rispetto al prezzo di acquisto.', {
          symbol: a.symbol ?? a.name,
          pct,
        }),
        value: plPct,
      });
    }
  }
  return insights;
}

/**
 * Flag a net-worth milestone: the most recent snapshot is the new all-time
 * high, beating the previous max by at least NET_WORTH_MILESTONE_DELTA.
 */
function detectNetWorthMilestone(history: NetWorthSnapshot[]): Insight[] {
  if (history.length < 2) return [];
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];
  const previousMax = Math.max(...sorted.slice(0, -1).map((s) => s.net_worth));
  if (latest.net_worth >= previousMax + NET_WORTH_MILESTONE_DELTA) {
    return [
      {
        id: 'net_worth_milestone',
        kind: 'net_worth_milestone',
        severity: 'positive',
        title: i18n.t('Nuovo massimo di Patrimonio Netto! 🎉'),
        message: i18n.t('Il tuo patrimonio ha raggiunto {{amount}}, il livello più alto di sempre.', {
          amount: formatEur(latest.net_worth),
        }),
        value: latest.net_worth,
      },
    ];
  }
  return [];
}

/**
 * Flag a positive saving month: the current month's net (income − expense) is
 * at least SAVING_FACTOR × the average monthly net over the past 12 months.
 */
function detectSavingMonth(transactions: Transaction[], referenceDate: Date): Insight[] {
  const windowStart = subMonths(referenceDate, 12);
  const currentMonthKey = monthKey(referenceDate);

  let currentNet = 0;
  const monthlyNet: number[] = [];
  const netByMonth = new Map<string, number>();

  for (const t of transactions) {
    const d = parseLocalDate(t.date);
    if (d < windowStart) continue;
    const mk = monthKey(d);
    const signed = t.type === 'income' ? Number(t.amount) : -Number(t.amount);
    if (mk === currentMonthKey) {
      currentNet += signed;
    } else {
      netByMonth.set(mk, (netByMonth.get(mk) ?? 0) + signed);
    }
  }
  for (const v of netByMonth.values()) monthlyNet.push(v);
  if (monthlyNet.length === 0) return [];
  const avgMonthly = monthlyNet.reduce((a, b) => a + b, 0) / monthlyNet.length;
  if (avgMonthly <= 0) return [];
  if (currentNet >= avgMonthly * SAVING_FACTOR && currentNet > 0) {
    const pct = Math.round(((currentNet - avgMonthly) / avgMonthly) * 100);
    return [
      {
        id: 'saving_month',
        kind: 'saving_month',
        severity: 'positive',
        title: i18n.t('Ottimo mese di risparmio! 💪'),
        message: i18n.t('Stai risparmiando {{amount}} questo mese, +{{pct}}% rispetto alla media annua ({{average}}).', {
          amount: formatEur(currentNet),
          pct,
          average: formatEur(avgMonthly),
        }),
        value: currentNet,
      },
    ];
  }
  return [];
}

/**
 * Flag categories whose 3-month median spend grew by at least TREND_FACTOR
 * compared to their 12-month median (emerging cost areas).
 */
function detectCategoryTrend(
  transactions: Transaction[],
  categoryName: Map<string, string>,
  referenceDate: Date
): Insight[] {
  const windowStart = subMonths(referenceDate, 12);
  const recentStart = subMonths(referenceDate, 3);
  const recentMonthKey = monthKey(referenceDate);

  const totals12 = new Map<string, number[]>();
  const totals3 = new Map<string, number[]>();

  for (const t of transactions) {
    if (t.type !== 'expense' || !t.category_id) continue;
    const d = parseLocalDate(t.date);
    if (d < windowStart) continue;
    const mk = monthKey(d);
    const amount = Number(t.amount);
    if (mk === recentMonthKey) continue; // exclude current (incomplete) month
    pushToMap(totals12, t.category_id, amount);
    if (d >= recentStart) pushToMap(totals3, t.category_id, amount);
  }

  const insights: Insight[] = [];
  for (const [catId, recent] of totals3) {
    if (recent.length < 2) continue;
    const baseline = totals12.get(catId);
    if (!baseline || baseline.length === 0) continue;
    const median3 = calculateMedian(recent);
    const median12 = calculateMedian(baseline);
    if (median12 <= 0 || median3 < ANOMALY_MIN_AMOUNT) continue;
    if (median3 >= median12 * TREND_FACTOR) {
      const name = categoryName.get(catId) ?? i18n.t('Senza categoria');
      const pct = Math.round(((median3 - median12) / median12) * 100);
      insights.push({
        id: `category_trend:${catId}`,
        kind: 'category_trend',
        severity: 'info',
        title: i18n.t('{{name}} in trend crescente', { name }),
        message: i18n.t('La spesa mensile in {{name}} è cresciuta del {{pct}}% negli ultimi 3 mesi ({{recent}} vs {{baseline}}).', {
          name,
          pct,
          recent: formatEur(median3),
          baseline: formatEur(median12),
        }),
        value: median3 - median12,
        category: name,
      });
    }
  }
  return insights;
}

/**
 * Surface the top recurring-expense candidates detected from transaction
 * history (already filtered by the hook to remove tracked/dismissed).
 */
function detectNewRecurring(candidates: RecurringCandidate[]): Insight[] {
  const top = [...candidates]
    .sort((a, b) => {
      if (a.confidence !== b.confidence) return a.confidence === 'high' ? -1 : 1;
      return b.occurrenceCount - a.occurrenceCount;
    })
    .slice(0, 3);

  return top.map((c) => ({
    id: `new_recurring_detected:${c.normalizedKey}`,
    kind: 'new_recurring_detected',
    severity: 'info',
    title: i18n.t('Possibile spesa ricorrente: {{description}}', { description: c.description }),
    message: i18n.t('Rilevata {{frequency}} di {{amount}} ({{num}} occorrenze). Vuoi tenerla tracciata?', {
      frequency: frequencyLabel(c.frequency),
      amount: formatEur(c.medianAmount),
      num: c.occurrenceCount,
    }),
    value: c.medianAmount,
  }));
}

/**
 * For each recurring candidate, check whether the most recent transaction's
 * amount deviates from the group median by at least RECURRING_PRICE_CHANGE
 * (e.g. a subscription price hike).
 */
function detectRecurringPriceChange(
  transactions: Transaction[],
  candidates: RecurringCandidate[]
): Insight[] {
  if (candidates.length === 0) return [];
  const candidateKeys = new Set(candidates.map((c) => c.normalizedKey));

  // Latest amount per normalized key.
  const latestByKey = new Map<string, { amount: number; date: string }>();
  for (const t of transactions) {
    if (t.type !== 'expense') continue;
    const key = normalizeDescription(t.description);
    if (!candidateKeys.has(key)) continue;
    const prev = latestByKey.get(key);
    if (!prev || t.date > prev.date) {
      latestByKey.set(key, { amount: Number(t.amount), date: t.date });
    }
  }

  const insights: Insight[] = [];
  for (const c of candidates) {
    const latest = latestByKey.get(c.normalizedKey);
    if (!latest || c.medianAmount <= 0) continue;
    const change = (latest.amount - c.medianAmount) / c.medianAmount;
    if (Math.abs(change) >= RECURRING_PRICE_CHANGE) {
      const pct = Math.round(change * 100);
      const dir = change > 0 ? i18n.t('aumentato') : i18n.t('diminuito');
      const severity = change > 0 ? 'warning' : 'info';
      insights.push({
        id: `recurring_price_change:${c.normalizedKey}`,
        kind: 'recurring_price_change',
        severity,
        title: i18n.t('Spesa ricorrente {{dir}}: {{description}}', { dir, description: c.description }),
        message: i18n.t("L'ultimo importo ({{latest}}) è {{pct}}% rispetto al solito ({{median}}).", {
          latest: formatEur(latest.amount),
          pct,
          median: formatEur(c.medianAmount),
        }),
        value: latest.amount - c.medianAmount,
      });
    }
  }
  return insights;
}

// --- Sorting ----------------------------------------------------------------

const SEVERITY_RANK: Record<InsightSeverity, number> = {
  warning: 0,
  positive: 1,
  info: 2,
};

function compareInsights(a: Insight, b: Insight): number {
  const sev = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
  if (sev !== 0) return sev;
  return Math.abs(b.value ?? 0) - Math.abs(a.value ?? 0);
}

// --- Helpers ----------------------------------------------------------------

function buildCategoryNameMap(categories: Category[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of categories) map.set(c.id, c.name);
  return map;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function subDays(d: Date, days: number): Date {
  const r = new Date(d.getTime());
  r.setDate(r.getDate() - days);
  return r;
}

function subMonths(d: Date, months: number): Date {
  const r = new Date(d.getTime());
  r.setMonth(r.getMonth() - months);
  return r;
}

function pushToMap(map: Map<string, number[]>, key: string, value: number): void {
  if (!map.has(key)) map.set(key, []);
  map.get(key)!.push(value);
}

function frequencyLabel(f: RecurringCandidate['frequency']): string {
  switch (f) {
    case 'weekly':
      return i18n.t('una cadenza settimanale');
    case 'monthly':
      return i18n.t('una cadenza mensile');
    case 'quarterly':
      return i18n.t('una cadenza trimestrale');
    case 'yearly':
      return i18n.t('una cadenza annuale');
  }
}

/** Format a EUR amount the same way the Dashboard does. */
export function formatEur(n: number): string {
  return `${n.toLocaleString('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}€`;
}
