/**
 * exerciseSearch.ts - filtering and grouping the exercise library.
 *
 * A separate module from the picker that uses it, and deliberately free of any
 * React Native import, so it can be tested without a renderer. The component
 * next door pulls in @expo/vector-icons, which Jest cannot resolve.
 */
import type { Exercise } from './types';

export type ExerciseSection = { group: string; items: Exercise[] };

/**
 * Filter by a search term, then group by muscle group.
 *
 * Pure and exported so it can be tested without rendering a Modal. Matching on
 * the muscle group as well as the name means typing "legs" finds the squat,
 * which is how people actually look for a lift they half remember.
 *
 * Groups are alphabetical, exercises alphabetical within them, and "Other"
 * always sinks to the bottom - it is a catch-all, not a muscle, so sorting it
 * under "N" would scatter the ungrouped lifts into the middle of the list.
 */
export function groupExercises(exercises: Exercise[], query: string): ExerciseSection[] {
  const needle = query.trim().toLowerCase();
  const matching = needle
    ? exercises.filter(
        (exercise) =>
          exercise.name.toLowerCase().includes(needle) ||
          (exercise.muscle_group ?? '').toLowerCase().includes(needle),
      )
    : exercises;

  const groups = new Map<string, Exercise[]>();
  for (const exercise of matching) {
    // A muscle group that is null, absent, or whitespace is all the same
    // thing to a reader, so they share one bucket rather than making several
    // headers that look identical.
    const key = exercise.muscle_group?.trim() || 'Other';
    const bucket = groups.get(key);
    if (bucket) bucket.push(exercise);
    else groups.set(key, [exercise]);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => {
      if (a === 'Other') return 1;
      if (b === 'Other') return -1;
      return a.localeCompare(b);
    })
    .map(([group, items]) => ({
      group,
      // Copied before sorting: `items` is built from the caller's array and
      // sorting in place would reorder the list they still hold.
      items: [...items].sort((x, y) => x.name.localeCompare(y.name)),
    }));
}
