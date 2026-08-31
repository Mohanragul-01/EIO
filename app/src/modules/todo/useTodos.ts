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
import { useCallback, useEffect, useRef, useState } from 'react';

import { useStableCallback } from '../../core/useStableCallback';

import * as api from './api';
import type { Frequency, Todo } from './types';

export function useTodos(frequency: Frequency) {
  const [todos, setTodos] = useState<Todo[]>([]);
  // Starts true so the very first render shows a spinner rather than a
  // misleading "no tasks yet" empty state before the fetch resolves.
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Guards against setting state after the screen has been unmounted (e.g.
   * you navigate back mid-request). Doing so is a memory leak and logs a
   * warning; this is the standard React pattern for avoiding it.
   */
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /**
   * useCallback so this function keeps a stable identity between renders.
   * Without it, the useEffect below would see a "new" load function every
   * render and refetch in an infinite loop.
   */
  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError(null);

    try {
      const rows = await api.listTodosByFrequency(frequency);
      if (mounted.current) setTodos(rows);
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
    // Depends on the tab: switching tabs must produce a new loader, or the
    // effect below would keep refetching whichever tab was mounted first.
  }, [frequency]);

  useEffect(() => {
    setLoading(true);
    load();
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
  const complete = useCallback(async (todo: Todo) => {
    const snapshot = todos;
    setTodos((current) => current.filter((t) => t.id !== todo.id));

    try {
      const next = await api.completeTask(todo);
      if (next && mounted.current) {
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
      if (mounted.current) {
        setTodos(snapshot);
        setError(e instanceof Error ? e.message : 'Could not complete the task');
      }
      return null;
    }
  }, [todos]);

  /** Same idea: remove locally straight away, restore the row if the delete fails. */
  const remove = useCallback(
    async (todo: Todo) => {
      const snapshot = todos;
      setTodos((current) => current.filter((t) => t.id !== todo.id));

      try {
        await api.deleteTodo(todo.id);
      } catch (e) {
        setTodos(snapshot);
        setError(e instanceof Error ? e.message : 'Could not delete the task');
      }
    },
    [todos],
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
