/**
 * useLadderCards - every ladder, with where you stand on it.
 *
 * The phone's useLadders, composed again here for the same reason as
 * useSessionLog (an app hook would bring a second React with it). The rules
 * are progression.ts's: rung states, the progress ring's share of the goal,
 * and whether it is time to ask about moving up.
 */
import { useCallback, useMemo } from 'react';

import * as api from '@app/modules/fitness/api';
import type { SetFact } from '@app/modules/fitness/load';
import {
  goalProgress,
  readyToMoveUp,
  rungStates,
  type Rung,
} from '@app/modules/fitness/progression';
import type { Exercise } from '@app/modules/fitness/types';

import { useAsync } from '../../lib/useAsync';

export type LadderCard = {
  ladder: api.Ladder;
  rungs: Rung[];
  current: Rung | null;
  currentName: string | null;
  /** 0..1 from the best recent session on the current rung. */
  progress: number;
  ready: boolean;
};

type Loaded = { ladders: api.Ladder[]; exercises: Exercise[]; recent: Record<string, SetFact[][]> };

export function useLadderCards() {
  const load = useCallback(async (): Promise<Loaded> => {
    const [ladders, exercises] = await Promise.all([api.listLadders(), api.listExercises()]);
    // Every rung's exercise, so the ladder page can show a best per rung.
    const ids = [...new Set(ladders.flatMap((l) => l.steps.map((s) => s.exercise_id)))];
    const recent = await api.recentSessionSets(ids, 3);
    return { ladders, exercises, recent };
  }, []);
  const { data, loading, error, reload } = useAsync(load, 'fitness-ladders');

  const exerciseName = useMemo(() => {
    const names = new Map((data?.exercises ?? []).map((e) => [e.id, e.name]));
    return (id: string) => names.get(id) ?? 'Exercise';
  }, [data]);

  const cards = useMemo<LadderCard[]>(
    () =>
      (data?.ladders ?? []).map((ladder) => {
        const rungs = rungStates(ladder.steps, ladder.progression.current_step_id, ladder.moves);
        const current = rungs.find((r) => r.state === 'current') ?? null;
        const sessions = current ? (data?.recent[current.step.exercise_id] ?? []) : [];
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
    [data, exerciseName],
  );

  return {
    cards,
    exercises: data?.exercises ?? [],
    recent: data?.recent ?? {},
    exerciseName,
    loading: loading && !data,
    error,
    reload,
  };
}
