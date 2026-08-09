/**
 * useSubscriptions - data, the monthly-cost roll-up, and the renew action.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useStableCallback } from '../../core/useStableCallback';

import { daysUntil } from '../../core/date';
import { sumMinor } from '../../core/money';
import * as api from './api';
import { toMonthlyMinor, type Subscription } from './types';

export function useSubscriptions() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
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

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    setError(null);

    try {
      const rows = await api.listSubscriptions();
      if (mounted.current) setSubscriptions(rows);
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
      const snapshot = subscriptions;
      try {
        const result = await api.markPaid(subscription);

        if (mounted.current) {
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
        // Only reached if the due-date update itself failed, in which case
        // nothing was written at all and rolling back is correct.
        if (mounted.current) {
          setSubscriptions(snapshot);
          setError(e instanceof Error ? e.message : 'Could not update');
        }
        return null;
      }
    },
    [subscriptions],
  );

  const remove = useCallback(
    async (subscription: Subscription) => {
      const snapshot = subscriptions;
      setSubscriptions((current) => current.filter((s) => s.id !== subscription.id));

      try {
        await api.deleteSubscription(subscription.id);
      } catch (e) {
        setSubscriptions(snapshot);
        setError(e instanceof Error ? e.message : 'Could not delete');
      }
    },
    [subscriptions],
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
    loading,
    refreshing,
    error,
    refresh,
    reload,
    markPaid,
    remove,
  };
}
