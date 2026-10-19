/**
 * useTodos - the data-fetching hook for one frequency page.
 *
 *  WHY A HOOK SITS BETWEEN THE SCREEN AND api.ts
 * api.ts knows how to talk to the database. It doesn't know about React.
 * A screen needs more than data: it needs loading state, error state, a way
 * to refresh, and re-renders when things change. That's what this hook adds.
 *
 * Plain hooks rather than React Query, deliberately - one less library and one
 * less mental model. If caching across screens ever becomes a real need, this
 * is the file that would be swapped; screens wouldn't change.
 *
 * Every write is optimistic and, if the server says no, puts back ONLY its own
 * row. Ticking happens in bursts; restoring a whole-list snapshot would also
 * undo whatever else was ticked while this write was in flight.
 */
import { useCallback, useState } from 'react';

import { todayISO } from '../../core/date';
import { useLatestRun } from '../../core/useLatestRun';
import { useStableCallback } from '../../core/useStableCallback';

import * as api from './api';
import { groupBySeries, streakFor, type HistoryRow, type StreakStats } from './streaks';
import { seriesKey, type Frequency, type Todo } from './types';
import { repeatingKeys } from './useToday';

/**
 * Which slice of a frequency to load.
 *
 * 'done' is a SEPARATE query rather than a filter over one list, because
 * completed tasks are never deleted and outnumber open ones many times over.
 */
export type TodoStatus = 'open' | 'done';

/** Hand-set position first, then due date with undated last - the SQL order. */
function byPosition(a: Todo, b: Todo): number {
  if (a.position !== b.position) return a.position - b.position;
  if (!a.due_date) return 1;
  if (!b.due_date) return -1;
  return a.due_date.localeCompare(b.due_date);
}

/** Put a row back where it was, unless something already has. */
function restore(list: Todo[], row: Todo, index: number): Todo[] {
  if (list.some((t) => t.id === row.id)) return list;
  const next = [...list];
  next.splice(index < 0 || index > next.length ? next.length : index, 0, row);
  return next;
}

export function useTodos(frequency: Frequency, status: TodoStatus = 'open') {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [history, setHistory] = useState<Map<string, HistoryRow[]>>(new Map());
  // Starts true so the very first render shows a spinner rather than a
  // misleading "no tasks yet" empty state before the fetch resolves.
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Guards against writing state after the screen is gone, AND against an
   * older request overwriting a newer one. See useLatestRun.
   */
  const { begin, isMounted } = useLatestRun();

  const load = useCallback(
    async (isRefresh = false) => {
      const isCurrent = begin();
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const rows =
          status === 'done'
            ? await api.listCompletedByFrequency(frequency)
            : await api.listTodosByFrequency(frequency);
        let grouped = new Map<string, HistoryRow[]>();
        if (status === 'open') {
          try {
            grouped = groupBySeries(await api.listSeriesHistory(repeatingKeys(rows)));
          } catch {
            // Streak chips are decoration; the list stands without them.
          }
        }
        if (isCurrent()) {
          setTodos(rows);
          setHistory(grouped);
        }
      } catch (e) {
        if (isCurrent()) setError(e instanceof Error ? e.message : 'Something went wrong');
      } finally {
        if (isCurrent()) {
          setLoading(false);
          setRefreshing(false);
        }
      }
      // Depends on the tab AND the status: changing either must produce a new
      // loader. There is no mount effect calling it: the page calls reload()
      // from useFocusEffect, which also runs on mount in a focused screen.
    },
    [frequency, status, begin],
  );

  /** Take a row out of the list; the returned function says where it was. */
  const takeOut = useCallback((todo: Todo) => {
    let index = -1;
    setTodos((current) => {
      index = current.findIndex((t) => t.id === todo.id);
      return current.filter((t) => t.id !== todo.id);
    });
    return () => index;
  }, []);

  /**
   * Close a task as done or skipped. It leaves this list (which only shows
   * open tasks) at once; a repeat's successor joins it from the API response,
   * where its position puts it. Resolves the successor (for Undo), null, or
   * false if the write failed.
   */
  const close = useCallback(
    async (todo: Todo, outcome: 'done' | 'skipped'): Promise<Todo | null | false> => {
      const indexOf = takeOut(todo);
      try {
        const next = await api.completeTask(todo, outcome);
        if (next && isMounted() && status === 'open' && next.frequency === frequency) {
          setTodos((current) => [...current, next].sort(byPosition));
        }
        return next;
      } catch (e) {
        if (isMounted()) {
          setTodos((current) => restore(current, todo, indexOf()));
          setError(e instanceof Error ? e.message : 'Could not complete the task');
        }
        return false;
      }
    },
    [takeOut, isMounted, status, frequency],
  );

  const complete = useCallback((todo: Todo) => close(todo, 'done'), [close]);
  const skip = useCallback((todo: Todo) => close(todo, 'skipped'), [close]);

  const wontDo = useCallback(
    async (todo: Todo): Promise<boolean> => {
      const indexOf = takeOut(todo);
      try {
        await api.wontDoTask(todo);
        return true;
      } catch (e) {
        if (isMounted()) {
          setTodos((current) => restore(current, todo, indexOf()));
          setError(e instanceof Error ? e.message : 'Could not update the task');
        }
        return false;
      }
    },
    [takeOut, isMounted],
  );

  /**
   * Reopen. In the Completed list the row leaves it; in the open list (an
   * Undo) it comes back, and the occurrence the tick created goes - which
   * api.reopenTask reports.
   */
  const reopen = useCallback(
    async (todo: Todo): Promise<boolean> => {
      const reopened: Todo = { ...todo, is_done: false, outcome: null, completed_at: null };
      let indexOf: () => number = () => -1;
      if (status === 'done') indexOf = takeOut(todo);
      else setTodos((current) => restore(current, reopened, current.length).sort(byPosition));
      try {
        const { removed } = await api.reopenTask(todo.id);
        if (isMounted() && removed.length > 0) {
          setTodos((current) => current.filter((t) => !removed.includes(t.id)));
        }
        return true;
      } catch (e) {
        if (isMounted()) {
          setTodos((current) =>
            status === 'done'
              ? restore(current, todo, indexOf())
              : current.filter((t) => t.id !== todo.id),
          );
          setError(e instanceof Error ? e.message : 'Could not reopen the task');
        }
        return false;
      }
    },
    [takeOut, isMounted, status],
  );

  const reschedule = useCallback(
    async (tasks: Todo[], dueDate: string | null): Promise<boolean> => {
      const ids = new Set(tasks.map((t) => t.id));
      setTodos((current) => current.map((t) => (ids.has(t.id) ? { ...t, due_date: dueDate } : t)));
      try {
        await api.rescheduleTasks([...ids], dueDate);
        return true;
      } catch (e) {
        if (isMounted()) {
          const before = new Map(tasks.map((t) => [t.id, t]));
          setTodos((current) => current.map((t) => before.get(t.id) ?? t));
          setError(e instanceof Error ? e.message : 'Could not move the task');
        }
        return false;
      }
    },
    [isMounted],
  );

  const remove = useCallback(
    async (todo: Todo): Promise<boolean> => {
      const indexOf = takeOut(todo);
      try {
        await api.deleteTodo(todo.id);
        return true;
      } catch (e) {
        if (isMounted()) {
          setTodos((current) => restore(current, todo, indexOf()));
          setError(e instanceof Error ? e.message : 'Could not delete the task');
        }
        return false;
      }
    },
    [takeOut, isMounted],
  );

  const streakOf = useCallback(
    (todo: Todo): StreakStats | null =>
      todo.is_repeat && !todo.is_done
        ? streakFor(history.get(seriesKey(todo)) ?? [], todo, todayISO())
        : null,
    [history],
  );

  /**
   * Stable identities that always reach the CURRENT load closure. The focus
   * effect in each screen holds one of these forever, so it must not close over
   * a stale copy. See core/useStableCallback for the bug this prevents.
   */
  const refresh = useStableCallback(() => load(true));
  const reload = useStableCallback(() => load(false));

  return {
    todos,
    loading,
    refreshing,
    error,
    clearError: () => setError(null),
    /**
     * Two refetch flavours, deliberately separate:
     *   refresh() - user pulled down, so SHOW the spinner.
     *   reload()  - silent background refetch (e.g. returning to the screen).
     */
    refresh,
    reload,
    complete,
    skip,
    wontDo,
    reopen,
    reschedule,
    remove,
    streakOf,
  };
}
