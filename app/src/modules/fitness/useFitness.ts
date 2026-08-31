/**
 * useFitness - the module's hooks, one per view.
 *
 * Four hooks in one file rather than four files: they are small, they share the
 * same api module, and splitting them would mean four near-identical loading
 * and error blocks in four places. The other modules have one hook each, which
 * is why theirs sit alone.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { addDaysISO, todayISO } from '../../core/date';
import { useStableCallback } from '../../core/useStableCallback';
import * as api from './api';
import {
  bmi,
  totalVolume,
  type BodyMetric,
  type Exercise,
  type Profile,
  type Routine,
  type SessionSet,
  type WorkoutSession,
} from './types';

/** One column of the seven-day strip. */
export type DayCell = {
  date: string;
  /** Single-letter weekday, which is all that fits in seven columns. */
  label: string;
  count: number;
  isToday: boolean;
};

/** Shared guard against setting state after unmount. */
function useMounted() {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
}

// HOME -------------------------------------------------------------------------

export function useFitnessHome() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [sets, setSets] = useState<SessionSet[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [metrics, setMetrics] = useState<BodyMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mounted = useMounted();

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    setError(null);

    try {
      // Sessions first, because the sets query needs their ids. Everything that
      // does not depend on that runs alongside it.
      const [sessionRows, profileRow, metricRows] = await Promise.all([
        api.listSessions(),
        api.getProfile(),
        api.listBodyMetrics(30),
      ]);

      // Only the last fortnight's sets: the strip covers seven days and the
      // volume figure covers the same window, so fetching every set ever would
      // be downloading a training history to render two numbers.
      const recentIds = sessionRows
        .filter((session) => session.date >= addDaysISO(-14))
        .map((session) => session.id);
      const setRows = await api.listRecentSets(recentIds);

      if (mounted.current) {
        setSessions(sessionRows);
        setSets(setRows);
        setProfile(profileRow);
        setMetrics(metricRows);
      }
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [mounted]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = useMemo(() => {
    const byDate = new Map<string, WorkoutSession[]>();
    sessions.forEach((session) => {
      const list = byDate.get(session.date) ?? [];
      list.push(session);
      byDate.set(session.date, list);
    });

    // Oldest to newest, so the strip reads left to right.
    const week: DayCell[] = [];
    const today = todayISO();
    for (let offset = -6; offset <= 0; offset += 1) {
      const date = addDaysISO(offset);
      week.push({
        date,
        label: new Date(date).toLocaleDateString(undefined, { weekday: 'narrow' }),
        count: byDate.get(date)?.length ?? 0,
        isToday: date === today,
      });
    }

    const weekSessionIds = new Set(
      week.flatMap((day) => (byDate.get(day.date) ?? []).map((s) => s.id)),
    );
    const weekSets = sets.filter((set) => weekSessionIds.has(set.session_id));

    /**
     * Consecutive days ending today, or yesterday if today is still empty.
     *
     * Starting from yesterday is deliberate: a streak should not visibly break
     * at midnight just because you have not trained yet today. It breaks when a
     * whole day passes with nothing.
     */
    let streak = 0;
    let cursor = byDate.has(today) ? 0 : -1;
    for (let i = 0; i < 400; i += 1) {
      if (!byDate.has(addDaysISO(cursor))) break;
      streak += 1;
      cursor -= 1;
    }

    const latestWeight = metrics[0]?.weight_kg ?? null;

    return {
      week,
      weekSessions: weekSessionIds.size,
      weekVolume: totalVolume(weekSets),
      streak,
      weekMax: Math.max(1, ...week.map((day) => day.count)),
      totalSessions: sessions.length,
      latestWeight,
      heightCm: profile?.height_cm ?? null,
      currentBmi: latestWeight ? bmi(latestWeight, profile?.height_cm ?? null) : null,
    };
  }, [sessions, sets, metrics, profile]);

  const refresh = useStableCallback(() => load(true));
  const reload = useStableCallback(() => load(false));

  return { sessions, summary, loading, refreshing, error, refresh, reload };
}

// PLAN: exercises and routines ---------------------------------------------------

export function usePlan() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mounted = useMounted();

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    setError(null);

    try {
      // Seeds the starter library only when there is nothing at all, then
      // returns whatever exists either way.
      const [exerciseRows, routineRows] = await Promise.all([
        api.seedDefaultExercisesIfEmpty(),
        api.listRoutines(),
      ]);
      if (mounted.current) {
        setExercises(exerciseRows);
        setRoutines(routineRows);
      }
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [mounted]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useStableCallback(() => load(true));
  const reload = useStableCallback(() => load(false));

  const addExercise = useCallback(
    async (name: string, muscleGroup: string | null) => {
      try {
        await api.createExercise({ name: name.trim(), muscle_group: muscleGroup });
        await load(false);
        return true;
      } catch (e) {
        setError(
          e instanceof Error && e.message.includes('duplicate')
            ? 'You already have an exercise with that name.'
            : 'Could not add the exercise',
        );
        return false;
      }
    },
    [load],
  );

  const removeExercise = useCallback(
    async (id: string) => {
      try {
        await api.deleteExercise(id);
        await load(false);
        return true;
      } catch (e) {
        // The api translates the foreign-key refusal into plain words already.
        setError(e instanceof Error ? e.message : 'Could not delete the exercise');
        return false;
      }
    },
    [load],
  );

  const removeRoutine = useCallback(
    async (id: string) => {
      try {
        await api.deleteRoutine(id);
        await load(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not delete the routine');
      }
    },
    [load],
  );

  return {
    exercises,
    routines,
    loading,
    refreshing,
    error,
    clearError: () => setError(null),
    refresh,
    reload,
    addExercise,
    removeExercise,
    removeRoutine,
  };
}

// BODY ---------------------------------------------------------------------------

export function useBody() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [metrics, setMetrics] = useState<BodyMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mounted = useMounted();

  const load = useCallback(async () => {
    setError(null);
    try {
      const [profileRow, metricRows] = await Promise.all([
        api.getProfile(),
        api.listBodyMetrics(),
      ]);
      if (mounted.current) {
        setProfile(profileRow);
        setMetrics(metricRows);
      }
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [mounted]);

  useEffect(() => {
    load();
  }, [load]);

  const saveHeight = useCallback(
    async (heightCm: number | null) => {
      try {
        await api.setHeight(heightCm);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save your height');
      }
    },
    [load],
  );

  const saveWeight = useCallback(
    async (date: string, weightKg: number) => {
      try {
        await api.recordWeight(date, weightKg);
        await load();
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save that weight');
        return false;
      }
    },
    [load],
  );

  const removeWeight = useCallback(
    async (id: string) => {
      const snapshot = metrics;
      setMetrics((current) => current.filter((m) => m.id !== id));
      try {
        await api.deleteBodyMetric(id);
      } catch (e) {
        setMetrics(snapshot);
        setError(e instanceof Error ? e.message : 'Could not delete that entry');
      }
    },
    [metrics],
  );

  /** BMI from the latest weight, computed rather than stored. See types.ts. */
  const currentBmi = useMemo(
    () => (metrics[0] ? bmi(metrics[0].weight_kg, profile?.height_cm ?? null) : null),
    [metrics, profile],
  );

  const reload = useStableCallback(() => load());

  return {
    profile,
    metrics,
    currentBmi,
    loading,
    error,
    clearError: () => setError(null),
    reload,
    saveHeight,
    saveWeight,
    removeWeight,
  };
}
