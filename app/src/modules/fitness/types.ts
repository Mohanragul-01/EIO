/**
 * types.ts - shapes and training maths for the Fitness module.
 *
 * The pure functions at the bottom are the part worth reading. PR detection and
 * BMI are both things a user will trust without checking, so they are kept free
 * of the database and tested directly.
 */
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

/** Which mode's library lists an exercise. 'both' shows it in either. */
export type Discipline = 'gym' | 'calisthenics' | 'both';

/**
 * What the load is. 'external': the barbell or dumbbell is the load and
 * weight_kg is it. 'bodyweight': the body is, weight_kg is what you ADD (a
 * vest, a belt) and assistance is its own number - never a negative weight.
 */
export type LoadMode = 'external' | 'bodyweight';

/** The lens over Fitness. A mode filters and sets defaults; it is not a separate log. */
export type FitnessMode = 'gym' | 'calisthenics';

export type Equipment =
  | 'none'
  | 'barbell'
  | 'dumbbell'
  | 'kettlebell'
  | 'machine'
  | 'cable'
  | 'band'
  | 'pull_up_bar'
  | 'rings'
  | 'dip_bars'
  | 'parallettes'
  | 'other';

export type Exercise = {
  id: string;
  user_id: string;
  name: string;
  /** One specific muscle, e.g. 'Biceps'. The region is derived, not stored. */
  muscle_group: string | null;
  /** Whether a set of this exercise counts reps or seconds held. */
  tracking_type: TrackingType;
  discipline: Discipline;
  load_mode: LoadMode;
  /** Share of bodyweight one rep moves (push-up about 0.65). Volume and e1RM only. */
  bodyweight_factor: number;
  equipment: Equipment | null;
  /** Logged per side. */
  is_unilateral: boolean;
  default_rest_seconds: number | null;
  /** Shown every time the exercise is logged. */
  pinned_note: string;
  /** Your own how-to. */
  instructions: string;
  created_at: string;
};

export type Routine = {
  id: string;
  user_id: string;
  name: string;
  mode: FitnessMode;
  created_at: string;
  updated_at: string;
};

/**
 * A slot in a routine: a fixed exercise OR a ladder (exactly one is set). A
 * ladder slot becomes the ladder's current rung when a session starts, so a
 * routine written once never needs editing as you progress.
 */
export type RoutineExercise = {
  id: string;
  routine_id: string;
  exercise_id: string | null;
  progression_id: string | null;
  user_id: string;
  position: number;
  target_sets: number | null;
  /** The top of the rep range; target_reps_min is the bottom. */
  target_reps: number | null;
  target_reps_min: number | null;
  target_seconds_min: number | null;
  target_seconds_max: number | null;
  rest_seconds: number | null;
  /** Slots sharing a letter alternate as a superset. */
  pair_group: string | null;
  /** What to add when every set hits the top of the range. */
  increment_kg: number | null;
};

export type WorkoutSession = {
  id: string;
  user_id: string;
  date: string;
  /** Null for an ad-hoc session that came from no routine. */
  routine_id: string | null;
  notes: string;
  mode: FitnessMode;
  /** Null for sessions logged before v3. */
  started_at: string | null;
  /** Null until Finish, which is optional. */
  ended_at: string | null;
  /** The weigh-in in force when the session started. */
  bodyweight_kg: number | null;
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
  set_type: SetType;
  /** Assistance subtracted from bodyweight. Positive, or null. */
  assist_kg: number | null;
  band_id: string | null;
  side: Side | null;
  /** Whether it counts toward a ladder level-up. */
  clean: boolean;
  created_at: string;
};

/** Warm-ups count toward nothing; a failure set may record 0 reps; no rest before a drop set. */
export type SetType = 'normal' | 'warmup' | 'failure' | 'drop';

export type Side = 'left' | 'right';

/** A set being entered, before it has an id. */
export type SetInput = {
  exercise_id: string;
  set_number: number;
  /** Exactly one of these, matching the exercise's tracking_type. */
  reps: number | null;
  duration_seconds: number | null;
  weight_kg: number;
  rpe: number | null;
  set_type?: SetType;
  assist_kg?: number | null;
  band_id?: string | null;
  side?: Side | null;
  clean?: boolean;
};

/** One exercise's block in a session: its order, rest, note and superset. */
export type SessionExercise = {
  id: string;
  session_id: string;
  exercise_id: string;
  user_id: string;
  position: number;
  rest_seconds: number | null;
  note: string;
  superset_group: string | null;
  created_at: string;
};

/** A resistance band, remembered by colour. */
export type Band = {
  id: string;
  user_id: string;
  label: string;
  color: string;
  approx_kg: number | null;
  position: number;
  created_at: string;
};

export type ProgressionFamily = 'push' | 'pull' | 'legs' | 'core' | 'balance' | 'statics' | 'other';

/** A ladder for one skill. Which rungs are mastered is derived from its moves. */
export type Progression = {
  id: string;
  user_id: string;
  name: string;
  family: ProgressionFamily;
  current_step_id: string | null;
  position: number;
  level_up_rule: 'two_of_three' | 'one';
  paused_at: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
};

/** A rung: an ordinary library exercise with a graduation target. */
export type ProgressionStep = {
  id: string;
  progression_id: string;
  user_id: string;
  exercise_id: string;
  position: number;
  goal_sets: number;
  /** Exactly one of goal_reps and goal_seconds is set. */
  goal_reps: number | null;
  goal_seconds: number | null;
  goal_added_kg: number | null;
  start_reps: number | null;
  start_seconds: number | null;
  cue: string;
  created_at: string;
};

export type ProgressionMove = {
  id: string;
  progression_id: string;
  user_id: string;
  from_step_id: string | null;
  to_step_id: string;
  kind: 'start' | 'up' | 'back';
  date: string;
  session_id: string | null;
  note: string;
  created_at: string;
};

export type BodyMeasurement = {
  id: string;
  user_id: string;
  date: string;
  neck: number | null;
  shoulders: number | null;
  chest: number | null;
  waist: number | null;
  hips: number | null;
  arm_left: number | null;
  arm_right: number | null;
  forearm_left: number | null;
  forearm_right: number | null;
  thigh_left: number | null;
  thigh_right: number | null;
  calf_left: number | null;
  calf_right: number | null;
  body_fat_pct: number | null;
  created_at: string;
  updated_at: string;
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

/**
 * SPLIT ONLY WHERE IT CHANGES WHAT YOU DO.
 *
 * This was once 22 muscles - upper/mid/lower chest, quads, hamstrings, glutes,
 * calves, adductors, three separate delts. That is the vocabulary of a coaching
 * textbook, not of someone picking an exercise, and it made the library harder
 * to use rather than easier: a list you have to think about before tagging is a
 * list you will tag wrong.
 *
 * So most regions are a single tag. Arms splits, because biceps and triceps are
 * genuinely different training days. Core splits into abs and lower back,
 * because those are different exercises entirely. Nothing else earns a split.
 */
export const MUSCLES_BY_REGION: Record<MuscleRegion, readonly string[]> = {
  Chest: ['Chest'],
  Back: ['Back'],
  Shoulders: ['Shoulders'],
  Arms: ['Biceps', 'Triceps', 'Forearms'],
  Legs: ['Legs'],
  Core: ['Abs', 'Lower back'],
  Other: ['Cardio', 'Full body'],
};

/**
 * The finer vocabulary that used to exist, folded into the one above.
 *
 * Applied when READING an exercise, so the library looks right whether or not
 * migration 0018 has been run - and so an exercise tagged before this change
 * does not strand itself under "Other". 0018 does the same thing to the stored
 * rows; this is what keeps the screen honest in the meantime.
 */
const LEGACY_MUSCLES: Record<string, string> = {
  'Upper chest': 'Chest',
  'Mid chest': 'Chest',
  'Lower chest': 'Chest',
  Lats: 'Back',
  Traps: 'Back',
  Rhomboids: 'Back',
  'Front delts': 'Shoulders',
  'Side delts': 'Shoulders',
  'Rear delts': 'Shoulders',
  Neck: 'Shoulders',
  Quads: 'Legs',
  Hamstrings: 'Legs',
  Glutes: 'Legs',
  Calves: 'Legs',
  Adductors: 'Legs',
  Obliques: 'Abs',
  'Lower abs': 'Abs',
};

/**
 * The tag to display and group by, given whatever is stored.
 *
 * Returns the value unchanged when it is already current or entirely unknown -
 * a name you typed yourself is yours to keep, not something to silently rewrite.
 */
export function normaliseMuscle(muscle: string | null): string | null {
  if (!muscle) return null;
  return LEGACY_MUSCLES[muscle] ?? muscle;
}

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
  MUSCLE_REGIONS.flatMap((region) => MUSCLES_BY_REGION[region].map((muscle) => [muscle, region])),
);

export function regionOf(muscle: string | null): MuscleRegion {
  const current = normaliseMuscle(muscle);
  if (!current) return 'Other';
  return REGION_OF[current] ?? 'Other';
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

/**
 * The starter library. Pull-up and Plank are bodyweight work listed in both
 * modes, exactly as migration 0019 classifies an existing library - seeded as
 * gym lifts, a fresh Calisthenics tab had no pull-up, and a pull-up rep record
 * could never fire. Every row states every field: a bulk insert sends the
 * same columns for each row, so one left out would be written as null rather
 * than take its column default.
 */
export const DEFAULT_EXERCISES: {
  name: string;
  muscle_group: string;
  tracking_type: TrackingType;
  discipline: Discipline;
  load_mode: LoadMode;
  equipment: Equipment | null;
}[] = [
  { name: 'Bench Press', muscle_group: 'Chest', ...lift('barbell') },
  { name: 'Squat', muscle_group: 'Legs', ...lift('barbell') },
  { name: 'Deadlift', muscle_group: 'Lower back', ...lift('barbell') },
  { name: 'Overhead Press', muscle_group: 'Shoulders', ...lift('barbell') },
  { name: 'Bicep Curl', muscle_group: 'Biceps', ...lift(null) },
  {
    name: 'Pull-up',
    muscle_group: 'Back',
    tracking_type: 'reps',
    discipline: 'both',
    load_mode: 'bodyweight',
    equipment: 'pull_up_bar',
  },
  // One timed movement in the starter set, so the mode is discoverable
  // without having to create an exercise to find out it exists.
  {
    name: 'Plank',
    muscle_group: 'Abs',
    tracking_type: 'time',
    discipline: 'both',
    load_mode: 'bodyweight',
    equipment: 'none',
  },
];

/** A gym lift's fields in the starter library. */
function lift(equipment: Equipment | null) {
  return {
    tracking_type: 'reps' as const,
    discipline: 'gym' as const,
    load_mode: 'external' as const,
    equipment,
  };
}

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
  const matching = history.filter((set) => set.exercise_id === exerciseId && set.reps === reps);
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
