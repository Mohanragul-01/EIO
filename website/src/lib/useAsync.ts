/**
 * useAsync - load data, track loading and error, and reload on demand.
 *
 * The web counterpart to the app's per-module hooks. There is one of these
 * rather than six because every module's loader has the same shape once the
 * queries themselves live in the shared api.ts files: call it, hold the result,
 * survive unmount, expose a reload.
 *
 * The stale-response guard is the part that matters. Two loads can be in
 * flight at once - you change a filter while the previous request is still
 * running - and without a sequence check the SLOWER one wins simply by landing
 * last, showing data for a filter you already moved away from.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type Async<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** Re-run the loader. Safe to call from an event handler or an effect. */
  reload: () => Promise<void>;
  /** Replace the data locally, for optimistic updates. */
  set: (next: T) => void;
};

/**
 * `key` identifies the request, not the data. Change it and the loader re-runs;
 * leave it alone and it does not.
 *
 * A string rather than a dependency ARRAY, deliberately. An array parameter
 * spread into useEffect cannot be checked by the exhaustive-deps rule, so it
 * needs a suppression - and this app has none, because the last real bug in it
 * hid behind exactly that suppression. A key is a plain value the linter can
 * see, and it also forces the caller to say what identifies the request
 * (`${year}-${month}`) rather than listing whatever happens to be in scope.
 */
export function useAsync<T>(loader: () => Promise<T>, key: string = ''): Async<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mounted = useRef(true);
  /** Sequence number of the most recently STARTED load. */
  const latest = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // The loader identity changes on every render at most call sites, so it is
  // held in a ref and the effect keys off `key` instead. Depending on the
  // function itself would re-fetch on every render, forever.
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const run = useCallback(async () => {
    const ticket = ++latest.current;
    setLoading(true);
    setError(null);

    try {
      const result = await loaderRef.current();
      // A newer load started while this one was in flight: its answer is the
      // current one, so this response is discarded rather than overwriting it.
      if (!mounted.current || ticket !== latest.current) return;
      setData(result);
    } catch (e) {
      if (!mounted.current || ticket !== latest.current) return;
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      if (mounted.current && ticket === latest.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void run();
  }, [key, run]);

  const set = useCallback((next: T) => {
    if (mounted.current) setData(next);
  }, []);

  return { data, loading, error, reload: run, set };
}
