/**
 * types.ts - shapes and workout types for the Fitness module.
 *
 * NOTE WHERE THIS LIVES. Ledger categories moved to core/ because two modules
 * needed them. Workout types stay HERE, because only Fitness has any concept
 * of a workout. Putting them in core "in case something else needs them later"
 * would be the wrong instinct - core would slowly become a junk drawer of
 * things one module uses. Move it down when a second module actually asks.
 */
import type { Ionicons } from '@expo/vector-icons';


export type Workout = {
  id: string;
  user_id: string;
  /** 'YYYY-MM-DD' calendar day. */
  date: string;
  type: string;
  /** Null when not recorded - genuinely different from zero. */
  duration_minutes: number | null;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type WorkoutInput = {
  date: string;
  type: string;
  duration_minutes: number | null;
  notes: string;
};

export type WorkoutTypeDef = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

export const WORKOUT_TYPES: WorkoutTypeDef[] = [
  { key: 'gym', label: 'Gym', icon: 'barbell-outline', color: '#FB7185' },
  { key: 'run', label: 'Run', icon: 'walk-outline', color: '#34D399' },
  { key: 'walk', label: 'Walk', icon: 'footsteps-outline', color: '#A3E635' },
  { key: 'cycle', label: 'Cycle', icon: 'bicycle-outline', color: '#60A5FA' },
  { key: 'swim', label: 'Swim', icon: 'water-outline', color: '#22D3EE' },
  { key: 'yoga', label: 'Yoga', icon: 'body-outline', color: '#C084FC' },
  { key: 'sport', label: 'Sport', icon: 'tennisball-outline', color: '#FBBF24' },
  { key: 'other', label: 'Other', icon: 'fitness-outline', color: '#94A3B8' },
];

export const DEFAULT_WORKOUT_TYPE = 'gym';

/** Falls back to a neutral style so a renamed type doesn't crash old rows. */
export function workoutTypeDef(key: string): WorkoutTypeDef {
  const found = WORKOUT_TYPES.find((t) => t.key === key);
  return found ?? { key, label: key, icon: 'fitness-outline', color: '#8B93A5' };
}

/**
 * Minutes -> "45m" / "1h 15m" / "2h".
 *
 * Returns null rather than "0m" for an unrecorded duration, so callers can
 * omit the line entirely instead of displaying a meaningless zero.
 */
export function formatDuration(minutes: number | null): string | null {
  if (minutes === null || minutes <= 0) return null;

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}
