/**
 * useLatestRun - "is this response still the one we want?"
 *
 * Every data hook in this app had the same guard:
 *
 *     if (mounted.current) setRows(rows);
 *
 * which answers a different question than the one that matters. It stops a
 * write after the screen is gone, but it does nothing about two loads being in
 * flight at once - and then the answer that lands LAST wins, rather than the
 * answer to the question asked last.
 *
 * That is reachable without doing anything strange: pull to refresh while the
 * first load is still running, or complete a task (which reloads) while a
 * refresh is in flight. The older request returns the older list, overwrites
 * the newer one, and the row you just changed comes back. It looks like the
 * write failed, so you do it again.
 *
 * So each run takes a ticket, and only the holder of the newest ticket is
 * allowed to write. The website's useAsync has always done this; this is the
 * same idea, in the shape the app's hooks already use.
 *
 *     const begin = useLatestRun();
 *
 *     const load = useCallback(async () => {
 *       const isCurrent = begin();
 *       try {
 *         const rows = await api.list();
 *         if (isCurrent()) setRows(rows);
 *       } catch (e) {
 *         if (isCurrent()) setError(...);
 *       } finally {
 *         if (isCurrent()) setLoading(false);
 *       }
 *     }, [begin]);
 *
 * `begin` is stable, so it can sit in a dependency array without rebuilding
 * the loader it belongs to.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';

export type LatestRun = {
  /** Take a ticket. The returned check is true while this run is still the newest. */
  begin: () => () => boolean;
  /**
   * Just "is the screen still here".
   *
   * Mutations want this rather than a ticket. A save writes its OWN result, so
   * a list reload starting mid-save does not make the save's answer stale -
   * ticketing a mutation would throw away a write the user is waiting on.
   */
  isMounted: () => boolean;
};

export function useLatestRun(): LatestRun {
  const mounted = useRef(true);
  /** Sequence number of the most recently STARTED run. */
  const latest = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const begin = useCallback(() => {
    const ticket = ++latest.current;
    // Still mounted, and no newer run has started since this one did.
    return () => mounted.current && ticket === latest.current;
  }, []);

  const isMounted = useCallback(() => mounted.current, []);

  return useMemo(() => ({ begin, isMounted }), [begin, isMounted]);
}
