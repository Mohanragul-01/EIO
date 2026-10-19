/**
 * summary.ts - what a session added up to, for the finish screen.
 *
 * Three questions, in the order you ask them after a workout: what did I do,
 * was it better than last time, and did I stray from the plan (and should the
 * plan change to match)?
 */
import { formatSetShort, isWorking, workingVolume, type SetFact } from './load';
import type { RecordHit } from './records';
import { estimatedOneRepMax, type Exercise } from './types';

type ExerciseShape = Pick<Exercise, 'load_mode' | 'tracking_type' | 'bodyweight_factor' | 'name'>;

export function sessionSummary(input: {
  sets: SetFact[];
  exercisesById: Record<string, ExerciseShape | undefined>;
  bodyweightKg: number | null;
  records: Record<string, RecordHit[]>;
  startedAt: string | null;
  endedAt: string | null;
}) {
  const start = input.startedAt ? Date.parse(input.startedAt) : NaN;
  const end = input.endedAt ? Date.parse(input.endedAt) : NaN;
  return {
    durationMs: Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, end - start) : null,
    volume: workingVolume(input.sets, input.exercisesById, input.bodyweightKg),
    workingSets: input.sets.filter(isWorking).length,
    records: input.sets.flatMap((set) =>
      (input.records[set.id] ?? []).slice(0, 1).map((hit) => ({
        exerciseId: set.exercise_id,
        setId: set.id,
        hit,
      })),
    ),
  };
}

/** How good a set is, comparably within one exercise. */
function strength(set: SetFact, exercise: ExerciseShape): number {
  if (set.duration_seconds !== null) return set.duration_seconds;
  if (exercise.load_mode === 'bodyweight') return set.reps ?? 0;
  return estimatedOneRepMax(set.weight_kg, set.reps ?? 0);
}

function bestOf(sets: SetFact[], exercise: ExerciseShape): SetFact | null {
  const working = sets.filter(isWorking);
  if (working.length === 0) return null;
  return working.reduce((best, set) =>
    strength(set, exercise) > strength(best, exercise) ? set : best,
  );
}

const short = (set: SetFact, exercise: ExerciseShape) =>
  formatSetShort({ ...set, band_id: null, side: null }, exercise);

export type Comparison = {
  exerciseId: string;
  name: string;
  change: 'up' | 'down' | 'same' | 'new';
  volumeDelta: number | null;
  best: string;
  lastBest: string | null;
};

/**
 * Each exercise in this session against the same exercise last time (the last
 * session of the same routine). "up" or "down" follows the best set; the
 * volume delta is a second opinion shown beside it.
 */
export function compareToLast(
  current: SetFact[],
  last: SetFact[] | null,
  exercisesById: Record<string, ExerciseShape | undefined>,
  bodyweightKg: number | null,
): Comparison[] {
  if (!last) return [];
  const order: string[] = [];
  current.forEach((s) => {
    if (!order.includes(s.exercise_id)) order.push(s.exercise_id);
  });

  return order.flatMap((exerciseId): Comparison[] => {
    const exercise = exercisesById[exerciseId];
    if (!exercise) return [];
    const mine = current.filter((s) => s.exercise_id === exerciseId);
    const theirs = last.filter((s) => s.exercise_id === exerciseId);
    const best = bestOf(mine, exercise);
    if (!best) return [];
    const lastBest = bestOf(theirs, exercise);

    if (!lastBest) {
      return [
        {
          exerciseId,
          name: exercise.name,
          change: 'new' as const,
          volumeDelta: null,
          best: short(best, exercise),
          lastBest: null,
        },
      ];
    }
    const a = strength(best, exercise);
    const b = strength(lastBest, exercise);
    const volumeDelta =
      Math.round(
        (workingVolume(mine, exercisesById, bodyweightKg) -
          workingVolume(theirs, exercisesById, bodyweightKg)) *
          10,
      ) / 10;
    return [
      {
        exerciseId,
        name: exercise.name,
        change: a > b ? ('up' as const) : a < b ? ('down' as const) : ('same' as const),
        volumeDelta,
        best: short(best, exercise),
        lastBest: short(lastBest, exercise),
      },
    ];
  });
}

export type Deviation = {
  /** Exercises done that the routine does not have. */
  added: string[];
  /** Routine exercises with no working sets today. */
  skipped: string[];
  /** Exercises whose working-set count differs from the routine's target. */
  setCounts: { exerciseId: string; from: number; to: number }[];
};

export function routineDeviation(
  slots: { exercise_id: string | null; target_sets: number | null }[],
  blocks: { exerciseId: string; workingSets: number }[],
): Deviation {
  const planned = new Map(
    slots.flatMap((slot) =>
      slot.exercise_id ? [[slot.exercise_id, slot.target_sets] as const] : [],
    ),
  );
  const done = new Map(blocks.map((b) => [b.exerciseId, b.workingSets]));

  return {
    added: blocks
      .filter((b) => b.workingSets > 0 && !planned.has(b.exerciseId))
      .map((b) => b.exerciseId),
    skipped: [...planned.keys()].filter((id) => (done.get(id) ?? 0) === 0),
    setCounts: blocks.flatMap((b) => {
      const target = planned.get(b.exerciseId);
      return target != null && b.workingSets > 0 && b.workingSets !== target
        ? [{ exerciseId: b.exerciseId, from: target, to: b.workingSets }]
        : [];
    }),
  };
}

/** The deviation in plain sentences, additions first. Empty when nothing changed. */
export function describeDeviation(dev: Deviation, names: Record<string, string>): string[] {
  const name = (id: string) => names[id] ?? 'an exercise';
  return [
    ...dev.added.map((id) => `You added ${name(id)}`),
    ...dev.setCounts.map(
      (c) => `You did ${c.to} sets of ${name(c.exerciseId)} instead of ${c.from}`,
    ),
    ...dev.skipped.map((id) => `You skipped ${name(id)}`),
  ];
}
