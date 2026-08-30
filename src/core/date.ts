/**
 * date.ts - calendar-date helpers shared by every module.
 *
 *  THE ONE RULE
 * Due dates are CALENDAR DAYS, not instants. They're stored as 'YYYY-MM-DD'.
 *
 * The trap: `new Date('2026-08-07')` parses as UTC MIDNIGHT. Format that back
 * in a timezone behind UTC and you get 6 August - the classic off-by-one-day
 * bug. So we never round-trip a date string through a bare Date; we split the
 * string and build a LOCAL date explicitly. Every module uses these helpers so
 * the bug can't be reintroduced per-module.
 */

/** 'YYYY-MM-DD' for a Date, using its LOCAL calendar day. */
export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Parse 'YYYY-MM-DD' into a Date at LOCAL midnight (see the trap above). */
export function fromISODate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function todayISO(): string {
  return toISODate(new Date());
}

/** Today shifted by N days - used for the "Tomorrow" / "Next week" chips. */
export function addDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Whole days from today to `iso`. Negative = overdue, 0 = today. */
export function daysUntil(iso: string): number {
  const target = fromISODate(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Both sides are local midnight, so this division is exact - no DST drift.
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/**
 * Human label for a due date: "Today", "Tomorrow", "3 days overdue",
 * "Fri 15 Aug". Relative wording for the near future because that's how people
 * actually think about deadlines; absolute dates once it's far enough out that
 * "in 23 days" stops being meaningful.
 */
export function formatDueDate(iso: string): string {
  const diff = daysUntil(iso);

  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff < -1) return `${Math.abs(diff)} days overdue`;
  if (diff > 1 && diff <= 6) {
    return fromISODate(iso).toLocaleDateString(undefined, { weekday: 'long' });
  }

  const date = fromISODate(iso);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    // Only show the year when it isn't the current one - less noise.
    year: sameYear ? undefined : 'numeric',
  });
}

export function isOverdue(iso: string): boolean {
  return daysUntil(iso) < 0;
}

/**
 * Human label for a date something HAPPENED on: "Today", "Yesterday",
 * "Tuesday", "12 Aug".
 *
 * Deliberately separate from formatDueDate above, because the two look at time
 * in opposite directions and the wording that's right for one is wrong for the
 * other. A due date can be "3 days overdue"; a purchase you already made
 * cannot. Using formatDueDate for a transaction produced exactly that nonsense
 * - every past expense was labelled "overdue".
 *
 * A future date is possible here only if the user picks one by hand, so it
 * falls through to the plain absolute format rather than inventing wording
 * for a case that shouldn't occur.
 */
export function formatEventDate(iso: string): string {
  const diff = daysUntil(iso);

  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  // Within the last week, the weekday name is the most recognisable form.
  if (diff < -1 && diff >= -6) {
    return fromISODate(iso).toLocaleDateString(undefined, { weekday: 'long' });
  }

  const date = fromISODate(iso);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: sameYear ? undefined : 'numeric',
  });
}

/**
 * First and last calendar day of a month, as 'YYYY-MM-DD'.
 *
 * `new Date(year, month, 0)` is a small trick: day 0 of the NEXT month is the
 * last day of this one, which handles 28/29/30/31 and leap years without a
 * lookup table.
 *
 * Lives here rather than in the Finance module because it is pure date
 * arithmetic with no database involvement, which also means it can be tested
 * without pulling in the Supabase client.
 */
export function monthBounds(year: number, month: number): { start: string; end: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  const lastDay = new Date(year, month, 0).getDate();
  return {
    start: `${year}-${pad(month)}-01`,
    end: `${year}-${pad(month)}-${pad(lastDay)}`,
  };
}

/** Units any recurring thing in the app can repeat on. */
export type IntervalUnit = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

/**
 * Advance a calendar date by exactly one interval.
 *
 * Lives in core because two modules need it: Subscriptions advances a billing
 * date, Todo advances a repeating task. It started inside Subscriptions and
 * moved down here rather than across, per the sharing rule in the README.
 *
 * MONTH-END CLAMPING. Adding a month to 31 January is ambiguous. The naive
 * `setMonth(getMonth() + 1)` overflows to 2 or 3 March, which skips February
 * altogether: a monthly task due on the 31st would simply never appear in
 * February. So the day is clamped to the last valid day of the target month
 * instead, giving 28 February (or the 29th in a leap year).
 *
 * The anchor day is not remembered, so a task clamped to the 28th stays on the
 * 28th next month rather than springing back to the 31st. Storing an anchor
 * would fix that, at the cost of a column that exists for one edge case; the
 * date is editable by hand, which is the cheaper answer.
 */
export function addInterval(iso: string, unit: IntervalUnit): string {
  const [year, month, day] = iso.split('-').map(Number);

  const monthsToAdd =
    unit === 'monthly' ? 1 : unit === 'quarterly' ? 3 : unit === 'yearly' ? 12 : 0;

  if (monthsToAdd === 0) {
    // Day-based units need no clamping: every month has a 1st through 28th, and
    // adding days can only ever land on a real date.
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + (unit === 'weekly' ? 7 : 1));
    return toISODate(date);
  }

  // Work in absolute months so the year rolls over on its own.
  const absoluteMonth = (month - 1) + monthsToAdd;
  const targetYear = year + Math.floor(absoluteMonth / 12);
  const targetMonth = absoluteMonth % 12; // 0-based

  // Day 0 of the following month is the last day of this one, which handles
  // 28/29/30/31 without a lookup table or a leap-year special case.
  const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();

  return toISODate(new Date(targetYear, targetMonth, Math.min(day, lastDayOfTargetMonth)));
}
