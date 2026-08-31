/**
 * useTransactions - data + monthly summary for the Finance screen.
 *
 * Two new responsibilities compared with the earlier hooks:
 *   1. it owns the SELECTED MONTH, and refetches when it changes,
 *   2. it derives the summary (totals, per-category breakdown) from the rows.
 *
 * The summary lives here, not in the screen, for the same reason the search
 * filter lived in useNotes: it's derived data. The screen's job is to render
 * what it's handed, not to compute it.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useStableCallback } from '../../core/useStableCallback';

import { categoryDef } from '../../core/categories';
import { sumMinor } from '../../core/money';
import { monthlyTotals, runningBalance, type MonthTotal } from './analytics';
import * as api from './api';
import type { LedgerPoint, Transaction } from './types';

export type CategoryTotal = {
  key: string;
  label: string;
  color: string;
  icon: string;
  totalMinor: number;
  /** 0-1, this category's share of the month's spending. Drives the bar width. */
  share: number;
  count: number;
};

export function useTransactions() {
  // Default to the current month. Stored as separate year/month numbers
  // rather than a Date, because that's what the query needs and it avoids
  // any timezone question entirely.
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // getMonth() is 0-based

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  // Every transaction ever, in three columns. Feeds the running balance and
  // the trend, neither of which is scoped to the selected month.
  const [ledger, setLedger] = useState<LedgerPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setRefreshing(true);
      setError(null);

      try {
        // In parallel: the month view and the all-time figures are independent
        // queries, and running them in series would double the wait.
        const [rows, points] = await Promise.all([
          api.listTransactions(year, month),
          api.listLedgerPoints(),
        ]);
        if (mounted.current) {
          setTransactions(rows);
          setLedger(points);
        }
      } catch (e) {
        if (mounted.current) setError(e instanceof Error ? e.message : 'Something went wrong');
      } finally {
        if (mounted.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    // Depends on year/month, so changing the month produces a new `load` and
    // the effect below refetches automatically.
    [year, month],
  );

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  /** Move one month back or forward, rolling the year over at the boundary. */
  const stepMonth = useCallback(
    (delta: number) => {
      // Building a Date and reading it back handles the Dec->Jan rollover for
      // us instead of hand-writing the modular arithmetic.
      const d = new Date(year, month - 1 + delta, 1);
      setYear(d.getFullYear());
      setMonth(d.getMonth() + 1);
    },
    [year, month],
  );

  const summary = useMemo(() => {
    const expenses = transactions.filter((t) => t.kind === 'expense');
    const income = transactions.filter((t) => t.kind === 'income');

    const spentMinor = sumMinor(expenses.map((t) => t.amount_minor));
    const earnedMinor = sumMinor(income.map((t) => t.amount_minor));

    // Group expenses by category. A Map preserves insertion order and avoids
    // the prototype-key pitfalls of using a bare object as a dictionary.
    const byCategory = new Map<string, { totalMinor: number; count: number }>();
    expenses.forEach((t) => {
      const current = byCategory.get(t.category) ?? { totalMinor: 0, count: 0 };
      byCategory.set(t.category, {
        totalMinor: current.totalMinor + t.amount_minor,
        count: current.count + 1,
      });
    });

    const categoryTotals: CategoryTotal[] = Array.from(byCategory.entries())
      .map(([key, value]) => {
        const def = categoryDef(key);
        return {
          key,
          label: def.label,
          color: def.color,
          icon: def.icon,
          totalMinor: value.totalMinor,
          // Guard the divide: a month with no spending would give 0/0 = NaN,
          // and NaN in a style width silently breaks the layout.
          share: spentMinor > 0 ? value.totalMinor / spentMinor : 0,
          count: value.count,
        };
      })
      .sort((a, b) => b.totalMinor - a.totalMinor); // biggest spend first

    return {
      spentMinor,
      earnedMinor,
      netMinor: earnedMinor - spentMinor,
      categoryTotals,
    };
  }, [transactions]);

  /**
   * The all-time figures. Separate useMemo from the month summary because they
   * depend on a different query: recomputing the trend every time you step a
   * month would be wasted work, since the ledger has not changed.
   */
  const balanceMinor = useMemo(() => runningBalance(ledger), [ledger]);
  const trendMonths = useMemo<MonthTotal[]>(() => monthlyTotals(ledger, 6), [ledger]);

  const remove = useCallback(
    async (transaction: Transaction) => {
      const snapshot = transactions;
      setTransactions((current) => current.filter((t) => t.id !== transaction.id));

      try {
        await api.deleteTransaction(transaction.id);
      } catch (e) {
        setTransactions(snapshot);
        setError(e instanceof Error ? e.message : 'Could not delete');
      }
    },
    [transactions],
  );


  /**
   * Stable identities that always reach the CURRENT load closure. The focus
   * effect in each screen holds one of these forever, so it must not close over
   * a stale copy. See core/useStableCallback for the bug this prevents.
   */
  const refresh = useStableCallback(() => load(true));
  const reload = useStableCallback(() => load(false));

  return {
    transactions,
    summary,
    /** Income minus expense across every transaction, not just this month. */
    balanceMinor,
    trendMonths,
    year,
    month,
    stepMonth,
    /** True when viewing the current real-world month - disables "next". */
    isCurrentMonth: year === now.getFullYear() && month === now.getMonth() + 1,
    loading,
    refreshing,
    error,
    refresh,
    reload,
    remove,
  };
}
