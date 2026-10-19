/**
 * streak.ts - consistency, counted in weeks.
 *
 * A daily streak breaks on every planned rest day, so it punishes you for
 * following your plan and rewards training through fatigue. A weekly streak
 * asks the question that matters - did you train this week? - and an empty
 * current week does not count against you until it is over.
 */
import { daysUntil, fromISODate, toISODate } from '../../core/date';
import type { FitnessMode } from './types';

/** The first day of the week containing `iso`. */
function weekStart(iso: string, weekStartsOn: 0 | 1): string {
  const d = fromISODate(iso);
  const offset = (d.getDay() - weekStartsOn + 7) % 7;
  return toISODate(new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset));
}

function previousWeek(start: string): string {
  const d = fromISODate(start);
  return toISODate(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7));
}

/** Consecutive weeks, up to this one, with at least one session. */
export function weeklyStreak(dates: string[], today: string, weekStartsOn: 0 | 1 = 1): number {
  const weeks = new Set(dates.filter((d) => d <= today).map((d) => weekStart(d, weekStartsOn)));
  let week = weekStart(today, weekStartsOn);
  // This week is still in progress: no session yet is not a break.
  if (!weeks.has(week)) week = previousWeek(week);
  let count = 0;
  while (weeks.has(week)) {
    count += 1;
    week = previousWeek(week);
  }
  return count;
}

/** Whole days since the last session on or before today; null before the first. */
export function restDays(dates: string[], today: string): number | null {
  const past = dates.filter((d) => d <= today);
  if (past.length === 0) return null;
  const last = past.reduce((a, b) => (a > b ? a : b));
  // daysUntil counts from the real today; measure from `today` instead.
  return daysUntil(today) - daysUntil(last);
}

export type TrainingDay = { gym: boolean; calisthenics: boolean; count: number };

/** Each day with training, and which modes it had, for the calendar. */
export function trainingDays(
  sessions: { date: string; mode: FitnessMode }[],
): Record<string, TrainingDay> {
  const out: Record<string, TrainingDay> = {};
  for (const s of sessions) {
    const day = (out[s.date] ??= { gym: false, calisthenics: false, count: 0 });
    day[s.mode] = true;
    day.count += 1;
  }
  return out;
}
