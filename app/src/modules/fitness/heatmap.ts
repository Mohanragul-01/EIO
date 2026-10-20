/**
 * heatmap.ts - a year of training, one square per day.
 *
 * The month calendar answers "what did I do this month"; the heatmap answers
 * "how has the year gone" - the gaps, the streaks, the weeks that slipped. Rows
 * are weekdays and columns are weeks, with this week on the right, so a rest
 * day you always take shows up as a pale stripe rather than as a failure.
 *
 * Intensity is WORKING sets that day (warm-ups are preparation, as everywhere
 * else in this module), as a share of the busiest day shown. The screen draws
 * it with colour and size together and labels every square in words, so the
 * level is never carried by colour alone.
 */
import { fromISODate, toISODate } from '../../core/date';
import { trainingDays } from './streak';
import type { FitnessMode, SetType } from './types';

export type HeatDay = { sets: number; sessions: number; gym: boolean; calisthenics: boolean };

export type HeatLevel = 0 | 1 | 2 | 3 | 4;

/**
 * The days the heatmap shows: `grid[weekday][week]`, oldest week first, the
 * last column being the week that holds `today`. Days after today are included
 * (the week is drawn whole) and are the caller's to mark as still to come.
 *
 * Every day is a fresh local date from (y, m, d) - adding 24 hours would land
 * on the wrong day across a daylight-saving change.
 */
export function yearGrid(today: string, weeks = 53, weekStartsOn: 0 | 1 = 1): string[][] {
  const t = fromISODate(today);
  const offset = (t.getDay() - weekStartsOn + 7) % 7;
  // The first day of the first (oldest) week.
  const firstDay = t.getDate() - offset - 7 * (weeks - 1);
  return Array.from({ length: 7 }, (_, weekday) =>
    Array.from({ length: weeks }, (_, week) =>
      toISODate(new Date(t.getFullYear(), t.getMonth(), firstDay + week * 7 + weekday)),
    ),
  );
}

/**
 * What each day held: how many sessions and of which mode, and how many
 * working sets. A day with a session but nothing logged is kept, with 0 sets,
 * so the screen can still say a workout happened.
 */
export function heatmapDays(
  sessions: { id: string; date: string; mode: FitnessMode }[],
  sets: { session_id: string; date: string; set_type: SetType | null }[],
): Record<string, HeatDay> {
  const out: Record<string, HeatDay> = {};
  for (const [date, day] of Object.entries(trainingDays(sessions))) {
    out[date] = { sets: 0, sessions: day.count, gym: day.gym, calisthenics: day.calisthenics };
  }
  for (const set of sets) {
    // A v2 row has no set type: it was an ordinary working set.
    if ((set.set_type ?? 'normal') === 'warmup') continue;
    const day = (out[set.date] ??= { sets: 0, sessions: 0, gym: false, calisthenics: false });
    day.sets += 1;
  }
  return out;
}

/** 0 for nothing done; 1 to 4 by the day's share of `max`, the busiest day shown. */
export function heatLevel(sets: number, max: number): HeatLevel {
  if (sets <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((sets / max) * 4))) as HeatLevel;
}

/**
 * Each level as a range of sets, for a legend in words ("1-2 sets"). Exactly
 * the inverse of heatLevel; a level no whole number of sets can reach (with a
 * busiest day of 2, there is no level 1) is left out rather than shown empty.
 */
export function levelRanges(max: number): { level: 1 | 2 | 3 | 4; from: number; to: number }[] {
  if (max <= 0) return [];
  return ([1, 2, 3, 4] as const)
    .map((level) => ({
      level,
      from: Math.floor(((level - 1) * max) / 4) + 1,
      to: Math.floor((level * max) / 4),
    }))
    .filter((range) => range.from <= range.to);
}

/**
 * Where the month labels go: each month whose 1st is on the grid, over the
 * column (week) that holds it. A month that started before the first column
 * gets no label - its few days are not worth a word that would crowd the next.
 */
export function monthStarts(grid: string[][]): { column: number; year: number; month: number }[] {
  const out: { column: number; year: number; month: number }[] = [];
  const weeks = grid[0]?.length ?? 0;
  for (let column = 0; column < weeks; column++) {
    for (const row of grid) {
      const iso = row[column];
      if (iso.endsWith('-01')) {
        out.push({ column, year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)) });
      }
    }
  }
  return out;
}
