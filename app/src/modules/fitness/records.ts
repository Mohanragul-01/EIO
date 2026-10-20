/**
 * records.ts - personal records, judged by what kind of exercise it is.
 *
 * WHY BY TYPE. Records used to mean one thing: a heavier weight at the same
 * rep count. On a bodyweight exercise the weight is always 0, so "first time
 * doing 11 pull-ups" could never be a record. Each exercise type now has the
 * records that mean something for it:
 *
 *   external lift   heaviest weight; heaviest at the same reps (the original
 *                   rule, kept); best estimated 1RM (12 reps or fewer, where
 *                   Epley is reasonable); best single-set volume
 *   bodyweight reps most reps at the same or a harder load; the most load
 *                   (more added, or less assistance) for at least as many reps
 *   holds           longest hold at the same or a harder load
 *
 * "Load" for bodyweight comparisons is NET load (added minus assistance), so
 * an assisted set is easier than an unassisted one and can never outrank it.
 * No bodyweight is needed: like is compared with like.
 *
 * THE RULES THAT MAKE A BADGE WORTH TRUSTING, unchanged:
 *  - the first set at a measure is not a record: with nothing comparable
 *    before it, it beat nothing;
 *  - strictly greater: equalling your best is not a new one;
 *  - warm-ups never count, as the candidate or as the baseline;
 *  - the baseline is other sessions. Within a session a record is announced
 *    once, on the set that first sets it, so three sets at a new best do not
 *    fire three toasts. sessionRecords replays exactly the same rule, which is
 *    why badges look the same after reopening a session as they did live.
 */
import { netLoad, type SetFact } from './load';
import { estimatedOneRepMax, type Exercise } from './types';

export type RecordKind =
  | 'heaviest'
  | 'repsAtWeight'
  | 'e1rm'
  | 'setVolume'
  | 'reps'
  | 'load'
  | 'hold';

export type RecordHit = {
  kind: RecordKind;
  /** The candidate's value in the kind's unit (kg, reps, seconds, kg x reps). */
  value: number;
  /** The best it beat. */
  previous: number;
  label: string;
};

type ExerciseShape = Pick<Exercise, 'load_mode' | 'tracking_type'>;

/** Epley stops being a fair estimate past about a dozen reps. */
const E1RM_MAX_REPS = 12;

type Measure = {
  kind: RecordKind;
  /** Whether this kind is measured for the candidate at all. */
  applies: (c: SetFact) => boolean;
  /** Whether a past set is comparable with the candidate for this kind. */
  comparable: (past: SetFact, c: SetFact) => boolean;
  value: (set: SetFact) => number;
  label: (c: SetFact, previous: number) => string;
};

const hasReps = (s: SetFact) => s.reps !== null && s.reps > 0;
const hasHold = (s: SetFact) => s.duration_seconds !== null && s.duration_seconds > 0;

const EXTERNAL_REPS: Measure[] = [
  {
    kind: 'heaviest',
    applies: (c) => hasReps(c) && c.weight_kg > 0,
    comparable: (p) => hasReps(p),
    value: (s) => s.weight_kg,
    label: () => 'Heaviest weight',
  },
  {
    kind: 'repsAtWeight',
    applies: (c) => hasReps(c) && c.weight_kg > 0,
    comparable: (p, c) => p.reps === c.reps,
    value: (s) => s.weight_kg,
    label: (c) => `Heaviest for ${c.reps} reps`,
  },
  {
    kind: 'e1rm',
    applies: (c) => hasReps(c) && c.weight_kg > 0 && (c.reps ?? 0) <= E1RM_MAX_REPS,
    comparable: (p) => hasReps(p) && p.weight_kg > 0 && (p.reps ?? 0) <= E1RM_MAX_REPS,
    value: (s) => estimatedOneRepMax(s.weight_kg, s.reps ?? 0),
    label: () => 'Best est. 1RM',
  },
  {
    kind: 'setVolume',
    applies: (c) => hasReps(c) && c.weight_kg > 0,
    comparable: (p) => hasReps(p),
    value: (s) => s.weight_kg * (s.reps ?? 0),
    label: () => 'Best set volume',
  },
];

const BODYWEIGHT_REPS: Measure[] = [
  {
    kind: 'reps',
    applies: hasReps,
    // Only a set at the same or a HARDER load: more reps with help proves
    // nothing about reps without it.
    comparable: (p, c) => hasReps(p) && netLoad(p) >= netLoad(c),
    value: (s) => s.reps ?? 0,
    label: () => 'Most reps',
  },
  {
    kind: 'load',
    applies: hasReps,
    // Only a set of at least as many reps: a heavier single is not beaten by
    // a lighter ten.
    comparable: (p, c) => hasReps(p) && (p.reps ?? 0) >= (c.reps ?? 0),
    value: netLoad,
    label: (_c, previous) => (previous < 0 ? 'Less assistance' : 'Most added weight'),
  },
];

const HOLDS: Measure[] = [
  {
    kind: 'hold',
    applies: hasHold,
    comparable: (p, c) => hasHold(p) && netLoad(p) >= netLoad(c),
    value: (s) => s.duration_seconds ?? 0,
    label: () => 'Longest hold',
  },
];

function measuresFor(exercise: ExerciseShape, candidate: SetFact): Measure[] {
  if (hasHold(candidate)) return HOLDS;
  return exercise.load_mode === 'bodyweight' ? BODYWEIGHT_REPS : EXTERNAL_REPS;
}

/**
 * The records a set sets, if any.
 *
 * `baseline` is this exercise's sets from OTHER sessions; `earlierThisSession`
 * is the sets logged before this one in the same session. Either may contain
 * other exercises' sets; they are ignored.
 */
export function detectRecords(
  exercise: ExerciseShape,
  baseline: SetFact[],
  earlierThisSession: SetFact[],
  candidate: SetFact,
): RecordHit[] {
  if (candidate.set_type === 'warmup') return [];

  const counts = (s: SetFact) => s.exercise_id === candidate.exercise_id && s.set_type !== 'warmup';
  const past = baseline.filter(counts);
  const earlier = earlierThisSession.filter(counts);

  const hits: RecordHit[] = [];
  for (const measure of measuresFor(exercise, candidate)) {
    if (!measure.applies(candidate)) continue;

    const comparable = past.filter((p) => measure.comparable(p, candidate));
    // The first at this measure beat nothing.
    if (comparable.length === 0) continue;

    const previous = Math.max(...comparable.map(measure.value));
    const value = measure.value(candidate);
    if (!(value > previous)) continue;

    // Already announced this session at this value or better.
    const sameSession = earlier.filter((p) => measure.comparable(p, candidate));
    if (sameSession.length > 0 && value <= Math.max(...sameSession.map(measure.value))) continue;

    hits.push({ kind: measure.kind, value, previous, label: measure.label(candidate, previous) });
  }
  return hits;
}

/**
 * Every record in a session, keyed by set id. Replays detectRecords over the
 * sets in the order they were logged, so it gives exactly the badges the
 * session showed live - which is what lets them survive reopening.
 */
export function sessionRecords(
  exercisesById: Record<string, ExerciseShape | undefined>,
  baselineByExercise: Record<string, SetFact[] | undefined>,
  sessionSets: SetFact[],
): Record<string, RecordHit[]> {
  const out: Record<string, RecordHit[]> = {};
  sessionSets.forEach((set, index) => {
    const exercise = exercisesById[set.exercise_id];
    if (!exercise) return;
    const earlier = sessionSets.slice(0, index).filter((s) => s.exercise_id === set.exercise_id);
    const hits = detectRecords(exercise, baselineByExercise[set.exercise_id] ?? [], earlier, set);
    if (hits.length > 0) out[set.id] = hits;
  });
  return out;
}

/** Which record to announce when a set sets several: the most meaningful first. */
const PRIORITY: RecordKind[] = ['heaviest', 'e1rm', 'load', 'reps', 'hold', 'repsAtWeight', 'setVolume'];

export function primaryRecord(hits: RecordHit[]): RecordHit | null {
  if (hits.length === 0) return null;
  return [...hits].sort((a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind))[0];
}
