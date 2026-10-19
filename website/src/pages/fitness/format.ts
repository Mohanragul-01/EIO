/**
 * format.ts - the Fitness page's vocabulary and number formats.
 *
 * Words and display only. Every training RULE comes from the app's
 * modules/fitness files; these are the labels the phone keeps in its screens
 * (or in useLadders.ts, which imports React and so cannot be loaded here),
 * written once more for the browser.
 */
import {
  formatDuration,
  type Equipment,
  type FitnessMode,
  type ProgressionFamily,
  type SetType,
} from '@app/modules/fitness/types';
import type { RecordHit } from '@app/modules/fitness/records';

import type { IconName } from '../../components/Icon';

/** 62.5 -> "62.5", 60 -> "60", 61.25 -> "61.3": one decimal at most, none when whole. */
export function trim(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

/** A value for an input or a ghost: blank for nothing (or 0), two decimals at most. */
export function fieldText(n: number | null | undefined): string {
  if (n === null || n === undefined || n === 0) return '';
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

/** Kilograms with Indian digit grouping: "12,450 kg". */
export function volumeText(kg: number): string {
  return `${kg.toLocaleString('en-IN')} kg`;
}

/** "42:10", "1h 05m", or a dash when unknown. */
export function durationLabel(ms: number | null): string {
  if (ms === null) return '—';
  const seconds = Math.round(ms / 1000);
  const hours = Math.floor(seconds / 3600);
  if (hours === 0) return formatDuration(seconds);
  return `${hours}h ${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}m`;
}

/** A record in its own unit: "100 kg", "11 reps", "45s", "−15 kg" (less assistance). */
export function recordValue(hit: Pick<RecordHit, 'kind' | 'value'>): string {
  switch (hit.kind) {
    case 'reps':
      return `${hit.value} reps`;
    case 'hold':
      return `${hit.value}s`;
    case 'load':
      return hit.value < 0 ? `−${trim(-hit.value)} kg` : `+${trim(hit.value)} kg`;
    default:
      return `${trim(hit.value)} kg`;
  }
}

export const MODE_ICON: Record<FitnessMode, IconName> = { gym: 'fitness', calisthenics: 'body' };

/**
 * Calisthenics identifies itself in cyan, the gym keeps the page's accent -
 * always beside the word or the icon, never as the only signal.
 */
export const MODE_COLOR: Record<FitnessMode, string> = {
  gym: 'var(--primary)',
  calisthenics: 'var(--accent-cyan)',
};

export const FAMILIES: ProgressionFamily[] = [
  'push',
  'pull',
  'legs',
  'core',
  'balance',
  'statics',
  'other',
];

export const FAMILY_LABEL: Record<ProgressionFamily, string> = {
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
  core: 'Core',
  balance: 'Balance',
  statics: 'Statics',
  other: 'Other',
};

export const EQUIPMENT: { key: Equipment; label: string }[] = [
  { key: 'none', label: 'None' },
  { key: 'barbell', label: 'Barbell' },
  { key: 'dumbbell', label: 'Dumbbell' },
  { key: 'kettlebell', label: 'Kettlebell' },
  { key: 'machine', label: 'Machine' },
  { key: 'cable', label: 'Cable' },
  { key: 'band', label: 'Band' },
  { key: 'pull_up_bar', label: 'Pull-up bar' },
  { key: 'rings', label: 'Rings' },
  { key: 'dip_bars', label: 'Dip bars' },
  { key: 'parallettes', label: 'Parallettes' },
  { key: 'other', label: 'Other' },
];

export const SET_TYPES: { type: SetType; letter: string; title: string; detail: string }[] = [
  { type: 'warmup', letter: 'W', title: 'Warm-up', detail: 'Not counted in volume or records' },
  { type: 'normal', letter: '1', title: 'Normal', detail: 'A working set' },
  { type: 'failure', letter: 'F', title: 'Failure', detail: 'Taken to failure; may record 0 reps' },
  { type: 'drop', letter: 'D', title: 'Drop set', detail: 'Straight after the last, no rest' },
];

/** W amber, F red, D blue - always the letter too, so never colour alone. */
export const SET_TYPE_COLOR: Record<SetType, string> = {
  warmup: 'var(--warning)',
  normal: 'var(--text)',
  failure: 'var(--danger)',
  drop: 'var(--info)',
};

export const RPE_OPTIONS = [6, 7, 7.5, 8, 8.5, 9, 9.5, 10];

export const REST_OPTIONS = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300];

export function restLabel(seconds: number): string {
  return seconds === 0 ? 'Off' : formatDuration(seconds);
}

/** Superset letters, coloured from the accent set; the letter is always shown. */
export function supersetColor(letter: string): string {
  return (
    {
      A: 'var(--accent-indigo)',
      B: 'var(--accent-amber)',
      C: 'var(--accent-emerald)',
      D: 'var(--accent-rose)',
    }[letter] ?? 'var(--accent-cyan)'
  );
}

/** "1 set", "3 sets". */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
