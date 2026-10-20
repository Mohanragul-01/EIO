/**
 * summary.ts - what a session added up to, for the finish screen.
 *
 * Three questions, in the order you ask them after a workout: what did I do,
 * was it better than last time, and did I stray from the plan (and should the
 * plan change to match)?
 */
import { toISODate } from '../../core/date';
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

/** How long an unfinished session of today's may sit with nothing logged before it is over. */
export const IDLE_END_MS = 3 * 60 * 60 * 1000;

/**
 * When a session's clock stops (epoch ms), or null while it is still running.
 * Finish stamps the end, but Finish is optional and an unfinished session
 * simply ends at its last set - once it is clearly over: it belongs to another
 * day, or nothing has been logged for three hours. Without this, opening last
 * week's session (or any from v2) showed a duration still counting up to now.
 */
export function sessionClockEnd(input: {
  endedAt: number | null;
  startedAt: number | null;
  lastSetAt: number | null;
  /** The session's day, 'YYYY-MM-DD'. */
  date: string;
  now: number;
}): number | null {
  if (input.endedAt !== null) return input.endedAt;
  const last = input.lastSetAt ?? input.startedAt;
  if (last === null) return null;
  const over = input.date !== toISODate(new Date(input.now)) || input.now - last > IDLE_END_MS;
  return over ? last : null;
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
  /**
   * Exercises whose working-set count differs from the routine's target. A
   * ladder slot's carries its ladder, since that is the slot to update.
   */
  setCounts: { exerciseId: string; from: number; to: number; progressionId: string | null }[];
};

type Slot = {
  exercise_id: string | null;
  progression_id?: string | null;
  target_sets: number | null;
};

type LadderShape = {
  progression: { id: string; current_step_id: string | null };
  steps: { id: string; exercise_id: string }[];
};

/**
 * A routine's slots as this session met them. A ladder slot names no
 * exercise, so it becomes the rung it was trained on - any rung of that
 * ladder logged in the session (the ladder may have moved on since), else its
 * current rung - keeping its ladder. Without this, every summary called the
 * rung an exercise "you added", and Update wrote it in as a fixed slot.
 */
export function resolveRoutineSlots(
  slots: Slot[],
  ladders: LadderShape[],
  trainedExerciseIds: string[],
): { exercise_id: string | null; progression_id: string | null; target_sets: number | null }[] {
  return slots.map((slot) => {
    const progressionId = slot.progression_id ?? null;
    if (slot.exercise_id || !progressionId) {
      return {
        exercise_id: slot.exercise_id,
        progression_id: progressionId,
        target_sets: slot.target_sets,
      };
    }
    const ladder = ladders.find((l) => l.progression.id === progressionId);
    const rungs = ladder?.steps ?? [];
    const trained = rungs.find((step) => trainedExerciseIds.includes(step.exercise_id));
    const current = rungs.find((step) => step.id === ladder?.progression.current_step_id);
    return {
      exercise_id: (trained ?? current)?.exercise_id ?? null,
      progression_id: progressionId,
      target_sets: slot.target_sets,
    };
  });
}

export function routineDeviation(
  slots: Slot[],
  blocks: { exerciseId: string; workingSets: number }[],
): Deviation {
  // The first slot for an exercise is its plan (a ladder whose rung is also
  // listed on its own shares that block when the session starts).
  const planned = new Map<string, { target: number | null; progressionId: string | null }>();
  for (const slot of slots) {
    if (slot.exercise_id && !planned.has(slot.exercise_id)) {
      planned.set(slot.exercise_id, {
        target: slot.target_sets,
        progressionId: slot.progression_id ?? null,
      });
    }
  }
  const done = new Map(blocks.map((b) => [b.exerciseId, b.workingSets]));

  return {
    added: blocks
      .filter((b) => b.workingSets > 0 && !planned.has(b.exerciseId))
      .map((b) => b.exerciseId),
    skipped: [...planned.keys()].filter((id) => (done.get(id) ?? 0) === 0),
    setCounts: blocks.flatMap((b) => {
      const plan = planned.get(b.exerciseId);
      return plan && plan.target != null && b.workingSets > 0 && b.workingSets !== plan.target
        ? [
            {
              exerciseId: b.exerciseId,
              from: plan.target,
              to: b.workingSets,
              progressionId: plan.progressionId,
            },
          ]
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
