/**
 * useLadders - every ladder, with where you stand on each.
 *
 * Reads the ladders, the library (for rung names) and your recent sessions on
 * each current rung, and hands the screens ready-made answers: which step you
 * are on, how close the last session came to its goal, and whether it is time
 * to ask about moving up. The rules are in progression.ts.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useLatestRun } from '../../core/useLatestRun';
import { useStableCallback } from '../../core/useStableCallback';
import * as api from './api';
import { rungBests, type RungBest } from './ladderHistory';
import type { SetFact } from './load';
import { goalProgress, readyToMoveUp, rungStates, type Rung } from './progression';
import type { Exercise, ProgressionFamily, ProgressionStep } from './types';

export const FAMILY_LABEL: Record<ProgressionFamily, string> = {
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
  core: 'Core',
  balance: 'Balance',
  statics: 'Statics',
  other: 'Other',
};

export const FAMILIES: ProgressionFamily[] = [
  'push',
  'pull',
  'legs',
  'core',
  'balance',
  'statics',
  'other',
];

export type LadderCard = {
  ladder: api.Ladder;
  rungs: Rung[];
  current: Rung | null;
  /** Rung name for the current step. */
  currentName: string | null;
  /** 0..1 from the best recent session on the current rung. */
  progress: number;
  ready: boolean;
};

export function useLadders() {
  const [ladders, setLadders] = useState<api.Ladder[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [recent, setRecent] = useState<Record<string, SetFact[][]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { begin } = useLatestRun();

  const load = useCallback(async () => {
    const isCurrent = begin();
    setError(null);
    try {
      const [ladderRows, exerciseRows] = await Promise.all([
        api.listLadders(),
        api.listExercises(),
      ]);
      // Every rung's exercise, so the ladder screen can show a best per rung.
      const ids = [...new Set(ladderRows.flatMap((l) => l.steps.map((s) => s.exercise_id)))];
      const recentRows = await api.recentSessionSets(ids, 3);
      if (!isCurrent()) return;
      setLadders(ladderRows);
      setExercises(exerciseRows);
      setRecent(recentRows);
    } catch (e) {
      if (isCurrent()) setError(e instanceof Error ? e.message : 'Could not load your ladders');
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [begin]);

  useEffect(() => {
    // Starts a fetch rather than computing derived state - see useTodos.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const reload = useStableCallback(() => load());

  const exerciseName = useMemo(() => {
    const names = new Map(exercises.map((e) => [e.id, e.name]));
    return (id: string) => names.get(id) ?? 'Exercise';
  }, [exercises]);

  const cards = useMemo<LadderCard[]>(
    () =>
      ladders.map((ladder) => {
        const rungs = rungStates(ladder.steps, ladder.progression.current_step_id, ladder.moves);
        const current = rungs.find((r) => r.state === 'current') ?? null;
        const sessions = current ? (recent[current.step.exercise_id] ?? []) : [];
        const progress = current
          ? Math.max(0, ...sessions.map((sets) => goalProgress(current.step, sets)))
          : 0;
        const isLast = current ? current.number === rungs.length : true;
        return {
          ladder,
          rungs,
          current,
          currentName: current ? exerciseName(current.step.exercise_id) : null,
          progress,
          ready:
            !!current &&
            !isLast &&
            !ladder.progression.paused_at &&
            readyToMoveUp(current.step, sessions, ladder.progression.level_up_rule),
        };
      }),
    [ladders, recent, exerciseName],
  );

  return { cards, exercises, recent, exerciseName, loading, error, reload };
}

/**
 * Each rung's best ever - most reps, or longest hold - for one ladder's page
 * (ladderHistory.ts rungBests). Its own hook because it reads every set of
 * every rung, which the Skills tab has no need for.
 */
export function useRungBests(steps: ProgressionStep[]) {
  const [sets, setSets] = useState<(SetFact & { date: string })[]>([]);
  const { begin } = useLatestRun();
  // The rungs' exercises as a value, so a reload that returns the same
  // ladder does not fetch again.
  const key = [...new Set(steps.map((s) => s.exercise_id))].sort().join(',');

  const load = useCallback(async () => {
    const isCurrent = begin();
    try {
      const rows = await api.listRungSets(key ? key.split(',') : []);
      if (isCurrent()) setSets(rows);
    } catch {
      // The bests are extra: without them each rung still shows its goal.
    }
  }, [begin, key]);

  useEffect(() => {
    // Starts a fetch rather than computing derived state - see useTodos.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const bests = useMemo<Record<string, RungBest | null>>(
    () => rungBests(steps, sets),
    [steps, sets],
  );
  const reload = useStableCallback(() => load());
  return { bests, reload };
}
