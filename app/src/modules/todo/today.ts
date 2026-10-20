/**
 * today.ts - the maths behind the Today view and the dashboard line.
 *
 * Pure, so both clients and the tests share one answer to "what is overdue",
 * "what is today", "what did I finish today" and "what does the tile say".
 * `today` is always passed in; nothing here reads the clock except the one
 * helper that turns a calendar day into the instant it starts.
 */
import { addDays, mondayIndex, weekdayOf, WEEKDAY_SHORT } from './recurrence';
import type { Priority, Todo } from './types';

const PRIORITY_RANK: Record<Priority, number> = { high: 0, normal: 1, low: 2 };

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * The order a day's tasks are worked in: timed ones first, by time, because
 * a 9 am call has to happen at 9; then priority; then the order you arranged
 * by hand on the board; then oldest first, so ties never shuffle.
 */
export function compareForDay(a: Todo, b: Todo): number {
  if (a.due_time && b.due_time && a.due_time !== b.due_time) {
    return a.due_time < b.due_time ? -1 : 1;
  }
  if (a.due_time && !b.due_time) return -1;
  if (!a.due_time && b.due_time) return 1;
  const byPriority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (byPriority !== 0) return byPriority;
  if (a.position !== b.position) return a.position - b.position;
  return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
}

export type TodaySections = {
  overdue: Todo[];
  today: Todo[];
  /** Closed today (done or skipped), most recent first. */
  completed: Todo[];
};

/**
 * Split open and closed-today rows into the Today view's sections.
 *
 * Overdue runs oldest first, the order you would clear it in. Undated tasks
 * never appear: Today answers "what is due", and a task with no date has not
 * said (Todoist draws the same line).
 */
export function buildToday(open: Todo[], closedToday: Todo[], today: string): TodaySections {
  const overdue = open
    .filter((t) => !t.is_done && t.due_date !== null && t.due_date < today)
    .sort((a, b) =>
      a.due_date === b.due_date ? compareForDay(a, b) : (a.due_date as string) < (b.due_date as string) ? -1 : 1,
    );
  const dueToday = open
    .filter((t) => !t.is_done && t.due_date === today)
    .sort(compareForDay);
  const completed = closedToday
    .filter((t) => t.is_done)
    .sort((a, b) => ((a.completed_at ?? '') < (b.completed_at ?? '') ? 1 : -1));
  return { overdue, today: dueToday, completed };
}

export type OpenSummary = { open: number; overdue: number; dueToday: number };

export function summarizeOpen(rows: { due_date: string | null }[], today: string): OpenSummary {
  let overdue = 0;
  let dueToday = 0;
  for (const row of rows) {
    if (!row.due_date) continue;
    if (row.due_date < today) overdue += 1;
    else if (row.due_date === today) dueToday += 1;
  }
  return { open: rows.length, overdue, dueToday };
}

/**
 * The home tile's line. The tile opens Today, so it speaks in Today's terms:
 * what is behind, then what is due, and only then the size of the whole list.
 */
export function tileLine(summary: OpenSummary): string {
  if (summary.open === 0) return 'All clear';
  if (summary.overdue > 0) {
    return summary.dueToday > 0
      ? `${summary.overdue} overdue · ${summary.dueToday} today`
      : `${summary.overdue} overdue`;
  }
  if (summary.dueToday > 0) return `${summary.dueToday} today`;
  return `${summary.open} open`;
}

/**
 * The instant a calendar day starts on this device, as ISO. completed_at is a
 * timestamp, and "completed today" means since local midnight, not since UTC
 * midnight - which in India is 5:30 in the morning.
 */
export function localDayStartISO(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toISOString();
}

/** The calendar day an instant falls on, on this device. */
export function localDayOf(instant: string): string {
  const date = new Date(instant);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export type RescheduleTarget = { key: string; label: string; date: string };

/**
 * One-tap targets for the reschedule sheet, in the order Todoist and TickTick
 * offer them. "This weekend" is the coming Saturday, or today once the weekend
 * has started; "Next week" is next Monday.
 */
export function rescheduleTargets(today: string): RescheduleTarget[] {
  const weekday = weekdayOf(today);
  const weekend = weekday === 6 || weekday === 0 ? today : addDays(today, 6 - weekday);
  const nextMonday = addDays(today, 7 - mondayIndex(weekday));
  return [
    { key: 'today', label: 'Today', date: today },
    { key: 'tomorrow', label: 'Tomorrow', date: addDays(today, 1) },
    { key: 'weekend', label: 'This weekend', date: weekend },
    { key: 'next-week', label: 'Next week', date: nextMonday },
  ];
}

/** '19:00:00' or '19:00' as "7 pm" / "7:30 pm" - the way times are said here. */
export function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const suffix = h < 12 ? 'am' : 'pm';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour} ${suffix}` : `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

/**
 * A row's date chip: "Today", "Tomorrow", "Yesterday", a weekday within the
 * coming week, "3 days overdue", otherwise "12 Nov" (with the year when it is
 * not this one), and the time after it. English and fixed rather than from the
 * phone's locale, so the two clients and the tests say the same thing.
 */
export function dueLabel(dueDate: string, dueTime: string | null, today: string): string {
  const days = daysBetween(today, dueDate);
  let label: string;
  if (days === 0) label = 'Today';
  else if (days === 1) label = 'Tomorrow';
  else if (days === -1) label = 'Yesterday';
  else if (days < -1) label = `${-days} days overdue`;
  else if (days <= 6) label = WEEKDAY_SHORT[weekdayOf(dueDate)];
  else {
    const [y, m, d] = dueDate.split('-').map(Number);
    label = `${d} ${MONTH_SHORT[m - 1]}${y === Number(today.slice(0, 4)) ? '' : ` ${y}`}`;
  }
  return dueTime ? `${label}, ${formatTime(dueTime)}` : label;
}

/** Whole days from `from` to `to`, both calendar days. Exact across DST. */
export function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  // UTC on purpose: both are dates, not instants, and UTC has no DST.
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}
