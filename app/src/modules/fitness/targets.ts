/**
 * targets.ts - what to aim for next time, by double progression.
 *
 * Work up through a rep range at one weight; when every working set reaches
 * the top of the range, add weight (the slot's increment, else 2.5 kg) and
 * start again at the bottom. Bodyweight work adds a rep, holds add five
 * seconds. After more than two weeks away the suggestion is to repeat last
 * time, not to push on - detraining is real, and a missed rep after a break
 * is a bad way to come back.
 *
 * Every suggestion that differs from "same as last time" carries its reason,
 * shown beside the exercise, so the numbers in the cells never look arbitrary.
 */
import { fromISODate } from '../../core/date';
import { isWorking, netLoad, type SetFact } from './load';
import type { Exercise } from './types';

export type Target = {
  weight: number | null;
  reps: number | null;
  seconds: number | null;
  reason: string | null;
};

export type SlotRange = {
  repsMin: number | null;
  repsMax: number | null;
  secondsMin: number | null;
  secondsMax: number | null;
  incrementKg: number | null;
};

const DEFAULT_INCREMENT = 2.5;
const BREAK_DAYS = 14;

const NONE: Target = { weight: null, reps: null, seconds: null, reason: null };

function daysBetween(from: string, to: string): number {
  return Math.round((fromISODate(to).getTime() - fromISODate(from).getTime()) / 86_400_000);
}

const kg = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

export function nextTarget(input: {
  exercise: Pick<Exercise, 'load_mode' | 'tracking_type'>;
  slot: SlotRange | null;
  lastWorkingSets: SetFact[];
  lastDate: string | null;
  today: string;
}): Target {
  const { exercise, slot } = input;
  const work = input.lastWorkingSets.filter(isWorking);
  if (work.length === 0) return NONE;

  const gap = input.lastDate ? daysBetween(input.lastDate, input.today) : 0;
  const away = gap > BREAK_DAYS;

  // HOLDS -------------------------------------------------------------------
  if (exercise.tracking_type === 'time') {
    const best = Math.max(...work.map((s) => s.duration_seconds ?? 0));
    const top = work.reduce((a, s) =>
      (s.duration_seconds ?? 0) >= (a.duration_seconds ?? 0) ? s : a,
    );
    if (away)
      return {
        weight: top.weight_kg,
        reps: null,
        seconds: best,
        reason: `Back after ${gap} days · same time`,
      };
    return { weight: top.weight_kg, reps: null, seconds: best + 5, reason: '+5 s' };
  }

  const reps = work.filter((s) => (s.reps ?? 0) > 0);
  if (reps.length === 0) return NONE;

  // BODYWEIGHT ----------------------------------------------------------------
  if (exercise.load_mode === 'bodyweight') {
    // The hardest load you worked at, and your best reps there.
    const hardest = Math.max(...reps.map(netLoad));
    const atHardest = reps.filter((s) => netLoad(s) === hardest);
    const best = Math.max(...atHardest.map((s) => s.reps ?? 0));
    const weight = atHardest[0].weight_kg;
    if (away)
      return { weight, reps: best, seconds: null, reason: `Back after ${gap} days · same reps` };
    return { weight, reps: best + 1, seconds: null, reason: '+1 rep' };
  }

  // LIFTS -------------------------------------------------------------------
  const topWeight = Math.max(...reps.map((s) => s.weight_kg));
  const atTop = reps.filter((s) => s.weight_kg === topWeight);
  const bestReps = Math.max(...atTop.map((s) => s.reps ?? 0));

  if (away) {
    return {
      weight: topWeight,
      reps: bestReps,
      seconds: null,
      reason: `Back after ${gap} days · same weight`,
    };
  }
  if (!slot?.repsMax) return { weight: topWeight, reps: bestReps, seconds: null, reason: null };

  const allTop = reps.every((s) => (s.reps ?? 0) >= (slot.repsMax ?? Infinity));
  if (allTop) {
    const increment = slot.incrementKg ?? DEFAULT_INCREMENT;
    return {
      weight: Math.round((topWeight + increment) * 100) / 100,
      reps: slot.repsMin ?? slot.repsMax,
      seconds: null,
      reason: `+${kg(increment)} kg · every set hit ${slot.repsMax}`,
    };
  }
  return {
    weight: topWeight,
    reps: Math.min(slot.repsMax, bestReps + 1),
    seconds: null,
    reason: null,
  };
}
