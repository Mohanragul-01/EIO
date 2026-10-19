/**
 * useSubscriptions - the list, everything it is derived into, and the actions
 * a row offers.
 *
 * Every action changes ONE row and, on failure, rolls back only that row: a
 * whole-list snapshot would undo somebody else's change made while this one
 * was in flight. Actions that can be undone return what Undo needs.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { addDaysISO, todayISO } from '../../core/date';
import { useLatestRun } from '../../core/useLatestRun';
import { useStableCallback } from '../../core/useStableCallback';
import type { LifecyclePatch } from './actions';
import { snapshot } from './actions';
import * as api from './api';
import { ensurePermission, permissionState, type PermissionState } from './notifications';
import { INCREASE_BADGE_DAYS, recentIncreases } from './prices';
import { DEFAULT_REMINDER_SETTINGS } from './reminders';
import type { Account, Payment, PriceChange, ReminderSettings, Subscription } from './types';
import { sections, summaryTotals, upcomingDays } from './upcoming';

const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

export type PatchResult = { subscription: Subscription; previous: Subscription };

export function useSubscriptions() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [settings, setSettings] = useState<ReminderSettings>(DEFAULT_REMINDER_SETTINGS);
  const [priceChanges, setPriceChanges] = useState<PriceChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Bumped by anything that writes a payment, so payment views refetch. */
  const [paymentsVersion, setPaymentsVersion] = useState(0);
  /**
   * Whether reminders can fire. Null until checked, so the notice does not
   * flash on every open before the answer is known.
   */
  const [permission, setPermission] = useState<PermissionState | null>(null);

  const { begin, isMounted } = useLatestRun();

  const load = useCallback(
    async (showSpinner = false) => {
      const isCurrent = begin();
      if (showSpinner) setRefreshing(true);
      setError(null);

      try {
        // The list is required; the rest decorate it, and a Finance table
        // that is not there yet (0008 not run) must not empty the list.
        const [rows, accountRows, savedSettings, changes] = await Promise.all([
          api.listSubscriptions(),
          api.listAccounts().catch(() => [] as Account[]),
          api.getReminderSettings().catch(() => DEFAULT_REMINDER_SETTINGS),
          api.listRecentPriceChanges(addDaysISO(-INCREASE_BADGE_DAYS)).catch(() => [] as PriceChange[]),
        ]);
        if (!isCurrent()) return;
        setSubscriptions(rows);
        setAccounts(accountRows);
        setSettings(savedSettings);
        setPriceChanges(changes);
        setPaymentsVersion((v) => v + 1);
      } catch (e) {
        if (isCurrent()) setError(errorText(e, 'Something went wrong'));
      } finally {
        if (isCurrent()) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [begin],
  );

  useEffect(() => {
    // Starts a fetch rather than computing derived state - see useTodos.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  /**
   * Checked once per mount, WITHOUT asking: a prompt on opening a screen is
   * the one people refuse. Asking happens when you tap the notice, or add a
   * subscription - the moments you are turning a reminder on.
   */
  useEffect(() => {
    let active = true;
    permissionState()
      .then((state) => {
        if (active) setPermission(state);
      })
      .catch(() => {
        if (active) setPermission('denied');
      });
    return () => {
      active = false;
    };
  }, []);

  /** Ask now (the person tapped "turn reminders on"). Resolves the new state. */
  const turnOnReminders = useCallback(async (): Promise<PermissionState> => {
    const state = await ensurePermission().catch(() => 'denied' as const);
    if (isMounted()) setPermission(state);
    // Granted just now: the reminders that could not be scheduled before can.
    if (state === 'granted') void api.resyncReminders().catch(() => {});
    return state;
  }, [isMounted]);

  const replaceRow = useCallback((row: Subscription) => {
    setSubscriptions((current) => current.map((s) => (s.id === row.id ? row : s)));
  }, []);

  const markPaid = useCallback(
    async (sub: Subscription, input: api.MarkPaidInput): Promise<api.MarkPaidResult | null> => {
      try {
        const result = await api.markPaid(sub, input);
        if (isMounted()) {
          replaceRow(result.subscription);
          setPaymentsVersion((v) => v + 1);
        }
        return result;
      } catch (e) {
        // Not optimistic, so nothing to roll back.
        if (isMounted()) setError(errorText(e, 'Could not mark that paid'));
        return null;
      }
    },
    [isMounted, replaceRow],
  );

  const undoMarkPaid = useCallback(
    async (result: api.MarkPaidResult): Promise<boolean> => {
      try {
        const restored = await api.undoMarkPaid(result);
        if (isMounted()) {
          replaceRow(restored);
          setPaymentsVersion((v) => v + 1);
        }
        return true;
      } catch (e) {
        if (isMounted()) setError(errorText(e, 'Could not undo that'));
        return false;
      }
    },
    [isMounted, replaceRow],
  );

  /**
   * Pause, resume, cancel, archive, restore, keep or end a trial - shown at
   * once, rolled back (this row only) if the save fails.
   */
  const applyPatch = useCallback(
    async (sub: Subscription, patch: LifecyclePatch): Promise<PatchResult | null> => {
      replaceRow({ ...sub, ...patch });
      try {
        const saved = await api.applyPatch(sub, patch);
        if (isMounted()) replaceRow(saved);
        return { subscription: saved, previous: sub };
      } catch (e) {
        if (isMounted()) {
          replaceRow(sub);
          setError(errorText(e, 'Could not update that'));
        }
        return null;
      }
    },
    [isMounted, replaceRow],
  );

  /** Put a row back the way it was before an action: that action's Undo. */
  const undoPatch = useCallback(
    async (result: PatchResult): Promise<boolean> =>
      (await applyPatch(result.subscription, snapshot(result.previous))) !== null,
    [applyPatch],
  );

  const remove = useCallback(
    async (sub: Subscription): Promise<boolean> => {
      let index = -1;
      setSubscriptions((current) => {
        index = current.findIndex((s) => s.id === sub.id);
        return current.filter((s) => s.id !== sub.id);
      });
      try {
        await api.deleteSubscription(sub.id);
        return true;
      } catch (e) {
        if (!isMounted()) return false;
        // This row only. A snapshot would resurrect anything else deleted
        // while this delete was in flight.
        setSubscriptions((current) => {
          if (current.some((s) => s.id === sub.id)) return current;
          const restored = [...current];
          restored.splice(index < 0 ? restored.length : index, 0, sub);
          return restored;
        });
        setError(errorText(e, 'Could not delete'));
        return false;
      }
    },
    [isMounted],
  );

  const saveSettings = useCallback(
    async (next: ReminderSettings): Promise<boolean> => {
      try {
        const saved = await api.saveReminderSettings(next);
        if (isMounted()) setSettings(saved);
        return true;
      } catch (e) {
        if (isMounted()) setError(errorText(e, 'Could not save reminder settings'));
        return false;
      }
    },
    [isMounted],
  );

  const today = todayISO();
  const totals = useMemo(() => summaryTotals(subscriptions, today), [subscriptions, today]);
  const grouped = useMemo(() => sections(subscriptions, today), [subscriptions, today]);
  const strip = useMemo(() => upcomingDays(subscriptions, today), [subscriptions, today]);
  const rises = useMemo(() => recentIncreases(priceChanges, today), [priceChanges, today]);
  const accountName = useMemo(() => {
    const names = new Map(accounts.map((a) => [a.id, a.name]));
    return (id: string | null) => (id ? (names.get(id) ?? null) : null);
  }, [accounts]);

  /**
   * Stable identities that always reach the CURRENT load closure. The focus
   * effect in each screen holds one of these forever, so it must not close over
   * a stale copy. See core/useStableCallback for the bug this prevents.
   */
  const refresh = useStableCallback(() => load(true));
  const reload = useStableCallback(() => load(false));
  const clearError = useCallback(() => setError(null), []);

  return {
    subscriptions,
    accounts,
    accountName,
    settings,
    rises,
    totals,
    sections: grouped.sections,
    archived: grouped.archived,
    strip,
    today,
    paymentsVersion,
    permission,
    loading,
    refreshing,
    error,
    clearError,
    refresh,
    reload,
    turnOnReminders,
    markPaid,
    undoMarkPaid,
    applyPatch,
    undoPatch,
    remove,
    saveSettings,
  };
}

/**
 * Subscription payments in [from, to], for the calendar and insights.
 * `version` refetches after anything that logs or removes a payment.
 */
export function usePaymentsBetween(from: string, to: string, version: number) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const { begin } = useLatestRun();

  useEffect(() => {
    const isCurrent = begin();
    api
      .listPaymentsBetween(from, to)
      .then((rows) => {
        if (isCurrent()) {
          setPayments(rows);
          setLoaded(true);
        }
      })
      .catch(() => {
        // Without payments the views still show what is projected; the
        // "paid" figures read as zero rather than the screen failing.
        if (isCurrent()) {
          setPayments([]);
          setLoaded(true);
        }
      });
  }, [from, to, version, begin]);

  return { payments, loaded };
}
