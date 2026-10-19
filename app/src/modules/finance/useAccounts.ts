/**
 * useAccounts - the Accounts screen: every account, its balance, and changes.
 *
 * Balances are computed from every row (accounts.ts), never stored, so this
 * loads the all-time points alongside the accounts.
 */
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';

import { useLatestRun } from '../../core/useLatestRun';
import { summarizeAccounts } from './accounts';
import * as api from './api';
import type { Account, AccountInput, LedgerPoint } from './types';

export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [points, setPoints] = useState<LedgerPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { begin, isMounted } = useLatestRun();

  const load = useCallback(
    async (isRefresh = false) => {
      const isCurrent = begin();
      if (isRefresh) setRefreshing(true);
      setError(null);
      try {
        const [accountRows, allPoints] = await Promise.all([api.listAccounts(), api.listLedgerPoints()]);
        if (!isCurrent()) return;
        setAccounts(accountRows);
        setPoints(allPoints);
      } catch (e) {
        if (isCurrent()) setError(e instanceof Error ? e.message : 'Could not load your accounts');
      } finally {
        if (isCurrent()) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [begin],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const summary = useMemo(() => summarizeAccounts(accounts, points), [accounts, points]);

  const create = useCallback(
    async (input: AccountInput) => {
      const position = accounts.reduce((max, a) => Math.max(max, a.position), -1) + 1;
      const created = await api.createAccount(input, position);
      if (isMounted()) setAccounts((list) => [...list, created]);
    },
    [accounts, isMounted],
  );

  const update = useCallback(
    async (id: string, input: AccountInput) => {
      const saved = await api.updateAccount(id, input);
      if (isMounted()) setAccounts((list) => list.map((a) => (a.id === id ? saved : a)));
    },
    [isMounted],
  );

  /** Archive or bring back. Optimistic; only this account flips back on failure. */
  const setActive = useCallback(
    async (account: Account, active: boolean): Promise<boolean> => {
      const flip = (value: boolean) =>
        setAccounts((list) => list.map((a) => (a.id === account.id ? { ...a, is_active: value } : a)));
      flip(active);
      try {
        await api.updateAccount(account.id, { is_active: active });
        return true;
      } catch (e) {
        if (isMounted()) {
          flip(!active);
          setError(e instanceof Error ? e.message : 'Could not change that account');
        }
        return false;
      }
    },
    [isMounted],
  );

  const remove = useCallback(
    async (account: Account) => {
      await api.deleteAccount(account.id);
      if (isMounted()) setAccounts((list) => list.filter((a) => a.id !== account.id));
    },
    [isMounted],
  );

  return {
    accounts,
    summary,
    loading,
    refreshing,
    error,
    refresh: () => load(true),
    create,
    update,
    setActive,
    remove,
  };
}
