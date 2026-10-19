/**
 * useToday - the data behind the Today view: what is overdue, what is due
 * today, what was closed today, and how each routine's streak stands.
 *
 * Same shape as useTodos: plain hooks over api.ts, a ticket so an older fetch
 * cannot overwrite a newer one, and optimistic writes that put back ONLY their
 * own row if the server says no - ticking happens in bursts, and restoring a
 * whole-list snapshot would undo the other ticks made meanwhile.
 */
import { useCallback, useMemo, useState } from 'react';

import { todayISO } from '../../core/date';
import { useLatestRun } from '../../core/useLatestRun';
import { useStableCallback } from '../../core/useStableCallback';

import * as api from './api';
import { groupBySeries, streakFor, type HistoryRow, type StreakStats } from './streaks';
import { buildToday } from './today';
import { seriesKey, type Outcome, type Todo } from './types';

type State = {
  today: string;
  open: Todo[];
  closedToday: Todo[];
  next: Todo | null;
  history: Map<string, HistoryRow[]>;
};

const EMPTY: State = {
  today: todayISO(),
  open: [],
  closedToday: [],
  next: null,
  history: new Map(),
};

/** The series keys worth fetching history for: repeating tasks only. */
export function repeatingKeys(rows: readonly Todo[]): string[] {
  return [...new Set(rows.filter((t) => t.is_repeat).map(seriesKey))];
}

/** A row as it looks once closed, for showing it before the server answers. */
export function closedCopy(todo: Todo, outcome: Outcome): Todo {
  return { ...todo, is_done: true, outcome, completed_at: new Date().toISOString() };
}

export function useToday() {
  const [state, setState] = useState<State>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { begin, isMounted } = useLatestRun();

  /**
   * Fetch. There is no mount effect calling this: the page calls reload() from
   * useFocusEffect, which also runs when it mounts inside a focused screen, so
   * a second trigger here would only fetch everything twice.
   */
  const load = useCallback(
    async () => {
      const isCurrent = begin();
      try {
        const today = todayISO();
        const { open, closedToday, next } = await api.listToday(today);
        // History is decoration: without it the list still works, so its
        // failure costs the streak chips rather than the screen.
        let history = new Map<string, HistoryRow[]>();
        try {
          history = groupBySeries(await api.listSeriesHistory(repeatingKeys([...open, ...closedToday])));
        } catch {
          // Keep the empty map.
        }
        if (isCurrent()) {
          setState({ today, open, closedToday, next, history });
          setError(null);
        }
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

  const sections = useMemo(
    () => buildToday(state.open, state.closedToday, state.today),
    [state.open, state.closedToday, state.today],
  );

  /**
   * Close a task as done or skipped. The row moves to "Completed today" at
   * once; a repeat's successor is not shown here, because it is due after
   * today by construction. Resolves the successor (for Undo) or null, and
   * false if the write failed.
   */
  const close = useCallback(
    async (todo: Todo, outcome: 'done' | 'skipped'): Promise<Todo | null | false> => {
      setState((s) => ({
        ...s,
        open: s.open.filter((t) => t.id !== todo.id),
        closedToday: [closedCopy(todo, outcome), ...s.closedToday.filter((t) => t.id !== todo.id)],
      }));
      try {
        return await api.completeTask(todo, outcome);
      } catch (e) {
        if (isMounted()) {
          setState((s) => ({
            ...s,
            open: s.open.some((t) => t.id === todo.id) ? s.open : [...s.open, todo],
            closedToday: s.closedToday.filter((t) => t.id !== todo.id),
          }));
          setError(e instanceof Error ? e.message : 'Could not update the task');
        }
        return false;
      }
    },
    [isMounted],
  );

  const complete = useCallback((todo: Todo) => close(todo, 'done'), [close]);
  const skip = useCallback((todo: Todo) => close(todo, 'skipped'), [close]);

  /** Abandon a one-off. Leaves the view; reopenable from Completed. */
  const wontDo = useCallback(
    async (todo: Todo): Promise<boolean> => {
      setState((s) => ({ ...s, open: s.open.filter((t) => t.id !== todo.id) }));
      try {
        await api.wontDoTask(todo);
        return true;
      } catch (e) {
        if (isMounted()) {
          setState((s) => (s.open.some((t) => t.id === todo.id) ? s : { ...s, open: [...s.open, todo] }));
          setError(e instanceof Error ? e.message : 'Could not update the task');
        }
        return false;
      }
    },
    [isMounted],
  );

  /**
   * Reopen - the Undo after a tick or skip, or a tap in "Completed today".
   * api.reopenTask also removes the occurrence the tick created.
   */
  const reopen = useCallback(
    async (todo: Todo): Promise<boolean> => {
      const reopened: Todo = { ...todo, is_done: false, outcome: null, completed_at: null };
      setState((s) => ({
        ...s,
        closedToday: s.closedToday.filter((t) => t.id !== todo.id),
        open: s.open.some((t) => t.id === todo.id) ? s.open : [...s.open, reopened],
      }));
      try {
        const { removed } = await api.reopenTask(todo.id);
        if (isMounted() && removed.length > 0) {
          setState((s) => ({ ...s, open: s.open.filter((t) => !removed.includes(t.id)) }));
        }
        return true;
      } catch (e) {
        if (isMounted()) {
          setState((s) => ({
            ...s,
            open: s.open.filter((t) => t.id !== todo.id),
            // The Undo path passes the row as it was before the tick (open),
            // so it goes back as a closed copy.
            closedToday: s.closedToday.some((t) => t.id === todo.id)
              ? s.closedToday
              : [todo.is_done ? todo : closedCopy(todo, 'done'), ...s.closedToday],
          }));
          setError(e instanceof Error ? e.message : 'Could not reopen the task');
        }
        return false;
      }
    },
    [isMounted],
  );

  /**
   * Move tasks to another day (or none) - one task from its menu, or the
   * whole Overdue section at once. Those moved past today leave the view, and
   * those moved back into it (an Undo) return, so the list is rebuilt from
   * the given rows rather than only edited in place.
   */
  const reschedule = useCallback(
    async (tasks: Todo[], dueDate: string | null): Promise<boolean> => {
      const ids = new Set(tasks.map((t) => t.id));
      const inView = (t: Todo, today: string) => t.due_date !== null && t.due_date <= today;
      setState((s) => ({
        ...s,
        open: [
          ...s.open.filter((t) => !ids.has(t.id)),
          ...tasks.map((t) => ({ ...t, due_date: dueDate })),
        ].filter((t) => inView(t, s.today)),
      }));
      try {
        await api.rescheduleTasks([...ids], dueDate);
        return true;
      } catch (e) {
        if (isMounted()) {
          setState((s) => ({
            ...s,
            open: [...s.open.filter((t) => !ids.has(t.id)), ...tasks].filter((t) => inView(t, s.today)),
          }));
          setError(e instanceof Error ? e.message : 'Could not move the tasks');
        }
        return false;
      }
    },
    [isMounted],
  );

  const remove = useCallback(
    async (todo: Todo): Promise<boolean> => {
      setState((s) => ({
        ...s,
        open: s.open.filter((t) => t.id !== todo.id),
        closedToday: s.closedToday.filter((t) => t.id !== todo.id),
      }));
      try {
        await api.deleteTodo(todo.id);
        return true;
      } catch (e) {
        if (isMounted()) {
          setState((s) =>
            todo.is_done
              ? { ...s, closedToday: [todo, ...s.closedToday] }
              : { ...s, open: [...s.open, todo] },
          );
          setError(e instanceof Error ? e.message : 'Could not delete the task');
        }
        return false;
      }
    },
    [isMounted],
  );

  /** A repeating task's streak, from its series' history. */
  const streakOf = useCallback(
    (todo: Todo): StreakStats | null =>
      todo.is_repeat
        ? streakFor(state.history.get(seriesKey(todo)) ?? [], todo.is_done ? null : todo, state.today)
        : null,
    [state.history, state.today],
  );

  const refresh = useStableCallback(() => {
    setRefreshing(true);
    return load();
  });
  const reload = useStableCallback(() => load());

  return {
    today: state.today,
    sections,
    next: state.next,
    loading,
    refreshing,
    error,
    clearError: () => setError(null),
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
