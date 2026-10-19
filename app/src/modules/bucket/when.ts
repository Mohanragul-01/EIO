/**
 * when.ts - dates that say only as much as you know.
 *
 * The 818 items all came in undone, so most ticks are things done long ago,
 * and "sometime in 2019" is the honest answer for many of them. A date column
 * cannot hold "2019", so the year is stored as 1 January with a precision of
 * 'year' beside it - and everything that shows a date goes through here, so
 * that 1 January is never shown as if anyone had claimed it.
 *
 * Month names are spelled out here rather than taken from toLocaleDateString:
 * the output is the same on the phone, the website and in tests, and it is
 * always day first, which is how dates are read where this app is used.
 *
 * Pure: every function takes "today" as an argument, so tests pin it.
 */
import type { Precision } from './types';

export const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

export const MONTH_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

const pad = (n: number) => String(n).padStart(2, '0');

/** Split 'YYYY-MM-DD' into numbers. */
export function partsOf(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split('-').map(Number);
  return { year, month, day };
}

export function isoOf(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of this one.
  return new Date(year, month, 0).getDate();
}

/**
 * A calendar day moved by whole days.
 *
 * Built from (y, m, d) and moved with setDate, never by adding 86,400,000 ms:
 * across a daylight-saving change that lands an hour short, which at midnight
 * is the previous day.
 */
export function addDaysTo(iso: string, days: number): string {
  const { year, month, day } = partsOf(iso);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return isoOf(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/** "14 Mar 2019", "Mar 2019" or "2019" - with a two-digit year for chips. */
export function formatWhen(
  iso: string,
  precision: Precision,
  options: { short?: boolean } = {},
): string {
  const { year, month, day } = partsOf(iso);
  if (precision === 'year') return String(year);

  const yearText = options.short ? `'${String(year).slice(-2)}` : String(year);
  const monthText = `${MONTH_SHORT[month - 1]} ${yearText}`;
  return precision === 'month' ? monthText : `${day} ${monthText}`;
}

/** What the memory sheet's "When" offers. */
export type WhenChoice =
  | { kind: 'today' }
  | { kind: 'yesterday' }
  | {
      kind: 'earlier';
      year: number;
      /** 1-12, or null for "just the year". */
      month: number | null;
      /** Only meaningful with a month. */
      day: number | null;
    };

/** The columns a choice is stored as. */
export function whenToDone(
  choice: WhenChoice,
  today: string,
): { done_on: string; done_precision: Precision } {
  if (choice.kind === 'today') return { done_on: today, done_precision: 'day' };
  if (choice.kind === 'yesterday') return { done_on: addDaysTo(today, -1), done_precision: 'day' };

  const { year, month, day } = choice;
  // A day without a month is not a date anyone gave; it is a leftover from
  // switching to "just the year", and must not turn into January.
  if (month === null) return { done_on: isoOf(year, 1, 1), done_precision: 'year' };
  if (day === null) return { done_on: isoOf(year, month, 1), done_precision: 'month' };
  // Picking the 31st and then February gives the last day of February rather
  // than an invalid date.
  return {
    done_on: isoOf(year, month, Math.min(day, daysInMonth(year, month))),
    done_precision: 'day',
  };
}

/** The choice a stored date reads back as, to seed the sheet. */
export function whenFromDone(
  doneOn: string | null,
  precision: Precision | null,
  today: string,
): WhenChoice {
  if (!doneOn) return { kind: 'today' };

  // Null precision is a tick from before v3, and every one of those was a day.
  const known = precision ?? 'day';
  if (known === 'day') {
    if (doneOn === today) return { kind: 'today' };
    if (doneOn === addDaysTo(today, -1)) return { kind: 'yesterday' };
  }

  const { year, month, day } = partsOf(doneOn);
  return {
    kind: 'earlier',
    year,
    month: known === 'year' ? null : month,
    day: known === 'day' ? day : null,
  };
}

/** True for a choice that has not happened yet, which the sheet disables. */
export function isFutureWhen(choice: WhenChoice, today: string): boolean {
  if (choice.kind !== 'earlier') return false;

  const now = partsOf(today);
  if (choice.year !== now.year) return choice.year > now.year;
  if (choice.month === null) return false;
  if (choice.month !== now.month) return choice.month > now.month;
  return choice.day !== null && choice.day > now.day;
}

/** "Today", "Yesterday", "Sometime in 2019", "Mar 2019", "14 Mar 2019". */
export function describeWhen(choice: WhenChoice, today: string): string {
  if (choice.kind === 'today') return 'Today';
  if (choice.kind === 'yesterday') return 'Yesterday';

  const { done_on, done_precision } = whenToDone(choice, today);
  if (done_precision === 'year') return `Sometime in ${choice.year}`;
  return formatWhen(done_on, done_precision);
}
