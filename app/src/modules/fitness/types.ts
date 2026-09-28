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
  /** One specific muscle, e.g. 'Biceps'. The region is derived, not stored. */
  muscle_group: string | null;
  /** Whether a set of this exercise counts reps or seconds held. */
  tracking_type: TrackingType;
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
  /** Null for a timed exercise; exactly one of reps and duration is set. */
  reps: number | null;
  /** Seconds held. Null for a rep-counted exercise. */
  duration_seconds: number | null;
  weight_kg: number;
  /** Rate of perceived exertion, 1 to 10. Optional: not everyone tracks it. */
  rpe: number | null;
  created_at: string;
};

/** A set being entered, before it has an id. */
export type SetInput = {
  exercise_id: string;
  set_number: number;
  /** Exactly one of these, matching the exercise's tracking_type. */
  reps: number | null;
  duration_seconds: number | null;
  weight_kg: number;
  rpe: number | null;
};

/**
 * The seven regions you browse by, and the muscles inside them.
 *
 * TWO LEVELS, because one level fails in both directions. Eight broad groups
 * meant "Arms" covered a curl, a skullcrusher and a wrist curl - three muscles
 * you would never train interchangeably. Twenty-two flat tags would mean
 * twenty-two tabs to scroll past to reach the one you want. So a tag is
 * specific and browsing is by region.
 *
 * A region is DERIVED from the muscle rather than stored beside it. Storing
 * both would let them disagree, and there is no answer to "the tag says Biceps
 * but the region says Legs" that is better than not being able to say it.
 */
export const MUSCLE_REGIONS = [
  'Chest',
  'Back',
  'Shoulders',
  'Arms',
  'Legs',
  'Core',
  'Other',
] as const;

export type MuscleRegion = (typeof MUSCLE_REGIONS)[number];

export const MUSCLES_BY_REGION: Record<MuscleRegion, readonly string[]> = {
  Chest: ['Upper chest', 'Mid chest', 'Lower chest'],
  Back: ['Lats', 'Traps', 'Rhomboids', 'Lower back'],
  Shoulders: ['Front delts', 'Side delts', 'Rear delts'],
  Arms: ['Biceps', 'Triceps', 'Forearms'],
  Legs: ['Quads', 'Hamstrings', 'Glutes', 'Calves', 'Adductors'],
  Core: ['Abs', 'Obliques', 'Lower abs'],
  Other: ['Cardio', 'Full body', 'Neck'],
};

/** Every muscle, flat, in region order. */
export const MUSCLE_GROUPS: readonly string[] = MUSCLE_REGIONS.flatMap(
  (region) => MUSCLES_BY_REGION[region],
);

/**
 * Which region a muscle belongs to.
 *
 * Built once from the table above rather than written out again, so the two
 * cannot drift. Anything unrecognised - an exercise tagged before this
 * vocabulary existed, or one you typed yourself - lands in Other rather than
 * disappearing from every tab.
 */
const REGION_OF: Record<string, MuscleRegion> = Object.fromEntries(
  MUSCLE_REGIONS.flatMap((region) =>
    MUSCLES_BY_REGION[region].map((muscle) => [muscle, region]),
  ),
);

export function regionOf(muscle: string | null): MuscleRegion {
  if (!muscle) return 'Other';
  return REGION_OF[muscle] ?? 'Other';
}

/**
 * How an exercise is measured.
 *
 * On the exercise, not the set, because it is a property of the movement: a
 * plank is always held and a curl is always repeated. The logging screen reads
 * it to decide whether to ask for reps or for seconds.
 */
export type TrackingType = 'reps' | 'time';

export const TRACKING_LABEL: Record<TrackingType, string> = {
  reps: 'Reps',
  time: 'Time',
};

export const DEFAULT_EXERCISES: {
  name: string;
  muscle_group: string;
  tracking_type: TrackingType;
}[] = [
  { name: 'Bench Press', muscle_group: 'Mid chest', tracking_type: 'reps' },
  { name: 'Squat', muscle_group: 'Quads', tracking_type: 'reps' },
  { name: 'Deadlift', muscle_group: 'Lower back', tracking_type: 'reps' },
  { name: 'Overhead Press', muscle_group: 'Front delts', tracking_type: 'reps' },
  { name: 'Bicep Curl', muscle_group: 'Biceps', tracking_type: 'reps' },
  { name: 'Pull-up', muscle_group: 'Lats', tracking_type: 'reps' },
  // One timed movement in the starter set, so the mode is discoverable
  // without having to create an exercise to find out it exists.
  { name: 'Plank', muscle_group: 'Abs', tracking_type: 'time' },
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
 * The longest hold recorded for a timed exercise.
 *
 * A timed PR is a different comparison from a weighted one: there is no rep
 * count to hold constant, so the record is simply the longest you have held it.
 * Returns null with no history, for the same reason bestWeightAtReps does -
 * your first hold is not a record, because it beat nothing.
 */
export function bestHold(
  history: Pick<SessionSet, 'exercise_id' | 'duration_seconds'>[],
  exerciseId: string,
): number | null {
  const held = history
    .filter((set) => set.exercise_id === exerciseId && set.duration_seconds !== null)
    .map((set) => set.duration_seconds as number);

  return held.length === 0 ? null : Math.max(...held);
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
  history: Pick<SessionSet, 'exercise_id' | 'reps' | 'weight_kg' | 'duration_seconds'>[],
  candidate: {
    exercise_id: string;
    reps: number | null;
    weight_kg: number;
    duration_seconds?: number | null;
  },
): boolean {
  // A held set is judged on how long, not how heavy.
  if (candidate.duration_seconds != null) {
    const best = bestHold(history, candidate.exercise_id);
    if (best === null) return false;
    return candidate.duration_seconds > best;
  }

  if (candidate.reps === null) return false;

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
export function totalVolume(
  sets: Pick<SessionSet, 'reps' | 'weight_kg' | 'duration_seconds'>[],
): number {
  // Timed sets are EXCLUDED rather than counted as one rep.
  //
  // Volume is reps x weight, and a 60-second plank has no honest value in that
  // unit: calling it one rep would make a long hold look like the smallest set
  // of the session, and calling it sixty would swamp everything else. Leaving
  // it out keeps the number meaning exactly what it says.
  const raw = sets.reduce(
    (total, set) => (set.reps === null ? total : total + set.reps * set.weight_kg),
    0,
  );
  return Math.round(raw * 10) / 10;
}

/** Estimated one-rep max, Epley. Used to compare sets at different rep counts. */
export function estimatedOneRepMax(weightKg: number, reps: number): number {
  if (reps <= 0 || weightKg <= 0) return 0;
  if (reps === 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

/** "60 kg x 8" for a row, with the decimal dropped when it is a whole number. */
export function formatSet(
  weightKg: number,
  reps: number | null,
  durationSeconds: number | null = null,
): string {
  const weight = Number.isInteger(weightKg) ? String(weightKg) : weightKg.toFixed(1);

  // Bodyweight holds are the common case for timed work, and "0 kg x 60s"
  // reads like a mistake. The weight is only shown when there is one.
  if (durationSeconds !== null) {
    const held = formatDuration(durationSeconds);
    return weightKg > 0 ? `${weight} kg x ${held}` : held;
  }

  return `${weight} kg x ${reps ?? 0}`;
}

/** Seconds to "1:30", for the rest timer. */
export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
