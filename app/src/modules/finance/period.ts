/**
 * period.ts - the finance month, which is not always the calendar month.
 *
 * A salary that lands on the 25th makes the calendar month misleading: the
 * money for October arrives in September, and "this month" splits one pay
 * cycle across two. So Finance has a month-start setting, and every figure
 * that says "this month" - totals, deltas, budgets and their pace, the trend,
 * the home tile - asks this file which days that is.
 *
 * NAMING. A period is named after the month that holds most of its days. A
 * start on the 1st-15th begins in the month it is named after (5 Oct-4 Nov is
 * October); a start on the 16th-31st begins the month before (25 Sep-24 Oct is
 * October). Naming it after the month it starts in would title the cycle you
 * are living through on 19 October "September", which reads as a bug. The
 * range is shown under the title whenever the start is not the 1st, so the
 * name is a convenience and never the only clue.
 *
 * SHORT MONTHS. A start day past a month's end clamps to its last day: the
 * 31st means "the last day of every month". Each period ends the day before
 * the next one starts, so they stay back to back with no day in two periods
 * and none in neither.
 *
 * Everything works on 'YYYY-MM-DD' strings and builds dates from (y, m, d),
 * never by adding 24 hours, so a daylight-saving change cannot move a day.
 */
import { addMonths, monthBounds } from '../../core/date';

/** A finance month, named by year and month (1-12). */
export type Period = { year: number; month: number };

export type DateRange = { start: string; end: string };

export type PeriodProgress = {
  days: number;
  /** Days gone, counting today. */
  elapsed: number;
  /** Days still to spend in, counting today. */
  daysLeft: number;
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * The stored setting, made safe. Anything that is not a whole day of the month
 * means the default: a corrupt setting should cost you a custom month, not
 * every figure on the screen.
 */
export function normalizeStartDay(day: unknown): number {
  return typeof day === 'number' && Number.isInteger(day) && day >= 1 && day <= 31 ? day : 1;
}

export function shiftPeriod(period: Period, delta: number): Period {
  return addMonths(period.year, period.month, delta);
}

export function samePeriod(a: Period, b: Period): boolean {
  return a.year === b.year && a.month === b.month;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Day `startDay` of a month, or its last day if the month is shorter. */
function clampedStart(period: Period, startDay: number): string {
  const day = Math.min(startDay, daysInMonth(period.year, period.month));
  return `${period.year}-${pad(period.month)}-${pad(day)}`;
}

function dayBefore(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  // Day 0 rolls back into the previous month, which Date handles for us.
  const date = new Date(y, m - 1, d - 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** First and last day of a finance month, inclusive. */
export function periodBounds(period: Period, startDay: number): DateRange {
  const start = normalizeStartDay(startDay);
  if (start === 1) return monthBounds(period.year, period.month);

  // The month the period begins in: its own for an early start, the one
  // before for a late one (see NAMING above).
  const opening = start <= 15 ? period : shiftPeriod(period, -1);
  return {
    start: clampedStart(opening, start),
    end: dayBefore(clampedStart(shiftPeriod(opening, 1), start)),
  };
}

/**
 * The finance month a day belongs to.
 *
 * The calendar month of the day is the first guess, and one step either way
 * always settles it: a period never starts more than one month away from the
 * month it is named after.
 */
export function periodOf(iso: string, startDay: number): Period {
  const guess = { year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)) };
  const bounds = periodBounds(guess, startDay);
  // ISO dates compare correctly as strings.
  if (iso < bounds.start) return shiftPeriod(guess, -1);
  if (iso > bounds.end) return shiftPeriod(guess, 1);
  return guess;
}

export function rangeContains(range: DateRange, iso: string): boolean {
  return iso >= range.start && iso <= range.end;
}

/**
 * Days from `start` to `end`, counting both.
 *
 * Through Date.UTC, where every day is exactly 24 hours. Subtracting two local
 * midnights would be an hour short across the spring daylight-saving change
 * and round the wrong way.
 */
export function daysInclusive(start: string, end: string): number {
  const toDays = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return Date.UTC(y, m - 1, d) / 86_400_000;
  };
  return toDays(end) - toDays(start) + 1;
}

/**
 * How far through a period `today` is.
 *
 * Today counts as gone AND as still to come: by the pace marker you may
 * already spend today's share, and what is left is spread over today and the
 * days after it. That is what makes day 17 of 31 read "for 15 days".
 */
export function periodProgress(range: DateRange, today: string): PeriodProgress {
  const days = daysInclusive(range.start, range.end);
  if (today < range.start) return { days, elapsed: 0, daysLeft: days };
  if (today > range.end) return { days, elapsed: days, daysLeft: 0 };
  return {
    days,
    elapsed: daysInclusive(range.start, today),
    daysLeft: daysInclusive(today, range.end),
  };
}

/** 'October 2026'. */
export function periodTitle(period: Period): string {
  return `${MONTH_NAMES[period.month - 1]} ${period.year}`;
}

/** 'September', for a sentence ("18% more than September"). */
export function longMonth(period: Period): string {
  return MONTH_NAMES[period.month - 1];
}

/** 'Oct', for chart axes and "vs Sep". */
export function shortMonth(period: Period): string {
  return MONTH_NAMES[period.month - 1].slice(0, 3);
}

/**
 * '25 Sep'. Day first and from a fixed table rather than toLocaleDateString,
 * which gives 'Sep 25' on a phone set to US English.
 */
export function shortDate(iso: string): string {
  return `${Number(iso.slice(8, 10))} ${MONTH_NAMES[Number(iso.slice(5, 7)) - 1].slice(0, 3)}`;
}

export function formatRange(range: DateRange): string {
  return `${shortDate(range.start)} – ${shortDate(range.end)}`;
}

/** The range under a period's title, or null when it is just the calendar month. */
export function periodSubtitle(period: Period, startDay: number): string | null {
  if (normalizeStartDay(startDay) === 1) return null;
  return formatRange(periodBounds(period, startDay));
}

/** `n` days on from a day, built from (y, m, d + n) so DST cannot move it. */
function plusDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d + n);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const dayOf = (iso: string) => Number(iso.slice(8, 10));
const monthOf = (iso: string) => MONTH_NAMES[Number(iso.slice(5, 7)) - 1];

/** '1–5 Sep', '1 Sep', or '25 Aug – 19 Sep' across a month's end. */
function shortSpan({ start, end }: DateRange): string {
  if (start === end) return shortDate(start);
  if (start.slice(0, 7) === end.slice(0, 7)) return `${dayOf(start)}–${shortDate(end)}`;
  return formatRange({ start, end });
}

/** The same, as a screen reader says it: '1 to 5 September'. */
function spokenSpan({ start, end }: DateRange): string {
  const say = (iso: string) => `${dayOf(iso)} ${monthOf(iso)}`;
  if (start === end) return say(start);
  if (start.slice(0, 7) === end.slice(0, 7)) return `${dayOf(start)} to ${say(end)}`;
  return `${say(start)} to ${say(end)}`;
}

export type Comparison = {
  /** The days of the previous period the figures are held against. */
  range: DateRange;
  /** For "+18% vs Sep": 'Sep', or '1–5 Sep' for part of it. */
  short: string;
  /** For a screen reader: 'September', or '1 to 5 September'. */
  long: string;
};

/**
 * What a period is held against in "+18% vs Sep": the one before it, as of
 * `today`.
 *
 * Once the period is over, the whole of the one before. While it is still
 * running, only as many days of the one before as have gone in this one: on
 * 5 October, 1-5 September. Against all of September, five days of October
 * always read "85% less" and every category "down", which says the date, not
 * the spending. The label then names the days, so it never claims the whole
 * month. Days are counted like periodProgress's, today included.
 */
export function comparisonFor(period: Period, startDay: number, today: string): Comparison {
  const before = shiftPeriod(period, -1);
  const whole = periodBounds(before, startDay);
  const { days, elapsed } = periodProgress(periodBounds(period, startDay), today);

  const end = elapsed > 0 && elapsed < days ? plusDays(whole.start, elapsed - 1) : whole.end;
  // A shorter month before runs out first: from 30 October, all of September.
  if (end >= whole.end) return { range: whole, short: shortMonth(before), long: longMonth(before) };

  const range = { start: whole.start, end };
  return { range, short: shortSpan(range), long: spokenSpan(range) };
}

/** The last `count` periods, oldest first, ending with `current`. */
export function recentPeriods(current: Period, count: number): Period[] {
  return Array.from({ length: count }, (_, i) => shiftPeriod(current, i - (count - 1)));
}
