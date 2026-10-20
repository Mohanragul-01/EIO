/**
 * useFinanceSearch - every entry ever, searched as you type, with a total.
 *
 * All-time and client-side: one paged fetch when the screen opens, then the
 * filter runs on each keystroke (summary.searchTransactions). Doing it in
 * Postgres would mean building an `or=(note.ilike…)` filter string out of
 * whatever was typed, and a comma or bracket in a search would change the
 * query's meaning. At personal scale the fetch is the cheaper risk.
 */
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useLatestRun } from '../../core/useLatestRun';
import * as api from './api';
import { onLedgerChange } from './changes';
import { groupByDay, searchTotals, searchTransactions, toListItems } from './summary';
import type { Account, Transaction } from './types';

export function useFinanceSearch() {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { begin } = useLatestRun();

  const load = useCallback(async () => {
    const isCurrent = begin();
    setError(null);
    try {
      const [all, accountRows] = await Promise.all([api.listAllTransactions(), api.listAccounts()]);
      if (!isCurrent()) return;
      setRows(all);
      setAccounts(accountRows);
    } catch (e) {
      if (isCurrent()) setError(e instanceof Error ? e.message : 'Could not load your entries');
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [begin]);

  // Re-read on return, so an entry edited from a result shows its new values.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // And after an Undo from the edit screen, which lands once this screen has
  // already reloaded without the entry (changes.ts).
  useEffect(() => onLedgerChange(() => void load()), [load]);

  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const results = useMemo(() => {
    const items = toListItems(searchTransactions(rows, query, accountsById));
    return { days: groupByDay(items), totals: searchTotals(items) };
  }, [rows, query, accountsById]);

  return {
    query,
    setQuery,
    days: results.days,
    totals: results.totals,
    accountsById,
    loading,
    error,
  };
}
