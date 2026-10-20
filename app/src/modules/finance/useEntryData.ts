/**
 * useEntryData - what the add/edit form needs before it can fill itself in.
 *
 * Accounts (for the chips), the most recently entered rows (for the smart
 * defaults, the note memory, the most-used category order and the duplicate
 * warning) and, when editing, the row - or both rows of a transfer.
 *
 * Reloaded on focus, so an account added from the form's "Add an account"
 * chip is there when you come back. The form seeds its fields once, from the
 * first answer, so a reload never overwrites what you have typed.
 */
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';

import { useLatestRun } from '../../core/useLatestRun';
import * as api from './api';
import type { Account, Transaction } from './types';

export function useEntryData(target: { id?: string; groupId?: string }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recent, setRecent] = useState<Transaction[]>([]);
  /** The row being edited, or a transfer's rows; null when adding. */
  const [editing, setEditing] = useState<Transaction[] | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { begin } = useLatestRun();

  const { id, groupId } = target;

  const load = useCallback(async () => {
    const isCurrent = begin();
    try {
      const [accountRows, recentRows, editRows] = await Promise.all([
        api.listAccounts(),
        api.listRecent(),
        id ? api.getTransaction(id).then((row) => [row]) : groupId ? api.getTransferRows(groupId) : null,
      ]);
      if (!isCurrent()) return;
      if (editRows && editRows.length === 0) throw new Error('That transfer no longer exists');
      setAccounts(accountRows);
      setRecent(recentRows);
      setEditing(editRows);
      setReady(true);
    } catch (e) {
      if (isCurrent()) setError(e instanceof Error ? e.message : 'Could not load this entry');
    }
  }, [begin, id, groupId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return { accounts, recent, editing, ready, error };
}
