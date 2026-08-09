/**
 * useStableCallback
 *
 * Returns a function whose identity never changes, but which always calls the
 * most recent version of the function you passed in.
 *
 * WHY THIS EXISTS, and the bug it fixes:
 *
 * Every list screen refetches when it regains focus:
 *
 *   useFocusEffect(useCallback(() => { reload(); }, []))
 *
 * The empty dependency array is not optional. `reload` is rebuilt on every
 * render, so depending on it would refetch in a loop. But an empty array means
 * the effect captures the FIRST `reload` and keeps it forever.
 *
 * For most modules that was harmless, because `reload` always fetched the same
 * thing. Finance is different: its loader depends on the selected month. Switch
 * to July, add a transaction, come back, and the captured closure refetched
 * AUGUST while you were looking at July, so the new row never appeared.
 * Pull-to-refresh worked because that path calls the current `refresh`, not the
 * captured one, which is exactly why it looked like a refresh problem rather
 * than a stale-closure one.
 *
 * A ref that is kept up to date on every render gives one function identity
 * that always reaches the latest closure, so the effect can hold it forever and
 * still read the current month.
 */
import { useCallback, useEffect, useRef } from 'react';

export function useStableCallback<Args extends unknown[], Result>(
  callback: (...args: Args) => Result,
): (...args: Args) => Result {
  const ref = useRef(callback);

  // No dependency array on purpose: this runs after every render, so the ref
  // is current before any effect or event handler can call through it.
  useEffect(() => {
    ref.current = callback;
  });

  return useCallback((...args: Args) => ref.current(...args), []);
}
