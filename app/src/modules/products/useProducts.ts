/**
 * useProducts - the list screen's data, its one-tap writes, and the reorder
 * reminders that follow them.
 *
 * ONE-TAP WRITES SHOW AT ONCE. A tick on the Today checklist or a "Log use"
 * appears before the database answers, as a pending row; the saved row then
 * replaces it by id. A failure takes back THAT row only - never a snapshot of
 * the whole list, which would also erase a second tap that landed meanwhile.
 *
 * REMINDERS FOLLOW THE DATA. Whenever what the list knows changes - a load, a
 * log, an undo - the reorder reminders are rebuilt from it. The list already
 * holds every product and every use, so this costs no extra query, and it
 * means "rescheduled after every log" holds for every way of logging.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { todayISO } from '../../core/date';
import { useLatestRun } from '../../core/useLatestRun';
import * as api from './api';
import { replaceReminders } from './notifications';
import { buildOutlooks } from './outlook';
import type { Product, ProductUse } from './types';

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [uses, setUses] = useState<ProductUse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  /** Set by the first successful load, so an empty list before it (or after a
   *  failed first load) never cancels reminders that are perfectly good. */
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { begin, isMounted } = useLatestRun();
  const pending = useRef(0);

  const load = useCallback(
    async (isRefresh = false) => {
      const isCurrent = begin();
      if (isRefresh) setRefreshing(true);
      setError(null);
      try {
        const [p, u] = await Promise.all([api.listProducts(), api.listAllUses()]);
        if (!isCurrent()) return;
        setProducts(p);
        setUses(u);
        setLoaded(true);
      } catch (e) {
        if (isCurrent()) setError(messageOf(e, 'Could not load your products'));
      } finally {
        if (isCurrent()) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [begin],
  );

  const today = todayISO();
  const outlooks = useMemo(() => buildOutlooks(products, uses, today), [products, uses, today]);

  // Syncing with something outside React - the phone's scheduled
  // notifications - which is what an effect is for.
  useEffect(() => {
    if (loaded) void replaceReminders(outlooks);
  }, [outlooks, loaded]);

  /** A row that stands in for a write until the database answers. */
  const placeholder = useCallback(
    (productId: string, quantity: number, usedOn: string, note: string): ProductUse => ({
      id: `pending-${++pending.current}`,
      product_id: productId,
      user_id: '',
      used_on: usedOn,
      quantity,
      note,
      created_at: new Date().toISOString(),
    }),
    [],
  );

  /** Log one use. Resolves the saved row, or null when it failed (and says why). */
  const logUse = useCallback(
    async (productId: string, quantity: number, usedOn: string, note = '') => {
      const temp = placeholder(productId, quantity, usedOn, note);
      setUses((current) => [temp, ...current]);
      try {
        const saved = await api.logUse(productId, quantity, usedOn, note);
        if (isMounted()) setUses((current) => current.map((u) => (u.id === temp.id ? saved : u)));
        return saved;
      } catch (e) {
        if (isMounted()) {
          setUses((current) => current.filter((u) => u.id !== temp.id));
          setError(messageOf(e, 'Could not log that'));
        }
        return null;
      }
    },
    [isMounted, placeholder],
  );

  /** Log several at once ("Log all"). One insert: all of them or none. */
  const logMany = useCallback(
    async (entries: { productId: string; quantity: number }[], usedOn: string) => {
      const temps = entries.map((entry) => placeholder(entry.productId, entry.quantity, usedOn, ''));
      const tempIds = new Set(temps.map((t) => t.id));
      setUses((current) => [...temps, ...current]);
      try {
        const saved = await api.logUses(entries.map((entry) => ({ ...entry, usedOn })));
        if (isMounted()) {
          setUses((current) => [...saved, ...current.filter((u) => !tempIds.has(u.id))]);
        }
        return saved;
      } catch (e) {
        if (isMounted()) {
          setUses((current) => current.filter((u) => !tempIds.has(u.id)));
          setError(messageOf(e, 'Could not log those'));
        }
        return null;
      }
    },
    [isMounted, placeholder],
  );

  /** Remove uses. On failure exactly those rows come back. */
  const removeUses = useCallback(
    async (removed: ProductUse[]) => {
      const ids = new Set(removed.map((u) => u.id));
      setUses((current) => current.filter((u) => !ids.has(u.id)));
      try {
        await api.deleteUses([...ids]);
        return true;
      } catch (e) {
        if (isMounted()) {
          setUses((current) => [...removed, ...current.filter((u) => !ids.has(u.id))]);
          setError(messageOf(e, 'Could not remove that'));
        }
        return false;
      }
    },
    [isMounted],
  );

  return {
    products,
    uses,
    outlooks,
    today,
    loading,
    refreshing,
    error,
    setError,
    load,
    logUse,
    logMany,
    removeUses,
  };
}
