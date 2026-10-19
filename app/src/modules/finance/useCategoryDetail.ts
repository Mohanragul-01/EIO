/**
 * useCategoryDetail - one category in one finance month, and its last six.
 *
 * Reached by tapping a budget bar or a category in "Where it went": the two
 * questions after "how much on Food" are "on what" (this month's entries) and
 * "is that normal" (the six-month history, against the limit if there is one).
 */
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';

import { todayISO } from '../../core/date';
import { useLatestRun } from '../../core/useLatestRun';
import * as api from './api';
import { budgetHistory, budgetStatus } from './budget';
import { normalizeStartDay, periodBounds, periodProgress, recentPeriods, type Period } from './period';
import { groupByDay, summarize, toListItems } from './summary';
import type { Account, Budget, LedgerPoint, Transaction } from './types';

export function useCategoryDetail(category: string, period: Period) {
  const [startDay, setStartDay] = useState(1);
  const [rows, setRows] = useState<Transaction[]>([]);
  const [points, setPoints] = useState<LedgerPoint[]>([]);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [today, setToday] = useState(todayISO);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { begin } = useLatestRun();

  const { year, month } = period;

  const load = useCallback(async () => {
    const isCurrent = begin();
    setError(null);
    try {
      const settings = await api.getSettings();
      const day = normalizeStartDay(settings.month_start_day);
      const [categoryRows, allPoints, budgets, accountRows] = await Promise.all([
        api.listTransactionsBetween(periodBounds({ year, month }, day), { category }),
        api.listLedgerPoints(),
        api.listBudgets(),
        api.listAccounts(),
      ]);
      if (!isCurrent()) return;
      setToday(todayISO());
      setStartDay(day);
      setRows(categoryRows);
      setPoints(allPoints);
      setBudget(budgets.find((b) => b.category === category) ?? null);
      setAccounts(accountRows);
    } catch (e) {
      if (isCurrent()) setError(e instanceof Error ? e.message : 'Could not load this category');
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [begin, category, year, month]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const range = periodBounds({ year, month }, startDay);
  const spentMinor = useMemo(() => summarize(rows).spentMinor, [rows]);
  const days = useMemo(() => groupByDay(toListItems(rows)), [rows]);

  const history = useMemo(
    () => budgetHistory(points, category, recentPeriods({ year, month }, 6), startDay),
    [points, category, year, month, startDay],
  );

  const status = budget
    ? budgetStatus({
        limitMinor: budget.amount_minor,
        spentMinor,
        progress: periodProgress(range, today),
      })
    : null;

  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  return { range, spentMinor, days, history, budget, status, startDay, accountsById, loading, error };
}
