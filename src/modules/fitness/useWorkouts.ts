/**
 * useWorkouts - data plus the training summary.
 *
 * Same structure as the other module hooks. The derived data here is a
 * seven-day activity strip and a current streak, both computed from the rows
 * we already have - no extra queries.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useStableCallback } from '../../core/useStableCallback';

import { addDaysISO, todayISO } from '../../core/date';
import * as api from './api';
import type { Workout } from './types';

export type DayCell = {
  /** 'YYYY-MM-DD'. */
  date: string;
  /** Single-letter weekday label, e.g. 'M'. */
  label: string;
  count: number;
  isToday: boolean;
};

export function useWorkouts() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
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
      const rows = await api.listWorkouts();
      if (mounted.current) setWorkouts(rows);
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
    // Index by date once, so the loops below are lookups rather than repeated
    // scans of the whole array.
    const byDate = new Map<string, Workout[]>();
    workouts.forEach((w) => {
      const list = byDate.get(w.date) ?? [];
      list.push(w);
      byDate.set(w.date, list);
    });

    //  Last 7 days, oldest -> newest so it reads left to right
    const week: DayCell[] = [];
    const today = todayISO();
    for (let offset = -6; offset <= 0; offset += 1) {
      const date = addDaysISO(offset);
      week.push({
        date,
        // 'narrow' gives 'M', 'T', 'W'... which is all that fits in a 7-column
        // strip on a phone.
        label: new Date(date).toLocaleDateString(undefined, { weekday: 'narrow' }),
        count: byDate.get(date)?.length ?? 0,
        isToday: date === today,
      });
    }

    const weekWorkouts = week.flatMap((d) => byDate.get(d.date) ?? []);
    const weekSessions = weekWorkouts.length;

    // Sum only the durations that were actually recorded. Treating a null as
    // zero would make the total look right while quietly under-reporting.
    const weekMinutes = weekWorkouts.reduce((total, w) => total + (w.duration_minutes ?? 0), 0);

    /**
     * Current streak: consecutive days ending today (or yesterday) that have
     * at least one workout.
     *
     * Starting from yesterday when today is empty is deliberate - a streak
     * shouldn't visibly break at midnight just because you haven't trained
     * yet. It breaks when a full day passes with nothing.
     */
    let streak = 0;
    let cursor = byDate.has(today) ? 0 : -1;
    // Bounded loop: never walk back further than the data we fetched.
    for (let i = 0; i < 400; i += 1) {
      const date = addDaysISO(cursor);
      if (!byDate.has(date)) break;
      streak += 1;
      cursor -= 1;
    }

    return {
      week,
      weekSessions,
      weekMinutes,
      streak,
      totalSessions: workouts.length,
      /** Busiest single day in the strip, used to scale the bar heights. */
      weekMax: Math.max(1, ...week.map((d) => d.count)),
    };
  }, [workouts]);

  const remove = useCallback(
    async (workout: Workout) => {
      const snapshot = workouts;
      setWorkouts((current) => current.filter((w) => w.id !== workout.id));

      try {
        await api.deleteWorkout(workout.id);
      } catch (e) {
        setWorkouts(snapshot);
        setError(e instanceof Error ? e.message : 'Could not delete');
      }
    },
    [workouts],
  );


  /**
   * Stable identities that always reach the CURRENT load closure. The focus
   * effect in each screen holds one of these forever, so it must not close over
   * a stale copy. See core/useStableCallback for the bug this prevents.
   */
  const refresh = useStableCallback(() => load(true));
  const reload = useStableCallback(() => load(false));

  return {
    workouts,
    summary,
    loading,
    refreshing,
    error,
    refresh,
    reload,
    remove,
  };
}
