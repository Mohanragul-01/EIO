/**
 * ladderHistory.ts - a ladder over time.
 *
 * progression.ts says where you stand now; this says how you got there: the
 * rung you were on each day you moved (the step chart), your best recent
 * attempt at a rung, and the latest moves across all your ladders - the
 * calisthenics answer to "am I getting anywhere?". All of it is read from the
 * moves; nothing here is stored.
 */
import { goalProgress } from './progression';
import { isWorking, netLoad, type SetFact } from './load';
import type { Progression, ProgressionMove, ProgressionStep } from './types';

const byPosition = (a: ProgressionStep, b: ProgressionStep) => a.position - b.position;
const oldestFirst = (a: ProgressionMove, b: ProgressionMove) =>
  a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at);

/**
 * The rung number you were on after each day's moves, oldest first. Several
 * moves in one day (up, then straight back) make one point: where the day
 * ended. A move to a rung that has since been taken out of the ladder has no
 * number to plot and is left out.
 */
export function ladderPositions(
  steps: ProgressionStep[],
  moves: ProgressionMove[],
): { date: string; number: number }[] {
  const numbers = new Map([...steps].sort(byPosition).map((s, i) => [s.id, i + 1]));
  const out: { date: string; number: number }[] = [];
  for (const move of [...moves].sort(oldestFirst)) {
    const number = numbers.get(move.to_step_id);
    if (number === undefined) continue;
    const last = out[out.length - 1];
    if (last?.date === move.date) last.number = number;
    else out.push({ date: move.date, number });
  }
  return out;
}

/**
 * The step chart's points: the positions, carried on to today so the line
 * shows how long you have been on the rung you are on now.
 */
export function stepSeries(
  positions: { date: string; number: number }[],
  today: string,
): { date: string; number: number }[] {
  const last = positions[positions.length - 1];
  return last && last.date < today
    ? [...positions, { date: today, number: last.number }]
    : positions;
}

export type RungBest = { kind: 'reps' | 'hold'; value: number; date: string };

/**
 * Each rung's best ever, with the day it was set: the most reps, or for a
 * held rung the longest hold. Only working sets without assistance count -
 * a band-assisted set is not the rung itself - though added weight does.
 * Null for a rung never trained.
 */
export function rungBests(
  steps: ProgressionStep[],
  sets: (SetFact & { date: string })[],
): Record<string, RungBest | null> {
  const out: Record<string, RungBest | null> = {};
  for (const step of steps) {
    const hold = step.goal_seconds !== null;
    let best: RungBest | null = null;
    for (const set of sets) {
      if (set.exercise_id !== step.exercise_id || !isWorking(set) || netLoad(set) < 0) continue;
      const value = (hold ? set.duration_seconds : set.reps) ?? 0;
      if (value > 0 && (!best || value > best.value)) {
        best = { kind: hold ? 'hold' : 'reps', value, date: set.date };
      }
    }
    out[step.id] = best;
  }
  return out;
}

/**
 * The best recent session's top sets against a rung's goal - "8 · 7 · 6", or
 * "25s · 20s" for a hold - so the goal and how close you came read side by
 * side. "Best" is the session closest to the goal (goalProgress), and its
 * sets are listed largest first, as many as the goal asks for.
 */
export function bestAttempt(step: ProgressionStep, sessions: SetFact[][]): string | null {
  const timed = step.goal_seconds !== null;
  let best: number[] = [];
  let bestScore = -1;
  for (const sets of sessions) {
    const score = goalProgress(step, sets);
    if (score <= bestScore) continue;
    bestScore = score;
    best = sets
      .filter((s) => s.exercise_id === step.exercise_id && s.set_type !== 'warmup')
      .map((s) => (timed ? (s.duration_seconds ?? 0) : (s.reps ?? 0)))
      .sort((a, b) => b - a)
      .slice(0, step.goal_sets);
  }
  if (best.length === 0) return null;
  return best.map((v) => (timed ? `${v}s` : String(v))).join(' · ');
}

export type TimelineEntry = {
  id: string;
  progressionId: string;
  date: string;
  kind: ProgressionMove['kind'];
  /** The rung's exercise, or null when the rung has since been removed. */
  fromExerciseId: string | null;
  toExerciseId: string | null;
};

type LadderShape = { progression: Progression; steps: ProgressionStep[]; moves: ProgressionMove[] };

/**
 * Moves across every ladder, newest first. By default only moves up: they
 * are the progress, and a timeline that also lists every step back and every
 * start reads as noise.
 */
export function moveTimeline(
  ladders: LadderShape[],
  options: { kinds?: ProgressionMove['kind'][]; limit?: number } = {},
): TimelineEntry[] {
  const kinds = options.kinds ?? ['up'];
  const entries = ladders.flatMap(({ progression, steps, moves }) => {
    const exerciseOf = (id: string | null) => steps.find((s) => s.id === id)?.exercise_id ?? null;
    return moves
      .filter((m) => kinds.includes(m.kind))
      .map((m) => ({ move: m, progressionId: progression.id, exerciseOf }));
  });
  return entries
    .sort((a, b) => oldestFirst(b.move, a.move))
    .slice(0, options.limit ?? Infinity)
    .map(({ move, progressionId, exerciseOf }) => ({
      id: move.id,
      progressionId,
      date: move.date,
      kind: move.kind,
      fromExerciseId: exerciseOf(move.from_step_id),
      toExerciseId: exerciseOf(move.to_step_id),
    }));
}
