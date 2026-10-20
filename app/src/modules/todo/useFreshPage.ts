/**
 * useFreshPage - keep a page of the Tasks pager showing what is true now.
 *
 * Every page of the pager is mounted at once, and each used to reload only
 * when the screen regained navigation focus. So a tick on Today left Daily
 * showing the task open (ticking it there said "Completed" for a row already
 * closed), and the app resumed the next morning still showed yesterday's
 * date, yesterday's leftovers under "Today", and none of today's tasks. A
 * page now reloads:
 *   - when it is swiped to: it may have missed anything since its last load;
 *   - while on show, when the app comes back to the foreground - a new day,
 *     a reminder's Done, an edit on the website - and Today re-reads the date;
 *   - while on show, when a write made elsewhere lands (changeSignal): the
 *     page a write was made on already shows it.
 * Pages out of sight wait until they are swiped to, rather than five pages
 * reloading for every change.
 *
 * Not at mount: the screen's focus effect loads every page then.
 */
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { subscribeChanges } from './changeSignal';

export function useFreshPage(active: boolean, reload: () => void, source: object): void {
  const wasActive = useRef(active);
  useEffect(() => {
    if (active && !wasActive.current) reload();
    wasActive.current = active;
  }, [active, reload]);

  useEffect(() => {
    if (!active) return;
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') reload();
    });
    const stop = subscribeChanges((from) => {
      if (from !== source) reload();
    });
    return () => {
      appState.remove();
      stop();
    };
  }, [active, reload, source]);
}
