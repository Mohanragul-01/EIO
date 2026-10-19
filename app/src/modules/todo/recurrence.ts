/**
 * recurrence.ts - when a repeating task comes round next.
 *
 * Pure, and free of React Native, so the website runs it unchanged and every
 * rule can be tested without a clock: "today" is always passed in.
 *
 *  THE SCHEDULE IS A SET OF DATES, NOT A STEP
 * v2 computed "one interval after the old due date", and both of its bugs came
 * from treating the rule as a step rather than a schedule:
 *   - an overdue repeat stepped once and was still overdue, so a daily task
 *     three weeks behind needed 21 ticks to catch up;
 *   - stepping from a CLAMPED date carried the clamp forward, so the 31st
 *     became the 28th in February and stayed the 28th.
 * Here a rule describes which dates are on the schedule, `stepOnce` finds the
 * next one strictly after any date, and the anchor day is stored separately
 * from the due date so clamping it for one month never changes it for the
 * next. Rolling forward is then just stepping until the date is after today.
 *
 * Calendar dates stay 'YYYY-MM-DD' strings throughout and every date is built
 * from (year, month, day) at local midnight, never by adding 24 hours, which
 * would land on 23:00 the day before across a daylight-saving change.
 */
import { addMonths, fromISODate, toISODate } from '../../core/date';
import type { Frequency } from './types';

export type RepeatFrom = 'due' | 'completion';

/** Everything that decides when a repeating task comes round. */
export type RepeatRule = {
  /** The unit, which is also the tab the task lives in. */
  frequency: Frequency;
  /** Every N units, 1 or more. */
  every: number;
  /**
   * Weekly: the days it falls on, 0 = Sunday ... 6 = Saturday (getDay's
   * numbering). Monthly by weekday: the one weekday, in [0]. Null on a weekly
   * rule means the due date's own weekday, which is what v2 meant.
   */
  weekdays: number[] | null;
  /** Monthly/yearly: the day of the month it is meant to fall on. 31 = last day. */
  anchorDay: number | null;
  /** Monthly by weekday: 1-4, or -1 for the last. Null = by day of month. */
  nth: number | null;
  from: RepeatFrom;
};

/** What callers may pass: a bare unit, or the parts of a rule that differ from the defaults. */
export type RuleInput = Frequency | (Partial<RepeatRule> & { frequency: Frequency });

export function toRule(input: RuleInput): RepeatRule {
  const partial = typeof input === 'string' ? { frequency: input } : input;
  return {
    frequency: partial.frequency,
    every: Math.max(1, Math.floor(partial.every ?? 1)),
    weekdays: partial.weekdays && partial.weekdays.length > 0 ? partial.weekdays : null,
    anchorDay: partial.anchorDay ?? null,
    nth: partial.nth ?? null,
    from: partial.from ?? 'due',
  };
}

/** The rule columns of a task row, read as a rule. */
export function ruleOf(row: {
  frequency: Frequency;
  repeat_every?: number | null;
  repeat_weekdays?: number[] | null;
  repeat_anchor_day?: number | null;
  repeat_nth?: number | null;
  repeat_from?: RepeatFrom | null;
}): RepeatRule {
  return toRule({
    frequency: row.frequency,
    every: row.repeat_every ?? 1,
    weekdays: row.repeat_weekdays ?? null,
    anchorDay: row.repeat_anchor_day ?? null,
    nth: row.repeat_nth ?? null,
    from: row.repeat_from ?? 'due',
  });
}

/* DATE PIECES --------------------------------------------------------------- */

function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.split('-').map(Number);
  return [y, m, d];
}

function isoOf(year: number, month: number, day: number): string {
  return toISODate(new Date(year, month - 1, day));
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = parts(iso);
  return isoOf(y, m, d + days);
}

/** 0 = Sunday ... 6 = Saturday. */
export function weekdayOf(iso: string): number {
  return fromISODate(iso).getDay();
}

/** Position in a Monday-first week: Monday 0 ... Sunday 6. */
export function mondayIndex(weekday: number): number {
  return (weekday + 6) % 7;
}

/** Weekdays in the order a Monday-first week shows them, without repeats. */
export function weekdayOrder(weekdays: readonly number[]): number[] {
  return [...new Set(weekdays)].sort((a, b) => mondayIndex(a) - mondayIndex(b));
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function clampDay(year: number, month: number, day: number): number {
  return Math.min(day, daysInMonth(year, month));
}

/** The nth (1-4) or last (-1) given weekday of a month, as a day number. */
function nthWeekdayDay(year: number, month: number, weekday: number, nth: number): number {
  if (nth < 0) {
    const last = daysInMonth(year, month);
    const lastWeekday = new Date(year, month - 1, last).getDay();
    return last - ((lastWeekday - weekday + 7) % 7);
  }
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  return 1 + ((weekday - firstWeekday + 7) % 7) + 7 * (nth - 1);
}

/* THE SCHEDULE -------------------------------------------------------------- */

/**
 * The next date on the schedule strictly after `date`.
 *
 * Each unit first looks for a later date in the same period (a later weekday
 * this week, the anchor day later this month), then jumps `every` periods
 * ahead. That one shape is what makes stepping from an off-schedule date - an
 * occurrence you rescheduled by hand - land back on the schedule rather than
 * dragging the schedule with it.
 */
export function stepOnce(date: string, rule: RepeatRule): string {
  const [y, m, d] = parts(date);

  switch (rule.frequency) {
    case 'daily':
      return addDays(date, rule.every);

    case 'weekly': {
      const days = weekdayOrder(rule.weekdays ?? [weekdayOf(date)]);
      const current = mondayIndex(weekdayOf(date));
      const later = days.find((w) => mondayIndex(w) > current);
      if (later !== undefined) return addDays(date, mondayIndex(later) - current);
      // Into the week `every` weeks on, at its first listed day. Counted from
      // this week's Monday so "every 2 weeks on Mon and Thu" keeps its rhythm.
      const monday = addDays(date, -current);
      return addDays(monday, 7 * rule.every + mondayIndex(days[0]));
    }

    case 'monthly': {
      if (rule.nth !== null) {
        const weekday = rule.weekdays?.[0] ?? weekdayOf(date);
        const sameMonth = nthWeekdayDay(y, m, weekday, rule.nth);
        if (sameMonth > d) return isoOf(y, m, sameMonth);
        const next = addMonths(y, m, rule.every);
        return isoOf(next.year, next.month, nthWeekdayDay(next.year, next.month, weekday, rule.nth));
      }
      const anchor = rule.anchorDay ?? d;
      const sameMonth = clampDay(y, m, anchor);
      if (sameMonth > d) return isoOf(y, m, sameMonth);
      const next = addMonths(y, m, rule.every);
      // The ANCHOR is clamped, never the date we came from: the whole of bug 2.
      return isoOf(next.year, next.month, clampDay(next.year, next.month, anchor));
    }

    case 'yearly': {
      const anchor = rule.anchorDay ?? d;
      const sameYear = clampDay(y, m, anchor);
      if (sameYear > d) return isoOf(y, m, sameYear);
      const year = y + rule.every;
      return isoOf(year, m, clampDay(year, m, anchor));
    }
  }
}

/**
 * Whether `date` is itself on the schedule.
 *
 * A rule that has no fixed position (every N days, a weekly rule with no
 * weekdays, a monthly one with no anchor) accepts any date: wherever it starts
 * is where its rhythm is counted from.
 */
export function isSchedulePoint(date: string, rule: RepeatRule): boolean {
  const [y, m, d] = parts(date);
  switch (rule.frequency) {
    case 'daily':
      return true;
    case 'weekly':
      return rule.weekdays === null || rule.weekdays.includes(weekdayOf(date));
    case 'monthly':
      if (rule.nth !== null) {
        const weekday = rule.weekdays?.[0];
        return weekday !== undefined && nthWeekdayDay(y, m, weekday, rule.nth) === d;
      }
      return rule.anchorDay === null || clampDay(y, m, rule.anchorDay) === d;
    case 'yearly':
      return rule.anchorDay === null || clampDay(y, m, rule.anchorDay) === d;
  }
}

/** The first date on the schedule on or after `date`. */
export function alignOnOrAfter(date: string, rule: RepeatRule): string {
  return isSchedulePoint(date, rule) ? date : stepOnce(date, rule);
}

/** `date` plus N units, month-end clamped from its own day: the interval alone. */
function intervalAfter(date: string, rule: RepeatRule): string {
  const [y, m, d] = parts(date);
  switch (rule.frequency) {
    case 'daily':
      return addDays(date, rule.every);
    case 'weekly':
      return addDays(date, 7 * rule.every);
    case 'monthly': {
      const next = addMonths(y, m, rule.every);
      return isoOf(next.year, next.month, clampDay(next.year, next.month, d));
    }
    case 'yearly': {
      const year = y + rule.every;
      return isoOf(year, m, clampDay(year, m, d));
    }
  }
}

/**
 * The due date of the occurrence that replaces one just closed.
 *
 * FROM THE DUE DATE (the default): the first date on the schedule strictly
 * after today, keeping the anchor - Monday stays Monday, the 31st stays the
 * month end - however late the tick. Strictly after, so finishing yesterday's
 * daily task this morning schedules tomorrow rather than handing you today's
 * straight back (Todoist does the same). Finishing early still moves exactly
 * one step on from the task's own date.
 *
 * FROM COMPLETION: the interval counted from the day it was actually done,
 * because that is the whole meaning of "three days after I last watered them".
 * Weekdays and anchors do not apply; the editor does not offer them.
 *
 * A repeating task with no due date has nothing to anchor to, so it counts
 * from today.
 */
export function nextDueDate(
  dueDate: string | null,
  input: RuleInput,
  on: { today: string; completedOn?: string },
): string {
  const rule = toRule(input);

  if (rule.from === 'completion') {
    return intervalAfter(on.completedOn ?? on.today, rule);
  }

  let next = stepOnce(dueDate ?? on.today, rule);
  // Each step is strictly later than the last, so this always ends; it runs
  // once per missed occurrence, which for years of a daily task is a few
  // thousand cheap iterations at worst.
  while (next <= on.today) next = stepOnce(next, rule);
  return next;
}

/**
 * The first due date a repeating task should get when it has none: today if
 * today is on the schedule, otherwise the next date that is. Quick add uses it
 * for "every mon" with no date, and the editor when repeat is turned on.
 */
export function firstDueDate(input: RuleInput, today: string): string {
  const rule = toRule(input);
  return rule.from === 'completion' ? today : alignOnOrAfter(today, rule);
}

/**
 * The next `count` dates, starting with `start` (the current due date), for
 * the editor's preview. For a from-completion rule they assume each one is
 * done on the day it is due, which is the only honest guess available.
 */
export function upcomingDates(start: string, input: RuleInput, count = 3): string[] {
  const rule = toRule(input);
  const dates = [start];
  while (dates.length < count) {
    const last = dates[dates.length - 1];
    dates.push(rule.from === 'completion' ? intervalAfter(last, rule) : stepOnce(last, rule));
  }
  return dates;
}

/* WORDS --------------------------------------------------------------------- */

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const WEEKDAY_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 1st, 2nd, 3rd, 4th ... 11th, 12th, 13th ... 21st, 22nd, 23rd ... 31st. */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

const UNIT: Record<Frequency, [string, string]> = {
  daily: ['day', 'days'],
  weekly: ['week', 'weeks'],
  monthly: ['month', 'months'],
  yearly: ['year', 'years'],
};

function isSameSet(a: readonly number[], b: readonly number[]): boolean {
  const sa = new Set(a);
  return sa.size === new Set(b).size && b.every((x) => sa.has(x));
}

const WEEKDAYS_MON_FRI = [1, 2, 3, 4, 5];
const WEEKEND = [6, 0];

function nthLabel(nth: number): string {
  return nth < 0 ? 'last' : ordinal(nth);
}

/** "Every", "Every other", "Every 3" ... followed by the unit, singular after the first two. */
function everyPhrase(rule: RepeatRule): string {
  const [one, many] = UNIT[rule.frequency];
  if (rule.every === 1) return `Every ${one}`;
  if (rule.every === 2) return `Every other ${one}`;
  return `Every ${rule.every} ${many}`;
}

/**
 * The rule in a sentence, for the editor: "Every week on Mon, Thu", "Every
 * month on the last day", "Every other month on the 2nd Saturday", "3 days
 * after each completion". `dueDate` supplies the month of a yearly rule.
 */
export function describeRule(input: RuleInput, dueDate?: string | null): string {
  const rule = toRule(input);
  const [one, many] = UNIT[rule.frequency];

  if (rule.from === 'completion') {
    return rule.every === 1
      ? `A ${one} after each completion`
      : `${rule.every} ${many} after each completion`;
  }

  switch (rule.frequency) {
    case 'daily':
      return everyPhrase(rule);

    case 'weekly': {
      if (!rule.weekdays) return everyPhrase(rule);
      const days = weekdayOrder(rule.weekdays);
      if (rule.every === 1 && isSameSet(days, WEEKDAYS_MON_FRI)) return 'Every weekday';
      if (rule.every === 1 && isSameSet(days, WEEKEND)) return 'Every weekend';
      return `${everyPhrase(rule)} on ${days.map((w) => WEEKDAY_SHORT[w]).join(', ')}`;
    }

    case 'monthly': {
      if (rule.nth !== null && rule.weekdays) {
        return `${everyPhrase(rule)} on the ${nthLabel(rule.nth)} ${WEEKDAY_LONG[rule.weekdays[0]]}`;
      }
      if (rule.anchorDay === null) return everyPhrase(rule);
      if (rule.anchorDay === 31) return `${everyPhrase(rule)} on the last day`;
      return `${everyPhrase(rule)} on the ${ordinal(rule.anchorDay)}`;
    }

    case 'yearly': {
      const day = rule.anchorDay ?? (dueDate ? parts(dueDate)[2] : null);
      if (!dueDate || day === null) return everyPhrase(rule);
      return `${everyPhrase(rule)} on ${day} ${MONTH_SHORT[parts(dueDate)[1] - 1]}`;
    }
  }
}

/**
 * The rule as a few words for a row's repeat chip: "Daily", "Mon, Thu",
 * "Weekdays", "Monthly, 15th", "Monthly, last Fri", "3 days after done".
 */
export function shortRule(input: RuleInput): string {
  const rule = toRule(input);
  const [, many] = UNIT[rule.frequency];
  const base: Record<Frequency, string> = {
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
    yearly: 'Yearly',
  };
  const lead = rule.every === 1 ? base[rule.frequency] : `Every ${rule.every} ${many}`;

  if (rule.from === 'completion') {
    return rule.every === 1
      ? `A ${UNIT[rule.frequency][0]} after done`
      : `${rule.every} ${many} after done`;
  }

  switch (rule.frequency) {
    case 'daily':
      return lead;
    case 'weekly': {
      if (!rule.weekdays) return lead;
      const days = weekdayOrder(rule.weekdays);
      const names =
        isSameSet(days, WEEKDAYS_MON_FRI)
          ? 'Weekdays'
          : isSameSet(days, WEEKEND)
            ? 'Weekends'
            : days.map((w) => WEEKDAY_SHORT[w]).join(', ');
      return rule.every === 1 ? names : `${names}, every ${rule.every} wks`;
    }
    case 'monthly':
      if (rule.nth !== null && rule.weekdays) {
        return `${lead}, ${nthLabel(rule.nth)} ${WEEKDAY_SHORT[rule.weekdays[0]]}`;
      }
      if (rule.anchorDay === null) return lead;
      return `${lead}, ${rule.anchorDay === 31 ? 'last day' : ordinal(rule.anchorDay)}`;
    case 'yearly':
      return lead;
  }
}
