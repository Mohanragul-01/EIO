/**
 * useTodos - the data-fetching hook for this module.
 *
 *  WHY A HOOK SITS BETWEEN THE SCREEN AND api.ts
 * api.ts knows how to talk to the database. It doesn't know about React.
 * A screen needs more than data: it needs loading state, error state, a way
 * to refresh, and re-renders when things change. That's what this hook adds.
 *
 * The plan allowed React Query or plain hooks. This is plain hooks
 * deliberately - one less library and one less mental model while you're
 * learning, and the whole thing is ~80 readable lines. If caching across
 * screens ever becomes a real need, this is the ONE file that would be
 * swapped for React Query; screens wouldn't change.
 */
import { useCallback, useEffect, useState } from 'react';

import { useLatestRun } from '../../core/useLatestRun';
import { useStableCallback } from '../../core/useStableCallback';

import * as api from './api';
import type { Frequency, Todo } from './types';

/**
 * Which slice of a frequency to load.
 *
 * 'done' is a SEPARATE query rather than a filter over one list, because
 * completed tasks are never deleted and outnumber open ones many times over.
 * Fetching both and hiding half would mean downloading a growing pile of
 * finished work on every visit to a screen that mostly shows open tasks.
 */
export type TodoStatus = 'open' | 'done';

export function useTodos(frequency: Frequency, status: TodoStatus = 'open') {
  const [todos, setTodos] = useState<Todo[]>([]);
  // Starts true so the very first render shows a spinner rather than a
  // misleading "no tasks yet" empty state before the fetch resolves.
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Guards against writing state after the screen is gone, AND against an
   * older request overwriting a newer one - pull to refresh while the first
   * load is still running and the slower answer used to win. See useLatestRun.
   */
  const { begin, isMounted } = useLatestRun();

  /**
   * useCallback so this function keeps a stable identity between renders.
   * Without it, the useEffect below would see a "new" load function every
   * render and refetch in an infinite loop.
   */
  const load = useCallback(
    async (isRefresh = false) => {
      const isCurrent = begin();
      // Owned by the loader rather than the effect, so every path that starts
      // a fetch shows the right indicator without the caller remembering to.
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const rows =
          status === 'done'
            ? await api.listCompletedByFrequency(frequency)
            : await api.listTodosByFrequency(frequency);
        if (isCurrent()) setTodos(rows);
      } catch (e) {
        if (isCurrent()) setError(e instanceof Error ? e.message : 'Something went wrong');
      } finally {
        if (isCurrent()) {
          setLoading(false);
          setRefreshing(false);
        }
      }
      // Depends on the tab AND the status: changing either must produce a new
      // loader, or the effect below would keep refetching whichever combination
      // was mounted first.
    },
    [frequency, status, begin],
  );

  useEffect(() => {
    // set-state-in-effect is aimed at effects that compute derived state; this
    // one starts a fetch, and a fetch has to be able to say it has started.
    // The cascading render it warns about is the spinner appearing, which is
    // the point. See the header for why this module uses plain hooks.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  /**
   * Complete a task, optimistically.
   *
   * The row leaves the list immediately rather than flipping a checkbox in
   * place: this list only ever shows open tasks, so a completed one no longer
   * belongs in it. Waiting for the round trip first would leave the task
   * sitting there looking unticked.
   *
   * A repeating task's successor is appended straight from the API response,
   * so the next occurrence appears without a refetch. It is re-sorted by due
   * date because it belongs wherever its new date puts it, which is usually
   * not the end of the list.
   */
  const complete = useCallback(
    async (todo: Todo) => {
      // Where it was, so a failure can put it back without restoring a whole
      // list snapshot - that would also undo anything else ticked or deleted
      // while this write was in flight, and ticking happens in bursts.
      let index = -1;
      setTodos((current) => {
        index = current.findIndex((t) => t.id === todo.id);
        // The row leaves whichever list it is in, because completing removes
        // it from Open and reopening removes it from Done. Same gesture, same
        // result from the list's point of view.
        return current.filter((t) => t.id !== todo.id);
      });

      const putBack = () =>
        setTodos((current) => {
          if (current.some((t) => t.id === todo.id)) return current;
          const restored = [...current];
          restored.splice(index < 0 ? restored.length : index, 0, todo);
          return restored;
        });

      if (todo.is_done) {
        try {
          await api.reopenTask(todo.id);
          return null;
        } catch (e) {
          if (isMounted()) {
            putBack();
            setError(e instanceof Error ? e.message : 'Could not reopen the task');
          }
          return null;
        }
      }

      try {
        const next = await api.completeTask(todo);
        // Only in the open list: a repeating task's successor is open, so it
        // does not belong in a list of finished work.
        if (next && isMounted() && status === 'open') {
          setTodos((current) =>
            [...current, next].sort((a, b) => {
              // Undated tasks sort last, matching the SQL ordering.
              if (!a.due_date) return 1;
              if (!b.due_date) return -1;
              return a.due_date.localeCompare(b.due_date);
            }),
          );
        }
        return next;
      } catch (e) {
        if (isMounted()) {
          putBack();
          setError(e instanceof Error ? e.message : 'Could not complete the task');
        }
        return null;
      }
    },
    [status, isMounted],
  );

  /** Same idea: remove locally straight away, restore the row if the delete fails. */
  const remove = useCallback(
    async (todo: Todo) => {
      let index = -1;
      setTodos((current) => {
        index = current.findIndex((t) => t.id === todo.id);
        return current.filter((t) => t.id !== todo.id);
      });

      try {
        await api.deleteTodo(todo.id);
      } catch (e) {
        if (!isMounted()) return;
        setTodos((current) => {
          if (current.some((t) => t.id === todo.id)) return current;
          const restored = [...current];
          restored.splice(index < 0 ? restored.length : index, 0, todo);
          return restored;
        });
        setError(e instanceof Error ? e.message : 'Could not delete the task');
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
    todos,
    loading,
    refreshing,
    error,
    /**
     * Two refetch flavours, deliberately separate:
     *   refresh() - user pulled down, so SHOW the spinner.
     *   reload()  - silent background refetch (e.g. returning to the screen).
     * Using refresh() for both made the pull-to-refresh spinner flash every
     * time you navigated back from the editor, which looks like a glitch.
     */
    refresh,
    reload,
    complete,
    remove,
  };
}
