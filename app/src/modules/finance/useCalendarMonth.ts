/**
 * useCalendarMonth - one calendar month of entries, for the Calendar tab.
 *
 * A calendar month, not a finance month: the grid is a calendar and pages by
 * calendar month, so with a salary-day start its total can differ from the
 * Month tab's. The footer says which days it covers so the two never look
 * like they disagree by mistake.
 */
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { monthBounds, todayISO } from '../../core/date';
import { useLatestRun } from '../../core/useLatestRun';
import * as api from './api';
import { onLedgerChange } from './changes';
import { dayTotals, spendLevels, summarize, toListItems } from './summary';
import type { Transaction } from './types';

export function useCalendarMonth() {
  const [view, setView] = useState(() => {
    const today = todayISO();
    return { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) };
  });
  const [rows, setRows] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { begin } = useLatestRun();

  const load = useCallback(async () => {
    const isCurrent = begin();
    setError(null);
    try {
      const next = await api.listTransactions(view.year, view.month);
      if (isCurrent()) setRows(next);
    } catch (e) {
      if (isCurrent()) setError(e instanceof Error ? e.message : 'Could not load this month');
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [view.year, view.month, begin]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => onLedgerChange(() => void load()), [load]);

  const totals = useMemo(() => dayTotals(rows), [rows]);
  const levels = useMemo(() => spendLevels(totals), [totals]);
  const summary = useMemo(() => summarize(rows), [rows]);

  const itemsOn = useCallback(
    (date: string) => toListItems(rows.filter((row) => row.date === date)),
    [rows],
  );

  const changeMonth = useCallback((year: number, month: number) => setView({ year, month }), []);

  return {
    year: view.year,
    month: view.month,
    bounds: monthBounds(view.year, view.month),
    changeMonth,
    totals,
    levels,
    summary,
    itemsOn,
    loading,
    error,
    reload: load,
  };
}
