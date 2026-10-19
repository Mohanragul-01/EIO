/**
 * progression.ts - ladders: the calisthenics unit of progress.
 *
 * A ladder is a sequence of rungs ("scapular pull, negative, pull-up, +10 kg"),
 * each an ordinary library exercise with a graduation goal. Without ladders,
 * switching to a harder variation just looks like your reps collapsed.
 *
 * WHICH RUNGS ARE MASTERED IS DERIVED, never stored: everything before the
 * current rung is behind you, everything after is locked, and the date a rung
 * was mastered is the date you moved up from it. Stepping back simply moves
 * the current rung; there is no second copy of the state to fall out of step.
 *
 * MOVING UP IS ALWAYS YOUR CALL. These rules only decide when to ask - after
 * two of your last three sessions on a rung met its goal with clean sets
 * (or one, if the ladder says so). Apps that move people silently are the
 * ones people complain about.
 */
import { isWorking, netLoad, type SetFact } from './load';
import type { Progression, ProgressionMove, ProgressionStep } from './types';

export type RungState = 'mastered' | 'current' | 'locked';

export type Rung = {
  step: ProgressionStep;
  /** 1-based, for "Step 4 of 7". */
  number: number;
  state: RungState;
  /** When you moved up from it; null if never (or skipped by starting higher). */
  masteredOn: string | null;
};

const byPosition = (a: ProgressionStep, b: ProgressionStep) => a.position - b.position;

export function rungStates(
  steps: ProgressionStep[],
  currentStepId: string | null,
  moves: ProgressionMove[],
): Rung[] {
  const ordered = [...steps].sort(byPosition);
  const currentIndex = ordered.findIndex((s) => s.id === currentStepId);

  return ordered.map((step, index) => {
    const state: RungState =
      currentIndex < 0
        ? 'locked'
        : index < currentIndex
          ? 'mastered'
          : index === currentIndex
            ? 'current'
            : 'locked';
    // The latest move up FROM this rung, if any.
    const up = moves
      .filter((m) => m.kind === 'up' && m.from_step_id === step.id)
      .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))[0];
    return {
      step,
      number: index + 1,
      state,
      masteredOn: state === 'mastered' && up ? up.date : null,
    };
  });
}

/** The value a set is measured by against this rung's goal. */
function measured(step: ProgressionStep, set: SetFact): number {
  return step.goal_seconds !== null ? (set.duration_seconds ?? 0) : (set.reps ?? 0);
}

/**
 * The sets that can count toward a rung: this rung's exercise, working sets,
 * marked clean, not assisted (help below bodyweight proves nothing about the
 * rung), and carrying the goal's added weight if it has one.
 */
function qualifying(step: ProgressionStep, sets: SetFact[]): SetFact[] {
  return sets.filter(
    (s) =>
      s.exercise_id === step.exercise_id &&
      isWorking(s) &&
      s.clean &&
      netLoad(s) >= (step.goal_added_kg ?? 0),
  );
}

/** Whether one session's sets meet the rung's goal. */
export function meetsGoal(step: ProgressionStep, sets: SetFact[]): boolean {
  const goal = step.goal_seconds ?? step.goal_reps ?? Infinity;
  return qualifying(step, sets).filter((s) => measured(step, s) >= goal).length >= step.goal_sets;
}

/**
 * Whether to ask "ready to move up?". `sessions` is each recent session's
 * sets, newest first; sessions that did not train this rung are skipped.
 */
export function readyToMoveUp(
  step: ProgressionStep,
  sessions: SetFact[][],
  rule: Progression['level_up_rule'],
): boolean {
  const onRung = sessions.filter((sets) => sets.some((s) => s.exercise_id === step.exercise_id));
  if (rule === 'one') return onRung.length > 0 && meetsGoal(step, onRung[0]);
  return onRung.slice(0, 3).filter((sets) => meetsGoal(step, sets)).length >= 2;
}

/**
 * How close a session came to the goal, 0 to 1, for the progress ring: the
 * average share of the goal over the goal number of best sets, each capped at
 * the goal so one huge set cannot fill the ring on its own.
 */
export function goalProgress(step: ProgressionStep, sets: SetFact[]): number {
  const goal = step.goal_seconds ?? step.goal_reps;
  if (!goal || step.goal_sets <= 0) return 0;
  const shares = qualifying(step, sets)
    .map((s) => Math.min(1, measured(step, s) / goal))
    .sort((a, b) => b - a)
    .slice(0, step.goal_sets);
  return shares.reduce((sum, share) => sum + share, 0) / step.goal_sets;
}

export function stepLabel(number: number, total: number, name: string): string {
  return `Step ${number}/${total} · ${name}`;
}

/** The rungs either side of the current one. With no current rung, the first is next. */
export function neighbours(
  steps: ProgressionStep[],
  currentStepId: string | null,
): { previous: ProgressionStep | null; next: ProgressionStep | null } {
  const ordered = [...steps].sort(byPosition);
  const index = ordered.findIndex((s) => s.id === currentStepId);
  if (index < 0) return { previous: null, next: ordered[0] ?? null };
  return { previous: ordered[index - 1] ?? null, next: ordered[index + 1] ?? null };
}

/** "3 × 8", "3 × 30s", "3 × 5 · +10 kg". */
export function goalLabel(step: ProgressionStep): string {
  const each = step.goal_seconds !== null ? `${step.goal_seconds}s` : String(step.goal_reps ?? 0);
  const weight = step.goal_added_kg ? ` · +${step.goal_added_kg} kg` : '';
  return `${step.goal_sets} × ${each}${weight}`;
}

type LadderShape = { progression: Progression; steps: ProgressionStep[]; moves: ProgressionMove[] };

export type LevelUpCandidate = {
  progressionId: string;
  name: string;
  from: ProgressionStep;
  to: ProgressionStep;
};

/**
 * The ladders to ask "ready to move up?" about after a session: those whose
 * current rung was trained in it, is not the top rung, is not paused, and
 * meets the ladder's rule counting this session first. `history` is each
 * exercise's EARLIER sessions, newest first.
 */
export function levelUpCandidates(
  ladders: LadderShape[],
  sessionSets: SetFact[],
  history: Record<string, SetFact[][]>,
): LevelUpCandidate[] {
  return ladders.flatMap((ladder) => {
    const { progression } = ladder;
    if (progression.paused_at) return [];
    const { next } = neighbours(ladder.steps, progression.current_step_id);
    const current = ladder.steps.find((s) => s.id === progression.current_step_id);
    if (!current || !next) return [];
    const today = sessionSets.filter((s) => s.exercise_id === current.exercise_id);
    if (today.length === 0) return [];
    const sessions = [today, ...(history[current.exercise_id] ?? [])];
    return readyToMoveUp(current, sessions, progression.level_up_rule)
      ? [{ progressionId: progression.id, name: progression.name, from: current, to: next }]
      : [];
  });
}

/**
 * What a routine slot that follows a ladder aims for on its current rung: the
 * rung's goal as the top of the range and its restart point as the bottom.
 */
export function ladderSlotTarget(step: ProgressionStep): {
  target_sets: number;
  target_reps_min: number | null;
  target_reps: number | null;
  target_seconds_min: number | null;
  target_seconds_max: number | null;
} {
  return {
    target_sets: step.goal_sets,
    target_reps_min: step.goal_reps !== null ? step.start_reps : null,
    target_reps: step.goal_reps,
    target_seconds_min: step.goal_seconds !== null ? step.start_seconds : null,
    target_seconds_max: step.goal_seconds,
  };
}
