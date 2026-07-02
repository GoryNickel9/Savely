/**
 * Recurring-expense detection from transaction history.
 *
 * Pure function: groups expenses by a normalized description key, then checks
 * whether the occurrences follow a regular cadence (weekly/monthly/...) with
 * consistent amounts. Returns "suggestions" the user can accept to create
 * recurring_expenses entries.
 *
 * No Supabase calls — fully unit-testable.
 */

export type DetectedFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface RecurringCandidate {
  /** Original description (most recent occurrence's). */
  description: string;
  /** Normalized key used for grouping. */
  normalizedKey: string;
  medianAmount: number;
  frequency: DetectedFrequency;
  lastDate: string; // YYYY-MM-DD
  suggestedNextDueDate: string; // YYYY-MM-DD
  occurrenceCount: number;
  confidence: 'high' | 'medium';
}

/** Minimal transaction shape needed for detection. */
export interface DetectionTransaction {
  description: string | null;
  amount: number | string;
  date: string; // YYYY-MM-DD
  type: 'income' | 'expense';
}

/** Minimum number of occurrences to consider a candidate. */
const MIN_OCCURRENCES = 3;
/** Allowed amount variance: max/min ratio must be ≤ this. */
const AMOUNT_VARIANCE = 1.10;

/**
 * Normalize a description for grouping: lowercase, trim, collapse spaces,
 * strip leading/trailing digits and common merchant noise tokens.
 */
export function normalizeDescription(desc: string | null): string {
  if (!desc) return '';
  let s = desc.toLowerCase().trim();
  // Collapse internal whitespace.
  s = s.replace(/\s+/g, ' ');
  // Strip standalone reference numbers and trailing dates.
  s = s.replace(/\b\d{4,}\b/g, '').trim();
  // Strip common payment prefixes.
  s = s.replace(/^(pagamento|payment|acquisto|purchase|addebito|charge)\s+/i, '');
  return s.trim();
}

interface FrequencyMatch {
  frequency: DetectedFrequency;
  /** Expected interval in days. */
  expectedDays: number;
  /** Tolerance in days. */
  tolerance: number;
}

const FREQUENCY_MATCHERS: FrequencyMatch[] = [
  { frequency: 'weekly', expectedDays: 7, tolerance: 2 },
  { frequency: 'monthly', expectedDays: 30, tolerance: 4 },
  { frequency: 'quarterly', expectedDays: 90, tolerance: 10 },
  { frequency: 'yearly', expectedDays: 365, tolerance: 20 },
];

/**
 * Given the gaps (in days) between consecutive occurrences, find the matching
 * cadence. Returns null if no cadence fits within tolerance.
 */
export function matchFrequency(gaps: number[]): FrequencyMatch | null {
  if (gaps.length === 0) return null;
  const meanGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;

  for (const m of FREQUENCY_MATCHERS) {
    if (Math.abs(meanGap - m.expectedDays) <= m.tolerance) {
      return m;
    }
  }
  return null;
}

/**
 * Detect recurring-expense candidates from a list of transactions.
 *
 * Algorithm:
 *  1. Keep only expenses with a description.
 *  2. Group by normalized description.
 *  3. For groups with ≥ MIN_OCCURRENCES occurrences:
 *     - check amount consistency (max/min ≤ AMOUNT_VARIANCE);
 *     - compute day-gaps between consecutive occurrences;
 *     - match a cadence via matchFrequency();
 *     - compute the suggested next due date from the last occurrence.
 */
export function detectRecurringCandidates(
  transactions: DetectionTransaction[]
): RecurringCandidate[] {
  // Filter expenses with descriptions.
  const expenses = transactions.filter(
    (t) => t.type === 'expense' && t.description && t.description.trim()
  );

  // Group by normalized key.
  const groups = new Map<string, DetectionTransaction[]>();
  for (const t of expenses) {
    const key = normalizeDescription(t.description);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  const candidates: RecurringCandidate[] = [];

  for (const [key, group] of groups) {
    if (group.length < MIN_OCCURRENCES) continue;

    // Sort by date ascending.
    group.sort((a, b) => a.date.localeCompare(b.date));

    const amounts = group.map((t) => Number(t.amount));
    const minAmt = Math.min(...amounts);
    const maxAmt = Math.max(...amounts);
    if (minAmt <= 0 || maxAmt / minAmt > AMOUNT_VARIANCE) continue;

    // Compute day-gaps between consecutive occurrences.
    const dates = group.map((t) => new Date(t.date + 'T00:00:00Z').getTime());
    const gaps: number[] = [];
    for (let i = 1; i < dates.length; i++) {
      gaps.push((dates[i] - dates[i - 1]) / (24 * 60 * 60 * 1000));
    }

    const match = matchFrequency(gaps);
    if (!match) continue;

    const lastDate = group[group.length - 1].date;
    const lastDateMs = dates[dates.length - 1];
    const suggestedNextMs = lastDateMs + match.expectedDays * 24 * 60 * 60 * 1000;
    const suggestedNextDueDate = new Date(suggestedNextMs).toISOString().slice(0, 10);

    const medianAmount = median(amounts);
    const confidence: RecurringCandidate['confidence'] =
      group.length >= 4 && maxAmt / minAmt <= 1.001 ? 'high' : 'medium';

    candidates.push({
      description: group[group.length - 1].description!,
      normalizedKey: key,
      medianAmount: Math.round(medianAmount * 100) / 100,
      frequency: match.frequency,
      lastDate,
      suggestedNextDueDate,
      occurrenceCount: group.length,
      confidence,
    });
  }

  // Highest confidence and most occurrences first.
  candidates.sort((a, b) => {
    if (a.confidence !== b.confidence) return a.confidence === 'high' ? -1 : 1;
    return b.occurrenceCount - a.occurrenceCount;
  });

  return candidates;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}
