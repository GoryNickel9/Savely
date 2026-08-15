import { useMemo, useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { useTransactions } from './useTransactions';
import { useRecurringExpenses } from './useRecurringExpenses';
import {
  detectRecurringCandidates,
  type RecurringCandidate,
} from '@/lib/recurringDetection';

const IGNORE_KEY = 'savely:ignored-recurring-candidates';

/** Load the set of candidate keys the user has dismissed (localStorage, per-user). */
function loadIgnored(userId: string | undefined): Set<string> {
  if (!userId || typeof localStorage === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(`${IGNORE_KEY}:${userId}`);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

/** Persist the ignored keys set. */
function saveIgnored(userId: string | undefined, keys: Set<string>): void {
  if (!userId || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(`${IGNORE_KEY}:${userId}`, JSON.stringify([...keys]));
  } catch {
    // ignore quota errors
  }
}

/**
 * Returns recurring-expense candidates detected from the user's transactions,
 * excluding:
 *  - already-tracked recurring expenses (matched by normalized name);
 *  - candidates the user has dismissed (persisted in localStorage per user).
 */
export function useRecurringCandidates(): {
  candidates: RecurringCandidate[];
  ignore: (normalizedKey: string) => void;
  isLoading: boolean;
} {
  const { user } = useAuth();
  const { transactions, isLoading: txLoading } = useTransactions();
  const { recurringExpenses } = useRecurringExpenses();
  const [ignored, setIgnored] = useState<Set<string>>(new Set());

  useEffect(() => {
    setIgnored(loadIgnored(user?.id));
  }, [user?.id]);

  const trackedKeys = useMemo(
    () =>
      new Set(
        recurringExpenses
          .filter((r) => !r.deleted_at)
          .map((r) => normalizeKey(r.name))
      ),
    [recurringExpenses]
  );

  const candidates = useMemo(() => {
    const detected = detectRecurringCandidates(
      transactions.map((t) => ({
        description: t.description ?? null,
        amount: t.amount,
        date: t.date,
        type: t.type,
      }))
    );
    return detected.filter(
      (c) => !trackedKeys.has(c.normalizedKey) && !ignored.has(c.normalizedKey)
    );
  }, [transactions, trackedKeys, ignored]);

  const ignore = (normalizedKey: string) => {
    setIgnored((prev) => {
      const next = new Set(prev);
      next.add(normalizedKey);
      saveIgnored(user?.id, next);
      return next;
    });
  };

  return { candidates, ignore, isLoading: txLoading };
}

// Mirror of normalizeDescription from the lib, kept locally to avoid importing
// the whole module into the hook (it's the only helper we need here).
function normalizeKey(name: string): string {
  if (!name) return '';
  let s = name.toLowerCase().trim();
  s = s.replace(/\s+/g, ' ');
  s = s.replace(/\b\d{4,}\b/g, '').trim();
  s = s.replace(/^(pagamento|payment|acquisto|purchase|addebito|charge)\s+/i, '');
  return s.trim();
}
