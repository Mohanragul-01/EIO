/**
 * streaks.ts - how a routine is going, from its closed occurrences.
 *
 * Only possible now that occurrences share a series and record when they were
 * closed (migration 0020): v2 could not tell one routine's history from a
 * same-named one's, and updated_at moved on every edit.
 *
 *  WHAT COUNTS
 * An occurrence is KEPT when it was done before the next date on its schedule
 * - "before the next one came due". That one test covers both ways a routine
 * slips: a daily task done the next morning missed its day, and a weekly task
 * done on Wednesday for Monday is still this week's. Rolling forward makes the
 * test exact: an occurrence done inside its window is followed by the very
 * next scheduled date, so a gap in the schedule always shows up as a late one.
 *   - A skip is neutral: planned breaks should not cost the streak (Todoist's
 *     days off), and they do not add to it either.
 *   - Won't do breaks it.
 *   - The open occurrence matters too: once its window has passed, the routine
 *     has already slipped, whether or not it has been ticked late yet.
 *
 * Each occurrence is judged by its own rule columns, so changing a routine's
 * rule does not rewrite how its past is scored.
 */
import { ruleOf, stepOnce } from './recurrence';
import { localDayOf } from './today';
import { outcomeOf, seriesKey, type Outcome, type Todo } from './types';

/** The columns a history needs; see api.listSeriesHistory. */
export type HistoryRow = Pick<
  Todo,
  | 'id'
  | 'series_id'
  | 'due_date'
  | 'completed_at'
  | 'updated_at'
  | 'outcome'
  | 'is_done'
  | 'frequency'
  | 'repeat_every'
  | 'repeat_weekdays'
  | 'repeat_anchor_day'
  | 'repeat_nth'
  | 'repeat_from'
>;

export type StreakStats = {
  /** Kept occurrences in a row, up to now. */
  current: number;
  best: number;
  done: number;
  skipped: number;
};

/** The day it was closed, on this device. v2 rows fall back to their last edit. */
export function closedDay(row: Pick<HistoryRow, 'completed_at' | 'updated_at'>): string {
  return localDayOf(row.completed_at ?? row.updated_at);
}

/** Done before the next date on its own schedule. */
export function isKept(row: HistoryRow): boolean {
  if (outcomeOf(row) !== 'done') return false;
  if (!row.due_date) return true;
  return closedDay(row) < stepOnce(row.due_date, ruleOf(row));
}

function byDueThenClosed(a: HistoryRow, b: HistoryRow): number {
  const ad = a.due_date ?? '';
  const bd = b.due_date ?? '';
  if (ad !== bd) return ad < bd ? -1 : 1;
  const ac = a.completed_at ?? a.updated_at;
  const bc = b.completed_at ?? b.updated_at;
  return ac < bc ? -1 : ac > bc ? 1 : 0;
}

export function streakFor(
  closed: readonly HistoryRow[],
  open: Pick<HistoryRow, 'due_date' | 'frequency' | 'repeat_every' | 'repeat_weekdays' | 'repeat_anchor_day' | 'repeat_nth' | 'repeat_from'> | null,
  today: string,
): StreakStats {
  let run = 0;
  let best = 0;
  let done = 0;
  let skipped = 0;

  for (const row of [...closed].filter((r) => r.is_done).sort(byDueThenClosed)) {
    const outcome = outcomeOf(row);
    if (outcome === 'skipped') {
      skipped += 1;
      continue;
    }
    if (outcome === 'done') done += 1;
    if (isKept(row)) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }

  // The live occurrence's window already over: the routine slipped today or
  // earlier, and a late tick will not undo that.
  const lapsed = open?.due_date ? today >= stepOnce(open.due_date, ruleOf(open)) : false;

  return { current: lapsed ? 0 : run, best, done, skipped };
}

/** Every closed occurrence grouped under its series key. */
export function groupBySeries(rows: readonly HistoryRow[]): Map<string, HistoryRow[]> {
  const groups = new Map<string, HistoryRow[]>();
  for (const row of rows) {
    const key = seriesKey(row);
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }
  return groups;
}

/**
 * What happened on each day, for the history calendar: the day each
 * occurrence was closed, and how. Done wins a day that also had a skip.
 */
export function historyDays(rows: readonly HistoryRow[]): Map<string, Outcome> {
  const days = new Map<string, Outcome>();
  for (const row of rows) {
    const outcome = outcomeOf(row);
    if (!outcome) continue;
    const day = closedDay(row);
    if (days.get(day) !== 'done') days.set(day, outcome);
  }
  return days;
}
