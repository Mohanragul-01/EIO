/**
 * measurements.ts - body measurements: the sites, and their latest values.
 *
 * One row per day holds whichever sites you measured that day; you rarely
 * measure everything, so each site's latest value is the most recent day that
 * measured IT, and its change is against the day before that.
 */
import type { BodyMeasurement } from './types';

export type SiteKey = Exclude<
  keyof BodyMeasurement,
  'id' | 'user_id' | 'date' | 'created_at' | 'updated_at'
>;

export type Site = { key: SiteKey; label: string; side?: 'left' | 'right'; unit: 'cm' | '%' };

/** In the order you would measure them, pairs side by side. */
export const MEASUREMENT_SITES: Site[] = [
  { key: 'neck', label: 'Neck', unit: 'cm' },
  { key: 'shoulders', label: 'Shoulders', unit: 'cm' },
  { key: 'chest', label: 'Chest', unit: 'cm' },
  { key: 'waist', label: 'Waist', unit: 'cm' },
  { key: 'hips', label: 'Hips', unit: 'cm' },
  { key: 'arm_left', label: 'Arm', side: 'left', unit: 'cm' },
  { key: 'arm_right', label: 'Arm', side: 'right', unit: 'cm' },
  { key: 'forearm_left', label: 'Forearm', side: 'left', unit: 'cm' },
  { key: 'forearm_right', label: 'Forearm', side: 'right', unit: 'cm' },
  { key: 'thigh_left', label: 'Thigh', side: 'left', unit: 'cm' },
  { key: 'thigh_right', label: 'Thigh', side: 'right', unit: 'cm' },
  { key: 'calf_left', label: 'Calf', side: 'left', unit: 'cm' },
  { key: 'calf_right', label: 'Calf', side: 'right', unit: 'cm' },
  { key: 'body_fat_pct', label: 'Body fat', unit: '%' },
];

/** "Arm (L)", "Waist". */
export function siteName(site: Site): string {
  return site.side ? `${site.label} (${site.side === 'left' ? 'L' : 'R'})` : site.label;
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

const newestFirst = (rows: BodyMeasurement[]) =>
  [...rows].sort((a, b) => b.date.localeCompare(a.date));

export type Latest = { value: number; date: string; previous: number | null };

/** Each measured site's latest value, its day, and the value before it. */
export function latestValues(rows: BodyMeasurement[]): Partial<Record<SiteKey, Latest>> {
  const sorted = newestFirst(rows);
  const out: Partial<Record<SiteKey, Latest>> = {};
  for (const site of MEASUREMENT_SITES) {
    const measured = sorted.flatMap((r) => {
      const v = num(r[site.key]);
      return v === null ? [] : [{ value: v, date: r.date }];
    });
    if (measured.length === 0) continue;
    out[site.key] = { ...measured[0], previous: measured[1]?.value ?? null };
  }
  return out;
}

/** One site over time, oldest first, for its chart. */
export function seriesForSite(
  rows: BodyMeasurement[],
  key: SiteKey,
): { date: string; value: number }[] {
  return newestFirst(rows)
    .reverse()
    .flatMap((r) => {
      const v = num(r[key]);
      return v === null ? [] : [{ date: r.date, value: v }];
    });
}
