/**
 * mode.ts - Gym and Calisthenics, as a lens over one Fitness module.
 *
 * One exercise library, one session log, one record system. The mode only
 * changes what is shown first and what new things default to: which exercises
 * a picker lists, which routines appear, what a new exercise starts as, and
 * what the Exercises tab is called (Skills, in Calisthenics). How a set is
 * logged is decided by the exercise, never by the mode, so a pull-up logs the
 * same way on either day and a session may mix both.
 *
 * Remembered per device: it is about what you are doing on this phone now.
 */
import type { Discipline, Exercise, FitnessMode, LoadMode, TrackingType } from './types';

export const MODE_STORAGE_KEY = 'eio.fitness-mode';

export const MODE_LABEL: Record<FitnessMode, string> = {
  gym: 'Gym',
  calisthenics: 'Calisthenics',
};

/** Whether the mode's lists show this exercise. 'both' shows in either. */
export function visibleInMode(exercise: Pick<Exercise, 'discipline'>, mode: FitnessMode): boolean {
  return exercise.discipline === 'both' || exercise.discipline === mode;
}

/** What a new exercise starts as in each mode. All of it can be changed. */
export function defaultsForMode(mode: FitnessMode): {
  discipline: Discipline;
  load_mode: LoadMode;
  tracking_type: TrackingType;
} {
  return mode === 'calisthenics'
    ? { discipline: 'calisthenics', load_mode: 'bodyweight', tracking_type: 'reps' }
    : { discipline: 'gym', load_mode: 'external', tracking_type: 'reps' };
}

/** A stored value as a mode; anything unrecognised is the gym, the original look. */
export function parseMode(value: string | null | undefined): FitnessMode {
  return value === 'calisthenics' ? 'calisthenics' : 'gym';
}
