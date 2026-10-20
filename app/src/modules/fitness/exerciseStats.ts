/**
 * exerciseStats.ts - the numbers on an exercise's own page.
 *
 * Which charts make sense depends on the exercise: estimated max and volume
 * for a barbell lift, most reps and added weight for a pull-up, longest hold
 * for a plank. A chart that cannot move (volume of a plank) is not offered.
 * Every series has one point per session - the session's best, or its total -
 * and leaves warm-ups out, because they are preparation, not the work.
 */
import { effectiveLoad, isWorking, netLoad, type SetFact } from './load';
import { estimatedOneRepMax, type Exercise } from './types';

/** A set with the date and bodyweight of the session it belongs to. */
export type DatedSet = SetFact & { date: string; bodyweight_kg: number | null };

export type Metric =
  | 'e1rm'
  | 'heaviest'
  | 'bestSetVolume'
  | 'sessionVolume'
  | 'totalReps'
  | 'mostReps'
  | 'bestAddedKg'
  | 'bwE1rm'
  | 'longestHold'
  | 'totalTime';

export const METRIC_LABEL: Record<Metric, string> = {
  e1rm: 'Est. 1RM',
  heaviest: 'Heaviest',
  bestSetVolume: 'Best set',
  sessionVolume: 'Volume',
  totalReps: 'Total reps',
  mostReps: 'Most reps',
  bestAddedKg: 'Added kg',
  bwE1rm: 'Est. 1RM (with body)',
  longestHold: 'Longest hold',
  totalTime: 'Total time',
};

export const METRIC_UNIT: Record<Metric, 'kg' | 'reps' | 's'> = {
  e1rm: 'kg',
  heaviest: 'kg',
  bestSetVolume: 'kg',
  sessionVolume: 'kg',
  totalReps: 'reps',
  mostReps: 'reps',
  bestAddedKg: 'kg',
  bwE1rm: 'kg',
  longestHold: 's',
  totalTime: 's',
};

type ExerciseShape = Pick<Exercise, 'load_mode' | 'tracking_type' | 'bodyweight_factor'>;

/** The charts for an exercise, the most useful first. */
export function metricsFor(exercise: Pick<Exercise, 'load_mode' | 'tracking_type'>): Metric[] {
  if (exercise.tracking_type === 'time') return ['longestHold', 'totalTime'];
  if (exercise.load_mode === 'bodyweight')
    return ['mostReps', 'bestAddedKg', 'totalReps', 'bwE1rm'];
  return ['e1rm', 'heaviest', 'bestSetVolume', 'sessionVolume', 'totalReps'];
}

export type Range = '1m' | '3m' | '1y' | 'all';

const RANGE_DAYS: Record<Exclude<Range, 'all'>, number> = { '1m': 30, '3m': 91, '1y': 365 };

const max = (values: number[]) => (values.length ? Math.max(...values) : null);
const sum = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) : null);
const round1 = (n: number) => Math.round(n * 10) / 10;

/** One session's value for a metric, or null when the session has nothing to say. */
function valueOf(metric: Metric, sets: DatedSet[], exercise: ExerciseShape): number | null {
  const work = sets.filter((s) => isWorking(s));
  const reps = work.filter((s) => s.reps !== null && s.reps > 0);
  const loaded = reps.filter((s) => s.weight_kg > 0);
  switch (metric) {
    case 'e1rm':
      return max(
        loaded
          .filter((s) => (s.reps ?? 0) <= 12)
          .map((s) => estimatedOneRepMax(s.weight_kg, s.reps ?? 0)),
      );
    case 'heaviest':
      return max(loaded.map((s) => s.weight_kg));
    case 'bestSetVolume':
      return max(loaded.map((s) => round1(s.weight_kg * (s.reps ?? 0))));
    case 'sessionVolume':
      return loaded.length
        ? round1(sum(loaded.map((s) => s.weight_kg * (s.reps ?? 0))) ?? 0)
        : null;
    case 'totalReps':
      return sum(reps.map((s) => s.reps ?? 0));
    case 'mostReps':
      // At bodyweight or harder: reps with help are a different measure.
      return max(reps.filter((s) => netLoad(s) >= 0).map((s) => s.reps ?? 0));
    case 'bestAddedKg':
      return max(reps.filter((s) => netLoad(s) > 0).map(netLoad));
    case 'bwE1rm':
      return max(
        reps
          .filter((s) => (s.reps ?? 0) <= 12)
          .flatMap((s) => {
            const load = effectiveLoad(s, exercise, s.bodyweight_kg);
            return load ? [estimatedOneRepMax(load, s.reps ?? 0)] : [];
          }),
      );
    case 'longestHold':
      return max(work.flatMap((s) => (s.duration_seconds ? [s.duration_seconds] : [])));
    case 'totalTime':
      return sum(work.flatMap((s) => (s.duration_seconds ? [s.duration_seconds] : [])));
  }
}

export type Point = { date: string; value: number; sessionId: string };

/** One point per session in the range, oldest first. */
export function seriesFor(
  metric: Metric,
  sets: DatedSet[],
  exercise: ExerciseShape,
  range: Range,
  today: string,
): Point[] {
  const from = range === 'all' ? '' : shiftBack(today, RANGE_DAYS[range]);
  const bySession = groupBySession(sets.filter((s) => s.date >= from && s.date <= today));
  return bySession
    .map((group) => ({
      date: group.date,
      sessionId: group.sessionId,
      value: valueOf(metric, group.sets, exercise),
    }))
    .filter((p): p is Point => p.value !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function shiftBack(today: string, days: number): string {
  // Series take `today` explicitly, so they can be tested on any date.
  const [y, m, d] = today.split('-').map(Number);
  const date = new Date(y, m - 1, d - days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

type Group = { sessionId: string; date: string; sets: DatedSet[] };

function groupBySession(sets: DatedSet[]): Group[] {
  const map = new Map<string, Group>();
  for (const set of sets) {
    const group = map.get(set.session_id) ?? {
      sessionId: set.session_id,
      date: set.date,
      sets: [],
    };
    group.sets.push(set);
    map.set(set.session_id, group);
  }
  return [...map.values()];
}

/** Sessions, newest first, each with its sets in the order logged. */
export function historyBySession(sets: DatedSet[]): Group[] {
  return groupBySession(sets)
    .map((g) => ({
      ...g,
      sets: [...g.sets].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    }))
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        (b.sets[0]?.created_at ?? '').localeCompare(a.sets[0]?.created_at ?? ''),
    );
}

export type RepMaxRow = {
  reps: number;
  /** The heaviest you have actually lifted for exactly this many reps. */
  actual: { weight: number; date: string } | null;
  /** What your best estimated max says you could do, to the nearest 0.5 kg. */
  predicted: number | null;
};

/**
 * Heaviest at each rep count from 1 to 12, beside what your best estimated
 * max predicts for it. The gaps between the two are where a new record is
 * waiting.
 */
export function repMaxTable(sets: DatedSet[]): RepMaxRow[] {
  const work = sets.filter((s) => isWorking(s) && (s.reps ?? 0) > 0 && s.weight_kg > 0);
  const best = max(
    work
      .filter((s) => (s.reps ?? 0) <= 12)
      .map((s) => estimatedOneRepMax(s.weight_kg, s.reps ?? 0)),
  );
  return Array.from({ length: 12 }, (_, i) => {
    const reps = i + 1;
    const atReps = work.filter((s) => s.reps === reps);
    const top = atReps.reduce<DatedSet | null>(
      (a, s) => (!a || s.weight_kg > a.weight_kg ? s : a),
      null,
    );
    const predicted =
      best === null ? null : Math.round((reps === 1 ? best : best / (1 + reps / 30)) * 2) / 2;
    return { reps, actual: top ? { weight: top.weight_kg, date: top.date } : null, predicted };
  });
}
