/**
 * load.ts - what a set weighed, and how to write it down.
 *
 * THE ONE RULE. On a bodyweight exercise, weight_kg is what you ADD (a vest, a
 * belt) and assistance (a band, a counterweight) is its own positive number.
 * Nothing stores a negative weight, because every volume and record sum that
 * already existed would silently turn wrong the day one appeared. The two are
 * combined only here, into:
 *
 *   netLoad       added minus assistance, signed. What records compare: a
 *                 harder set has a higher net load. Needs no bodyweight.
 *   effectiveLoad what the muscles actually moved: bodyweight times the
 *                 exercise's factor, plus net. Needs a weigh-in; used for
 *                 volume and estimated maxes only.
 */
import { formatDuration, type Exercise, type SessionSet, type SetType } from './types';

/**
 * The facts about a set that the training maths reads: records, ladders,
 * volume. Narrower than a SessionSet so pure tests can build one in a line,
 * and normalised so a v2 row (no set_type, no assistance) reads correctly.
 */
export type SetFact = {
  id: string;
  exercise_id: string;
  session_id: string;
  set_type: SetType;
  reps: number | null;
  duration_seconds: number | null;
  weight_kg: number;
  assist_kg: number | null;
  clean: boolean;
  created_at: string;
};

type LoadShape = Pick<Exercise, 'load_mode' | 'bodyweight_factor'>;

/** Numeric columns can arrive as strings; null stays null. */
function num(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * A database row (v2 or v3 shape) as a SetFact. Rows written before v3 have
 * no set_type, assistance or clean flag: they were all ordinary sets.
 */
export function toSetFact(
  row: Pick<SessionSet, 'id' | 'exercise_id' | 'session_id' | 'reps' | 'duration_seconds' | 'created_at'> & {
    weight_kg: number | string;
    set_type?: SetType | null;
    assist_kg?: number | string | null;
    clean?: boolean | null;
  },
): SetFact {
  return {
    id: row.id,
    exercise_id: row.exercise_id,
    session_id: row.session_id,
    set_type: row.set_type ?? 'normal',
    reps: num(row.reps),
    duration_seconds: num(row.duration_seconds),
    weight_kg: num(row.weight_kg) ?? 0,
    assist_kg: num(row.assist_kg),
    clean: row.clean ?? true,
    created_at: row.created_at,
  };
}

/** Added weight minus assistance, in kg. Negative for an assisted set. */
export function netLoad(set: { weight_kg: number; assist_kg: number | null }): number {
  return set.weight_kg - (set.assist_kg ?? 0);
}

/**
 * The load a set actually moved, or null for a bodyweight set without a known
 * bodyweight. Never below zero: a band cannot lift more than you weigh.
 */
export function effectiveLoad(
  set: { weight_kg: number; assist_kg: number | null },
  exercise: LoadShape,
  bodyweightKg: number | null,
): number | null {
  if (exercise.load_mode === 'external') return set.weight_kg;
  if (bodyweightKg === null) return null;
  return Math.max(0, bodyweightKg * exercise.bodyweight_factor + netLoad(set));
}

/** Everything but a warm-up counts as work. */
export function isWorking(set: { set_type: SetType }): boolean {
  return set.set_type !== 'warmup';
}

/**
 * Total load moved by the working rep sets: reps times load, summed.
 *
 * Warm-ups are left out (they are preparation, not the session's work) and so
 * are holds (a plank has no honest value in kg x reps). Bodyweight sets count
 * their bodyweight share when a weigh-in is known; without one only the added
 * weight counts, so the number never invents a bodyweight. Rounded to 0.1.
 */
export function workingVolume(
  sets: SetFact[],
  exercisesById: Record<string, LoadShape | undefined>,
  bodyweightKg: number | null,
): number {
  const raw = sets.reduce((total, set) => {
    if (!isWorking(set) || set.reps === null || set.reps <= 0) return total;
    const exercise = exercisesById[set.exercise_id];
    const load =
      exercise === undefined
        ? set.weight_kg
        : (effectiveLoad(set, exercise, bodyweightKg) ?? Math.max(0, netLoad(set)));
    return total + set.reps * load;
  }, 0);
  return Math.round(raw * 10) / 10;
}

/**
 * The label in each row's SET column: a letter for the special sets and a
 * running number that counts only normal sets, so "1, 2, 3" are your working
 * sets whatever warm-ups came before them.
 */
export function setLabels(sets: { set_type: SetType }[]): string[] {
  let normal = 0;
  return sets.map((set) => {
    switch (set.set_type) {
      case 'warmup':
        return 'W';
      case 'failure':
        return 'F';
      case 'drop':
        return 'D';
      default:
        normal += 1;
        return String(normal);
    }
  });
}

/** 62.5 -> "62.5", 60 -> "60". */
function kg(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

/** Seconds as "45s" under a minute, "1:15" from a minute up. */
export function formatHoldShort(seconds: number): string {
  return seconds < 60 ? `${Math.max(0, Math.floor(seconds))}s` : formatDuration(seconds);
}

/**
 * The load chip for a bodyweight set: "+10", "−20" (a real minus sign) or
 * "Red band"; null when unloaded or for an external lift, whose load is the
 * weight column itself.
 */
export function formatLoadChip(
  set: { weight_kg: number; assist_kg: number | null; band_id: string | null },
  exercise: Pick<Exercise, 'load_mode'>,
  bandLabel?: string | null,
): string | null {
  if (exercise.load_mode !== 'bodyweight') return null;
  if (set.band_id && bandLabel) return `${bandLabel} band`;
  const net = netLoad(set);
  if (net > 0) return `+${kg(net)}`;
  if (net < 0) return `−${kg(-net)}`;
  return null;
}

/**
 * A set in a few characters, for the PREVIOUS column and history lists:
 * "60 × 8", "× 12", "8 · +10", "45s", "22s · −20", "22s · Red band", with
 * " · L" or " · R" for one side.
 */
export function formatSetShort(
  set: {
    weight_kg: number;
    assist_kg: number | null;
    band_id: string | null;
    side: 'left' | 'right' | null;
    reps: number | null;
    duration_seconds: number | null;
  },
  exercise: Pick<Exercise, 'load_mode'>,
  bandLabel?: string | null,
): string {
  const chip = formatLoadChip(set, exercise, bandLabel);
  let text: string;

  if (set.duration_seconds !== null) {
    const held = formatHoldShort(set.duration_seconds);
    if (exercise.load_mode === 'external') {
      text = set.weight_kg > 0 ? `${held} · ${kg(set.weight_kg)} kg` : held;
    } else {
      text = chip ? `${held} · ${chip}` : held;
    }
  } else {
    const reps = set.reps ?? 0;
    if (exercise.load_mode === 'external') {
      text = set.weight_kg > 0 ? `${kg(set.weight_kg)} × ${reps}` : `× ${reps}`;
    } else {
      text = chip ? `${reps} · ${chip}` : `× ${reps}`;
    }
  }

  if (set.side) text += set.side === 'left' ? ' · L' : ' · R';
  return text;
}
