/**
 * useWorkoutSession - one training session being logged.
 *
 * Kept apart from the other hooks because it is the only stateful one: it holds
 * a session that is in progress, not a list that is being read.
 *
 * PR DETECTION LIVES HERE, not in the api and not in the screen. The api layer
 * knows nothing about what counts as a record, and the screen should render a
 * badge rather than decide one. The comparison itself is a pure function in
 * types.ts, so the rule is testable without a session, a network or a clock.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import * as api from './api';
import {
  isPersonalRecord,
  totalVolume,
  type Exercise,
  type SessionSet,
  type SetInput,
  type WorkoutSession,
} from './types';

/** Recorded per exercise, so the badge shows against the right block. */
export type PrFlag = { setId: string; previousBest: number | null };

export function useWorkoutSession(sessionId: string) {
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [sets, setSets] = useState<SessionSet[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  /** Exercise ids present in this session, in the order they were added. */
  const [order, setOrder] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Set ids that beat a previous best, so the badge survives a re-render. */
  const [prs, setPrs] = useState<Record<string, PrFlag>>({});

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [setRows, exerciseRows, sessionRows] = await Promise.all([
        api.listSessionSets(sessionId),
        api.listExercises(),
        api.listSessions(),
      ]);

      if (!mounted.current) return;

      setSets(setRows);
      setExercises(exerciseRows);
      setSession(sessionRows.find((s) => s.id === sessionId) ?? null);

      // Seed the block order from whatever is already logged, so reopening a
      // session shows its exercises in the order they were worked, not the
      // order the library happens to be sorted in.
      setOrder((current) => {
        if (current.length > 0) return current;
        const seen: string[] = [];
        setRows.forEach((set) => {
          if (!seen.includes(set.exercise_id)) seen.push(set.exercise_id);
        });
        return seen;
      });
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  /** Pre-fill the block list from a routine, without logging anything yet. */
  const setExerciseOrder = useCallback((ids: string[]) => {
    setOrder((current) => [...current, ...ids.filter((id) => !current.includes(id))]);
  }, []);

  const addExerciseToSession = useCallback((exerciseId: string) => {
    setOrder((current) =>
      current.includes(exerciseId) ? current : [...current, exerciseId],
    );
  }, []);

  /**
   * Log a set, and report whether it was a personal record.
   *
   * The history is fetched EXCLUDING this session, so a set is never compared
   * against itself or against earlier sets from the same workout. Without that,
   * your second set of the day would be measured against your first rather than
   * against your actual best, and a light back-off set would look like a
   * regression while a first set would always look like a record.
   */
  const logSet = useCallback(
    async (input: Omit<SetInput, 'set_number'>): Promise<PrFlag | null> => {
      // Set numbers count within the exercise, not the session: "set 3" means
      // the third set of that lift, which is what a training log means by it.
      const existing = sets.filter((set) => set.exercise_id === input.exercise_id);
      const setNumber = existing.length + 1;

      try {
        const history = await api.listExerciseHistory(input.exercise_id, sessionId);
        const beatsPrevious = isPersonalRecord(history, {
          exercise_id: input.exercise_id,
          reps: input.reps,
          weight_kg: input.weight_kg,
        });

        const saved = await api.addSet(sessionId, { ...input, set_number: setNumber });
        if (!mounted.current) return null;

        setSets((current) => [...current, saved]);
        addExerciseToSession(input.exercise_id);

        if (!beatsPrevious) return null;

        const previousBest = Math.max(
          ...history
            .filter((h) => h.reps === input.reps)
            .map((h) => h.weight_kg),
        );
        const flag: PrFlag = { setId: saved.id, previousBest };
        setPrs((current) => ({ ...current, [saved.id]: flag }));
        return flag;
      } catch (e) {
        if (mounted.current) {
          setError(e instanceof Error ? e.message : 'Could not save that set');
        }
        return null;
      }
    },
    [sets, sessionId, addExerciseToSession],
  );

  const removeSet = useCallback(async (id: string) => {
    const snapshot = sets;
    setSets((current) => current.filter((set) => set.id !== id));

    try {
      await api.deleteSet(id);
    } catch (e) {
      setSets(snapshot);
      setError(e instanceof Error ? e.message : 'Could not delete that set');
    }
  }, [sets]);

  const saveNotes = useCallback(
    async (notes: string) => {
      try {
        await api.updateSession(sessionId, { notes });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save your notes');
      }
    },
    [sessionId],
  );

  /** Sets grouped under the exercise they belong to, in block order. */
  const blocks = useMemo(
    () =>
      order.map((exerciseId) => ({
        exercise: exercises.find((e) => e.id === exerciseId) ?? null,
        exerciseId,
        sets: sets
          .filter((set) => set.exercise_id === exerciseId)
          .sort((a, b) => a.set_number - b.set_number),
      })),
    [order, exercises, sets],
  );

  const volume = useMemo(() => totalVolume(sets), [sets]);

  return {
    session,
    blocks,
    exercises,
    sets,
    volume,
    prs,
    loading,
    error,
    clearError: () => setError(null),
    reload: load,
    setExerciseOrder,
    addExerciseToSession,
    logSet,
    removeSet,
    saveNotes,
  };
}
