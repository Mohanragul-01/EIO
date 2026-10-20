/**
 * useFinance - data and figures for the Finance screen's Month and Budgets tabs.
 *
 * It owns the SELECTED PERIOD, as an offset from the current one (0 = this
 * month, -1 = last month). An offset rather than a (year, month) because what
 * "this month" is depends on the month-start setting, which arrives with the
 * data: the offset means the same thing before and after it loads.
 *
 * Everything shown is derived here from five loads - the period's rows, every
 * row in six narrow columns (balances, trend, last month), accounts, budgets
 * and quick-adds - using the pure functions in summary.ts, budget.ts,
 * accounts.ts and period.ts. The screen renders what it is handed.
 */
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { categoryDef } from '../../core/categories';
import { fromISODate, todayISO } from '../../core/date';
import { useLatestRun } from '../../core/useLatestRun';
import { useStableCallback } from '../../core/useStableCallback';
import { activeAccounts, summarizeAccounts } from './accounts';
import { monthlyTotals } from './analytics';
import * as api from './api';
import { budgetStatus, type BudgetStatus } from './budget';
import { ledgerChanged, onLedgerChange } from './changes';
import { lastUsed } from './defaults';
import {
  normalizeStartDay,
  periodBounds,
  periodOf,
  periodProgress,
  rangeContains,
  shiftPeriod,
  type DateRange,
} from './period';
import {
  compareToPrevious,
  groupByDay,
  summarize,
  toListItems,
  type Delta,
  type ListItem,
} from './summary';
import type {
  Account,
  Budget,
  FinanceSettings,
  LedgerPoint,
  QuickAdd,
  QuickAddInput,
  Transaction,
} from './types';

export type BudgetRow = {
  budget: Budget;
  label: string;
  icon: string;
  color: string;
  status: BudgetStatus;
};

/** Worst first, so the budget that needs you is at the top. */
const STATE_ORDER = { over: 0, over_pace: 1, under: 2 } as const;

function toPoint(row: Transaction): LedgerPoint {
  return {
    date: row.date,
    kind: row.kind,
    amount_minor: row.amount_minor,
    category: row.category,
    account_id: row.account_id,
    transfer_direction: row.transfer_direction,
  };
}

/** The days of the finance month `offset` months from the one holding `today`. */
function rangeAt(today: string, startDay: number, offset: number): DateRange {
  return periodBounds(shiftPeriod(periodOf(today, startDay), offset), startDay);
}

/** The selected period's rows, and the days they were fetched for. */
type PeriodRows = { range: DateRange; rows: Transaction[] };

/** One empty list for every render with no rows to show, so memos hold. */
const NO_ROWS: Transaction[] = [];

export function useFinance() {
  const [offset, setOffset] = useState(0);
  // What loads read: a step starts its load in the same handler that sets the
  // offset, before React has rendered the new state.
  const offsetRef = useRef(0);
  // State rather than read during render, so the date every figure hangs off
  // is a value React knows about; each load moves it on, so a screen left open
  // past midnight catches up the next time it loads.
  const [today, setToday] = useState(todayISO);
  // The ref is what loads read (a load must not wait a render to learn the
  // setting it just fetched); the state is what renders.
  const startDayRef = useRef<number | null>(null);
  const [startDay, setStartDay] = useState(1);

  const [periodRows, setPeriodRows] = useState<PeriodRows | null>(null);
  const [points, setPoints] = useState<LedgerPoint[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [quickAdds, setQuickAdds] = useState<QuickAdd[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { begin, isMounted } = useLatestRun();
  const { begin: beginRows } = useLatestRun();

  /**
   * Everything, or ('period') only the selected period's rows.
   *
   * A step changes nothing but the period's rows: the balances, the trend and
   * last month's figures come from every row, which are the same in any
   * month. So a step fetches one month, not the whole ledger again.
   */
  const load = useCallback(
    async (mode: 'initial' | 'refresh' | 'silent' | 'period' = 'initial') => {
      const periodOnly = mode === 'period';
      // Stepping months twice quickly leaves two loads in flight; a ticket
      // makes the newest the only one allowed to write. The rows have their
      // own, since a step reloads only them: a focus load still in flight
      // must not then write the month you stepped away from.
      const isCurrentRows = beginRows();
      const isCurrent = periodOnly ? isCurrentRows : begin();
      if (mode === 'refresh') setRefreshing(true);
      if (mode === 'initial') setLoading(true);
      setError(null);

      try {
        const now = todayISO();
        const at = offsetRef.current;
        // The first load has to know the month start before it can ask for a
        // month. Every later one reuses the last answer and checks it in
        // parallel with everything else.
        let day = startDayRef.current;
        let check: Promise<FinanceSettings>;
        if (day === null) {
          const settings = await api.getSettings();
          day = normalizeStartDay(settings.month_start_day);
          check = Promise.resolve(settings);
        } else {
          check = api.getSettings();
        }

        const [fetchedRows, settings, rest] = await Promise.all([
          api.listTransactionsBetween(rangeAt(now, day, at)),
          check,
          periodOnly
            ? null
            : Promise.all([
                api.listLedgerPoints(),
                api.listAccounts(),
                api.listBudgets(),
                api.listQuickAdds(),
              ]),
        ]);

        // Changed on the website since the last load: the month just fetched
        // covers the wrong days, so fetch the right ones before showing any.
        const fresh = normalizeStartDay(settings.month_start_day);
        const range = rangeAt(now, fresh, at);
        const rows = fresh === day ? fetchedRows : await api.listTransactionsBetween(range);

        if (!isCurrent()) return;
        setToday(now);
        startDayRef.current = fresh;
        setStartDay(fresh);
        if (isCurrentRows()) setPeriodRows({ range, rows });
        if (rest) {
          const [allPoints, accountRows, budgetRows, quickAddRows] = rest;
          setPoints(allPoints);
          setAccounts(accountRows);
          setBudgets(budgetRows);
          setQuickAdds(quickAddRows);
        }
      } catch (e) {
        if (isCurrent()) setError(e instanceof Error ? e.message : 'Something went wrong');
      } finally {
        // A step has no spinner of its own: the period not being ready is it.
        if (isCurrent() && !periodOnly) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [begin, beginRows],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const refresh = useStableCallback(() => load('refresh'));
  /** Re-read everything without a spinner: after a write, so balances catch up. */
  const reloadSilently = useStableCallback(() => load('silent'));

  // An Undo from another screen put rows back while this one was not looking.
  useEffect(() => onLedgerChange(() => void reloadSilently()), [reloadSilently]);

  // DERIVED -------------------------------------------------------------------

  const period = shiftPeriod(periodOf(today, startDay), offset);
  const range = rangeAt(today, startDay, offset);
  const previousPeriod = shiftPeriod(period, -1);

  // The rows on hand belong to the period on screen only once its load has
  // landed. Until then they are the month you stepped away from (or the old
  // month start's), and every figure drawn from them - Spent, the bars, the
  // entries, the budgets - would sit under the wrong title.
  const periodReady =
    periodRows !== null &&
    periodRows.range.start === range.start &&
    periodRows.range.end === range.end;
  const rows = periodReady ? periodRows.rows : NO_ROWS;

  const summary = useMemo(() => summarize(rows), [rows]);

  const previous = useMemo(() => {
    const before = rangeAt(today, startDay, offset - 1);
    return summarize(points.filter((p) => rangeContains(before, p.date)));
  }, [points, today, startDay, offset]);

  const deltas = useMemo(() => {
    const prevByCategory = new Map(previous.categoryTotals.map((c) => [c.key, c.totalMinor]));
    const byCategory = new Map<string, Delta | null>();
    summary.categoryTotals.forEach((c) => {
      byCategory.set(c.key, compareToPrevious(c.totalMinor, prevByCategory.get(c.key) ?? 0));
    });
    return {
      spent: compareToPrevious(summary.spentMinor, previous.spentMinor),
      earned: compareToPrevious(summary.earnedMinor, previous.earnedMinor),
      byCategory,
    };
  }, [summary, previous]);

  const days = useMemo(() => groupByDay(toListItems(rows)), [rows]);

  const accountsSummary = useMemo(() => summarizeAccounts(accounts, points), [accounts, points]);
  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const trend = useMemo(
    () => monthlyTotals(points, 6, fromISODate(today), startDay),
    [points, today, startDay],
  );

  const progress = periodProgress(range, today);

  const budgetRows = useMemo<BudgetRow[]>(() => {
    const spentBy = new Map(summary.categoryTotals.map((c) => [c.key, c.totalMinor]));
    const pace = periodProgress(rangeAt(today, startDay, offset), today);
    return budgets
      .map((budget) => {
        const def = categoryDef(budget.category);
        return {
          budget,
          label: def.label,
          icon: def.icon,
          color: def.color,
          status: budgetStatus({
            limitMinor: budget.amount_minor,
            spentMinor: spentBy.get(budget.category) ?? 0,
            progress: pace,
          }),
        };
      })
      .sort(
        (a, b) =>
          STATE_ORDER[a.status.state] - STATE_ORDER[b.status.state] ||
          b.status.fillShare - a.status.fillShare,
      );
  }, [budgets, summary, today, startDay, offset]);

  const budgetTotals = useMemo(() => {
    const limitMinor = budgetRows.reduce((sum, b) => sum + b.status.limitMinor, 0);
    const budgetedSpent = budgetRows.reduce((sum, b) => sum + b.status.spentMinor, 0);
    return {
      limitMinor,
      budgetedSpentMinor: budgetedSpent,
      unbudgetedMinor: summary.spentMinor - budgetedSpent,
      overCount: budgetRows.filter((b) => b.status.state === 'over').length,
    };
  }, [budgetRows, summary.spentMinor]);

  /** Your biggest unbudgeted categories this month, for the empty Budgets tab. */
  const budgetSuggestions = useMemo(() => {
    const budgeted = new Set(budgets.map((b) => b.category));
    return summary.categoryTotals.filter((c) => !budgeted.has(c.key)).slice(0, 3);
  }, [budgets, summary]);

  // ACTIONS -------------------------------------------------------------------

  /** Show the period `next` months from this one, and fetch only its rows. */
  const showOffset = useCallback(
    (next: number) => {
      if (next === offsetRef.current) return;
      offsetRef.current = next;
      setOffset(next);
      void load('period');
    },
    [load],
  );
  // Never into the future: there is nothing there to look at.
  const stepPeriod = useCallback(
    (delta: number) => showOffset(Math.min(0, offsetRef.current + delta)),
    [showOffset],
  );
  const goToCurrent = useCallback(() => showOffset(0), [showOffset]);

  /** Optimistically take rows off the list; only these rows come back on failure. */
  const removeRowsLocally = useCallback((gone: Transaction[]) => {
    const ids = new Set(gone.map((r) => r.id));
    setPeriodRows((held) => held && { ...held, rows: held.rows.filter((r) => !ids.has(r.id)) });
  }, []);

  /**
   * Rows into the list, if they are dated inside the days it holds: a
   * transfer's other half, or today's entry while another month is on
   * screen (or on its way), belongs to another list.
   */
  const putRowsBack = useCallback((back: Transaction[]) => {
    setPeriodRows((held) => {
      if (!held) return held;
      const present = new Set(held.rows.map((r) => r.id));
      const missing = back.filter((r) => !present.has(r.id) && rangeContains(held.range, r.date));
      if (missing.length === 0) return held;
      // Newest date first, newest entered first, as the query orders them.
      const rows = [...held.rows, ...missing].sort(
        (a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at),
      );
      return { ...held, rows };
    });
  }, []);

  /**
   * One tap on a pinned quick-add: today's entry, straight into the list. The
   * screen shows the Undo toast with the row this returns.
   */
  const logQuickAdd = useCallback(
    async (quickAdd: QuickAdd): Promise<Transaction | null> => {
      const accountId =
        quickAdd.account_id ??
        lastUsed(rows, quickAdd.kind).accountId ??
        activeAccounts(accounts)[0]?.id ??
        null;
      try {
        const created = await api.createTransaction({
          amount_minor: quickAdd.amount_minor,
          kind: quickAdd.kind,
          category: quickAdd.category,
          note: quickAdd.note,
          date: todayISO(),
          account_id: accountId,
        });
        if (!isMounted()) return created;
        putRowsBack([created]);
        setPoints((list) => [...list, toPoint(created)]);
        ledgerChanged();
        return created;
      } catch (e) {
        if (isMounted()) setError(e instanceof Error ? e.message : 'Could not log that');
        return null;
      }
    },
    [rows, accounts, isMounted, putRowsBack],
  );

  /** Copy an entry to today ("Log again today"). */
  const logAgainToday = useCallback(
    async (tx: Transaction): Promise<Transaction | null> => {
      if (tx.kind === 'transfer') return null;
      try {
        const created = await api.createTransaction({
          amount_minor: tx.amount_minor,
          kind: tx.kind,
          category: tx.category,
          note: tx.note,
          date: todayISO(),
          account_id: tx.account_id,
        });
        if (!isMounted()) return created;
        putRowsBack([created]);
        ledgerChanged();
        return created;
      } catch (e) {
        if (isMounted()) setError(e instanceof Error ? e.message : 'Could not log that');
        return null;
      }
    },
    [isMounted, putRowsBack],
  );

  /**
   * Delete an entry or a whole transfer. Returns the rows removed, for Undo;
   * null if the delete failed (and the rows are back).
   */
  const deleteItem = useCallback(
    async (item: ListItem): Promise<Transaction[] | null> => {
      const gone = item.type === 'entry' ? [item.tx] : item.rows;
      removeRowsLocally(gone);
      try {
        if (item.type === 'entry') await api.deleteTransaction(item.tx.id);
        else await api.deleteTransfer(item.groupId);
        ledgerChanged();
        return gone;
      } catch (e) {
        if (isMounted()) {
          putRowsBack(gone);
          setError(e instanceof Error ? e.message : 'Could not delete that');
        }
        return null;
      }
    },
    [removeRowsLocally, putRowsBack, isMounted],
  );

  /** Undo: the same rows back, ids and all. */
  const restoreRows = useCallback(
    async (back: Transaction[]) => {
      try {
        await api.restoreTransactions(back);
        if (!isMounted()) return;
        putRowsBack(back);
        ledgerChanged();
      } catch (e) {
        if (isMounted()) setError(e instanceof Error ? e.message : 'Could not undo that');
      }
    },
    [isMounted, putRowsBack],
  );

  // Budgets.

  const saveBudget = useCallback(async (category: string, amountMinor: number) => {
    const saved = await api.saveBudget(category, amountMinor);
    if (!isMounted()) return;
    setBudgets((list) => [...list.filter((b) => b.category !== category), saved]);
  }, [isMounted]);

  const deleteBudget = useCallback(
    async (budget: Budget): Promise<boolean> => {
      setBudgets((list) => list.filter((b) => b.id !== budget.id));
      try {
        await api.deleteBudget(budget.id);
        return true;
      } catch (e) {
        if (isMounted()) {
          setBudgets((list) => (list.some((b) => b.id === budget.id) ? list : [...list, budget]));
          setError(e instanceof Error ? e.message : 'Could not remove that budget');
        }
        return false;
      }
    },
    [isMounted],
  );

  const restoreBudget = useCallback(
    async (budget: Budget) => {
      try {
        await api.restoreBudget(budget);
        if (isMounted()) {
          setBudgets((list) => [...list.filter((b) => b.category !== budget.category), budget]);
        }
      } catch (e) {
        if (isMounted()) setError(e instanceof Error ? e.message : 'Could not undo that');
      }
    },
    [isMounted],
  );

  // Quick-adds.

  const createQuickAdd = useCallback(
    async (input: QuickAddInput) => {
      const position = quickAdds.reduce((max, q) => Math.max(max, q.position), -1) + 1;
      const created = await api.createQuickAdd(input, position);
      if (isMounted()) setQuickAdds((list) => [...list, created]);
    },
    [quickAdds, isMounted],
  );

  const updateQuickAdd = useCallback(
    async (id: string, patch: Partial<QuickAddInput>) => {
      const saved = await api.updateQuickAdd(id, patch);
      if (isMounted()) setQuickAdds((list) => list.map((q) => (q.id === id ? saved : q)));
    },
    [isMounted],
  );

  const deleteQuickAdd = useCallback(
    async (quickAdd: QuickAdd): Promise<boolean> => {
      setQuickAdds((list) => list.filter((q) => q.id !== quickAdd.id));
      try {
        await api.deleteQuickAdd(quickAdd.id);
        return true;
      } catch (e) {
        if (isMounted()) {
          setQuickAdds((list) =>
            list.some((q) => q.id === quickAdd.id)
              ? list
              : [...list, quickAdd].sort((a, b) => a.position - b.position),
          );
          setError(e instanceof Error ? e.message : 'Could not unpin that');
        }
        return false;
      }
    },
    [isMounted],
  );

  const restoreQuickAdd = useCallback(
    async (quickAdd: QuickAdd) => {
      try {
        await api.restoreQuickAdd(quickAdd);
        if (isMounted()) {
          setQuickAdds((list) => [...list, quickAdd].sort((a, b) => a.position - b.position));
        }
      } catch (e) {
        if (isMounted()) setError(e instanceof Error ? e.message : 'Could not undo that');
      }
    },
    [isMounted],
  );

  // Settings.

  const setMonthStart = useCallback(
    async (day: number) => {
      await api.saveMonthStartDay(day);
      startDayRef.current = day;
      offsetRef.current = 0;
      setStartDay(day);
      setOffset(0);
      // New days for the period, nothing else: every other figure is all-time.
      void load('period');
    },
    [load],
  );

  return {
    // period
    period,
    previousPeriod,
    range,
    startDay,
    isCurrentPeriod: offset === 0,
    stepPeriod,
    goToCurrent,
    progress,
    // data
    rows,
    points,
    accounts,
    accountsById,
    quickAdds,
    budgets,
    // figures
    summary,
    deltas,
    days,
    accountsSummary,
    trend,
    budgetRows,
    budgetTotals,
    budgetSuggestions,
    // status
    /** False while the period on screen is still loading: draw no figures from it. */
    periodReady,
    loading,
    refreshing,
    error,
    dismissError: () => setError(null),
    refresh,
    reloadSilently,
    // actions
    logQuickAdd,
    logAgainToday,
    deleteItem,
    restoreRows,
    saveBudget,
    deleteBudget,
    restoreBudget,
    createQuickAdd,
    updateQuickAdd,
    deleteQuickAdd,
    restoreQuickAdd,
    setMonthStart,
  };
}

export type FinanceData = ReturnType<typeof useFinance>;
