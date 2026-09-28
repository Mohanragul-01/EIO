/**
 * useSubscriptions - data, the monthly-cost roll-up, and the renew action.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useLatestRun } from '../../core/useLatestRun';
import { useStableCallback } from '../../core/useStableCallback';

import { daysUntil } from '../../core/date';
import { sumMinor } from '../../core/money';
import * as api from './api';
import { ensurePermission, type PermissionState } from './notifications';
import { toMonthlyMinor, type Subscription } from './types';

export function useSubscriptions() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * Whether reminders can actually fire. Null until checked, so the banner does
   * not flash on every open before the answer is known.
   */
  const [permission, setPermission] = useState<PermissionState | null>(null);

  const { begin, isMounted } = useLatestRun();

  const load = useCallback(
    async (showSpinner = false) => {
      const isCurrent = begin();
      if (showSpinner) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const rows = await api.listSubscriptions();
        if (isCurrent()) setSubscriptions(rows);
      } catch (e) {
        if (isCurrent()) setError(e instanceof Error ? e.message : 'Something went wrong');
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
   * Asked once per mount rather than on every focus. The point is to notice
   * that reminders are off, not to re-prompt every time you open the module,
   * which would be the fastest way to train someone to dismiss it.
   */
  useEffect(() => {
    let active = true;
    ensurePermission()
      .then((state) => {
        if (active) setPermission(state);
      })
      // A rejection here used to be an unhandled promise. It is not worth an
      // error banner - the banner it feeds is itself only a nudge - but it must
      // not be silent either, and 'denied' is the safe reading of "we could not
      // ask", because it shows the prompt to turn reminders on.
      .catch(() => {
        if (active) setPermission('denied');
      });
    return () => {
      active = false;
    };
  }, []);

  const summary = useMemo(() => {
    const active = subscriptions.filter((s) => s.is_active);

    // Normalise every cycle to a monthly figure before summing - otherwise
    // you'd be adding a yearly ₹4,800 to a monthly ₹199 as if they were the
    // same thing.
    const monthlyMinor = sumMinor(active.map((s) => toMonthlyMinor(s.amount_minor, s.billing_cycle)));

    // Due within a week, and not already overdue.
    const dueSoon = active.filter((s) => {
      const days = daysUntil(s.next_due_date);
      return days >= 0 && days <= 7;
    });

    const overdue = active.filter((s) => daysUntil(s.next_due_date) < 0);

    return {
      monthlyMinor,
      yearlyMinor: monthlyMinor * 12,
      activeCount: active.length,
      dueSoon,
      overdue,
    };
  }, [subscriptions]);

  /**
   * Mark as paid: advance the due date and log the expense to Finance.
   *
   * Returns a result the screen uses for feedback, rather than swallowing it,
   * because "paid, and logged to Finance" and "paid, but the log failed" need
   * different messages.
   *
   * The row re-sorts as soon as its date changes - because the list is ordered
   * by due date, it visibly moves down, which confirms the tap landed.
   */
  const markPaid = useCallback(
    async (subscription: Subscription): Promise<api.MarkPaidResult | null> => {
      try {
        const result = await api.markPaid(subscription);

        if (isMounted()) {
          setSubscriptions((current) =>
            current
              .map((s) => (s.id === result.subscription.id ? result.subscription : s))
              .sort((a, b) => {
                if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
                return a.next_due_date.localeCompare(b.next_due_date);
              }),
          );
        }
        return result;
      } catch (e) {
        // Nothing to roll back: this one is not optimistic, the list is only
        // touched on success. The old version restored a whole-list snapshot
        // here, which could only ever undo somebody ELSE's change made while
        // this request was in flight.
        if (isMounted()) setError(e instanceof Error ? e.message : 'Could not update');
        return null;
      }
    },
    [isMounted],
  );

  const remove = useCallback(
    async (subscription: Subscription) => {
      let index = -1;
      setSubscriptions((current) => {
        index = current.findIndex((s) => s.id === subscription.id);
        return current.filter((s) => s.id !== subscription.id);
      });

      try {
        await api.deleteSubscription(subscription.id);
      } catch (e) {
        if (!isMounted()) return;
        // This row only. A snapshot would resurrect anything else deleted
        // while this delete was in flight.
        setSubscriptions((current) => {
          if (current.some((s) => s.id === subscription.id)) return current;
          const restored = [...current];
          restored.splice(index < 0 ? restored.length : index, 0, subscription);
          return restored;
        });
        setError(e instanceof Error ? e.message : 'Could not delete');
      }
    },
    [isMounted],
  );

  /**
   * Stable identities that always reach the CURRENT load closure. The focus
   * effect in each screen holds one of these forever, so it must not close over
   * a stale copy. See core/useStableCallback for the bug this prevents.
   */
  const refresh = useStableCallback(() => load(true));
  const reload = useStableCallback(() => load(false));

  return {
    subscriptions,
    summary,
    permission,
    loading,
    refreshing,
    error,
    refresh,
    reload,
    markPaid,
    remove,
  };
}
