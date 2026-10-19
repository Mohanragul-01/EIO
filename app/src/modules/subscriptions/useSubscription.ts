/**
 * useSubscription - one subscription, its payments and its price history, for
 * the detail screen. The actions mirror useSubscriptions' and keep the same
 * rule: only this row changes, and only this row rolls back.
 */
import { useCallback, useEffect, useState } from 'react';

import { useLatestRun } from '../../core/useLatestRun';
import { useStableCallback } from '../../core/useStableCallback';
import { snapshot, type LifecyclePatch } from './actions';
import * as api from './api';
import { DEFAULT_REMINDER_SETTINGS } from './reminders';
import type { Account, Payment, PriceChange, ReminderSettings, Subscription } from './types';
import type { PatchResult } from './useSubscriptions';

const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

export function useSubscription(id: string) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [priceChanges, setPriceChanges] = useState<PriceChange[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [settings, setSettings] = useState<ReminderSettings>(DEFAULT_REMINDER_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { begin, isMounted } = useLatestRun();

  /** State is set only in the promise's callbacks: see useSubscriptions. */
  const load = useCallback((): Promise<void> => {
    const isCurrent = begin();
    return Promise.all([
      api.getSubscription(id),
      api.listPayments(id).catch(() => [] as Payment[]),
      api.listPriceChanges(id).catch(() => [] as PriceChange[]),
      api.listAccounts().catch(() => [] as Account[]),
      api.getReminderSettings().catch(() => DEFAULT_REMINDER_SETTINGS),
    ])
      .then(([sub, paid, changes, accountRows, savedSettings]) => {
        if (!isCurrent()) return;
        setLoadError(null);
        setSubscription(sub);
        setPayments(paid);
        setPriceChanges(changes);
        setAccounts(accountRows);
        setSettings(savedSettings);
      })
      .catch((e: unknown) => {
        if (isCurrent()) setLoadError(errorText(e, 'Could not load this subscription'));
      })
      .finally(() => {
        if (isCurrent()) setLoading(false);
      });
  }, [begin, id]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Payments and price history after a write that changes them. */
  const refreshHistory = useCallback(async () => {
    const [paid, changes] = await Promise.all([
      api.listPayments(id).catch(() => null),
      api.listPriceChanges(id).catch(() => null),
    ]);
    if (!isMounted()) return;
    if (paid) setPayments(paid);
    if (changes) setPriceChanges(changes);
  }, [id, isMounted]);

  const markPaid = useCallback(
    async (sub: Subscription, input: api.MarkPaidInput): Promise<api.MarkPaidResult | null> => {
      try {
        const result = await api.markPaid(sub, input);
        if (isMounted()) setSubscription(result.subscription);
        await refreshHistory();
        return result;
      } catch (e) {
        if (isMounted()) setError(errorText(e, 'Could not mark that paid'));
        return null;
      }
    },
    [isMounted, refreshHistory],
  );

  const undoMarkPaid = useCallback(
    async (result: api.MarkPaidResult): Promise<boolean> => {
      try {
        const restored = await api.undoMarkPaid(result);
        if (isMounted()) setSubscription(restored);
        await refreshHistory();
        return true;
      } catch (e) {
        if (isMounted()) setError(errorText(e, 'Could not undo that'));
        return false;
      }
    },
    [isMounted, refreshHistory],
  );

  const applyPatch = useCallback(
    async (sub: Subscription, patch: LifecyclePatch): Promise<PatchResult | null> => {
      setSubscription({ ...sub, ...patch });
      try {
        const saved = await api.applyPatch(sub, patch);
        if (isMounted()) setSubscription(saved);
        return { subscription: saved, previous: sub };
      } catch (e) {
        if (isMounted()) {
          setSubscription(sub);
          setError(errorText(e, 'Could not update that'));
        }
        return null;
      }
    },
    [isMounted],
  );

  const undoPatch = useCallback(
    async (result: PatchResult): Promise<boolean> =>
      (await applyPatch(result.subscription, snapshot(result.previous))) !== null,
    [applyPatch],
  );

  /** Remove one price-history row you entered by mistake. */
  const deletePriceChange = useCallback(
    async (change: PriceChange): Promise<boolean> => {
      setPriceChanges((current) => current.filter((c) => c.id !== change.id));
      try {
        await api.deletePriceChange(change.id);
        return true;
      } catch (e) {
        if (isMounted()) {
          setPriceChanges((current) =>
            current.some((c) => c.id === change.id) ? current : [...current, change],
          );
          setError(errorText(e, 'Could not delete that'));
        }
        return false;
      }
    },
    [isMounted],
  );

  const reload = useStableCallback(() => load());
  const clearError = useCallback(() => setError(null), []);

  return {
    subscription,
    payments,
    priceChanges,
    accounts,
    settings,
    loading,
    loadError,
    error,
    clearError,
    reload,
    markPaid,
    undoMarkPaid,
    applyPatch,
    undoPatch,
    deletePriceChange,
  };
}
