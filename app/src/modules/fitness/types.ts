/**
 * types.ts - shapes and training maths for the Fitness module.
 *
 * The pure functions at the bottom are the part worth reading. PR detection and
 * BMI are both things a user will trust without checking, so they are kept free
 * of the database and tested directly.
 */
import type { Ionicons } from '@expo/vector-icons';

export type Profile = {
  user_id: string;
  height_cm: number | null;
  created_at: string;
  updated_at: string;
};

export type BodyMetric = {
  id: string;
  user_id: string;
  /** 'YYYY-MM-DD'. One per day, enforced by the database. */
  date: string;
  weight_kg: number;
  created_at: string;
};

export type Exercise = {
  id: string;
  user_id: string;
  name: string;
  muscle_group: string | null;
  created_at: string;
};

export type Routine = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type RoutineExercise = {
  id: string;
  routine_id: string;
  exercise_id: string;
  user_id: string;
  position: number;
  target_sets: number | null;
  target_reps: number | null;
};

export type WorkoutSession = {
  id: string;
  user_id: string;
  date: string;
  /** Null for an ad-hoc session that came from no routine. */
  routine_id: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type SessionSet = {
  id: string;
  session_id: string;
  exercise_id: string;
  user_id: string;
  set_number: number;
  reps: number;
  weight_kg: number;
  /** Rate of perceived exertion, 1 to 10. Optional: not everyone tracks it. */
  rpe: number | null;
  created_at: string;
};

/** A set being entered, before it has an id. */
export type SetInput = {
  exercise_id: string;
  set_number: number;
  reps: number;
  weight_kg: number;
  rpe: number | null;
};

export const MUSCLE_GROUPS = [
  'Chest',
  'Back',
  'Legs',
  'Shoulders',
  'Arms',
  'Core',
  'Cardio',
  'Other',
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const MUSCLE_GROUP_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  Chest: 'body-outline',
  Back: 'accessibility-outline',
  Legs: 'walk-outline',
  Shoulders: 'barbell-outline',
  Arms: 'fitness-outline',
  Core: 'ellipse-outline',
  Cardio: 'heart-outline',
  Other: 'ellipsis-horizontal-outline',
};

/**
 * Seeded once per user, the first time the module is opened with no exercises.
 *
 * A starting point, not a fixed list: they are ordinary rows and can be
 * renamed or deleted like any other. Six, not sixty - a library you have to
 * scroll past is worse than one you add to.
 */
export const DEFAULT_EXERCISES: { name: string; muscle_group: MuscleGroup }[] = [
  { name: 'Bench Press', muscle_group: 'Chest' },
  { name: 'Squat', muscle_group: 'Legs' },
  { name: 'Deadlift', muscle_group: 'Back' },
  { name: 'Overhead Press', muscle_group: 'Shoulders' },
  { name: 'Bicep Curl', muscle_group: 'Arms' },
  { name: 'Pull-up', muscle_group: 'Back' },
];

/**
 * Body mass index, or null when height is unknown.
 *
 * NEVER STORED. BMI is entirely determined by the weight and the height, so
 * storing it would create a second copy that goes stale the moment either
 * changes - and the stale one looks exactly as authoritative as the real one.
 * Computed on read, always current, impossible to disagree with itself.
 */
export function bmi(weightKg: number, heightCm: number | null): number | null {
  if (!heightCm || heightCm <= 0 || weightKg <= 0) return null;
  const metres = heightCm / 100;
  return weightKg / (metres * metres);
}

/** The standard bands, for a word alongside the number. */
export function bmiLabel(value: number): string {
  if (value < 18.5) return 'Underweight';
  if (value < 25) return 'Healthy';
  if (value < 30) return 'Overweight';
  return 'Obese';
}

/**
 * The heaviest weight previously lifted for this exercise at this rep count.
 *
 * Same rep count, not a nearby range. 100kg for 5 and 100kg for 10 are
 * different achievements, and treating them as comparable would mean a set that
 * beats nothing gets announced as a record. Comparing like with like is the
 * whole point of the number.
 *
 * Returns null when there is no history at that rep count, which is NOT the
 * same as zero: see isPersonalRecord.
 */
export function bestWeightAtReps(
  history: Pick<SessionSet, 'exercise_id' | 'reps' | 'weight_kg'>[],
  exerciseId: string,
  reps: number,
): number | null {
  const matching = history.filter(
    (set) => set.exercise_id === exerciseId && set.reps === reps,
  );
  if (matching.length === 0) return null;
  return Math.max(...matching.map((set) => set.weight_kg));
}

/**
 * Is this set a personal record?
 *
 * THE FIRST SET IS NOT A PR. With no history at that rep count, every first
 * set would be a record and the badge would fire constantly on day one, which
 * teaches you to ignore it. A record means you beat something.
 *
 * Strictly greater, so repeating your best is not a new record either.
 */
export function isPersonalRecord(
  history: Pick<SessionSet, 'exercise_id' | 'reps' | 'weight_kg'>[],
  candidate: { exercise_id: string; reps: number; weight_kg: number },
): boolean {
  const best = bestWeightAtReps(history, candidate.exercise_id, candidate.reps);
  if (best === null) return false;
  return candidate.weight_kg > best;
}

/**
 * The set number to give the next set of an exercise.
 *
 * One past the HIGHEST so far, not the count of what exists. Counting collides
 * after a deletion: log three sets, delete the second, and a count returns 3
 * when a set numbered 3 is still there. Nothing in the schema forbids the
 * duplicate, so it saves, and the block then shows two rows claiming to be the
 * same set in whatever order Postgres returns them.
 *
 * That leaves gaps - 1, 3, 4 after deleting the second - which is why the UI
 * numbers rows by their position in the list rather than printing this. The
 * stored number only has to order the sets and never be reused.
 */
export function nextSetNumber(existing: Pick<SessionSet, 'set_number'>[]): number {
  return existing.reduce((top, set) => Math.max(top, set.set_number), 0) + 1;
}

/**
 * Total load moved in a set of sets: sum of reps x weight.
 *
 * Rounded to one decimal. Floating point drift across a session is far below a
 * kilogram and volume is a trend indicator, not a figure anyone reconciles -
 * unlike money, where the same drift would be unacceptable.
 */
export function totalVolume(sets: Pick<SessionSet, 'reps' | 'weight_kg'>[]): number {
  const raw = sets.reduce((total, set) => total + set.reps * set.weight_kg, 0);
  return Math.round(raw * 10) / 10;
}

/** Estimated one-rep max, Epley. Used to compare sets at different rep counts. */
export function estimatedOneRepMax(weightKg: number, reps: number): number {
  if (reps <= 0 || weightKg <= 0) return 0;
  if (reps === 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

/** "60 kg x 8" for a row, with the decimal dropped when it is a whole number. */
export function formatSet(weightKg: number, reps: number): string {
  const weight = Number.isInteger(weightKg) ? String(weightKg) : weightKg.toFixed(1);
  return `${weight} kg x ${reps}`;
}

/** Seconds to "1:30", for the rest timer. */
export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
