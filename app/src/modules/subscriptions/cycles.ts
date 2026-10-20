/**
 * cycles.ts - every N days, weeks, months or years, or once.
 *
 * v2 had four cycles. Indian prepaid mobile and DTH packs run 28, 56 or 84
 * days, and modelled as "monthly" their due date drifts by two or three days
 * a renewal - so within a few months the reminder lands after the pack has
 * already lapsed.
 *
 * All date maths builds a fresh local date from (year, month, day) rather than
 * adding milliseconds, which across a daylight-saving change lands on 23:00 of
 * the day before. See core/date.ts for the same rule.
 */
import { fromISODate, toISODate } from '../../core/date';
import type { BillingCycle, Cycle, CycleUnit } from './types';

const LEGACY: Record<BillingCycle, Cycle> = {
  weekly: { unit: 'week', count: 1 },
  monthly: { unit: 'month', count: 1 },
  quarterly: { unit: 'month', count: 3 },
  yearly: { unit: 'year', count: 1 },
};

/**
 * A row's cycle. The unit and count when set; otherwise v2's billing_cycle,
 * because a v2 app still writing after the migration sets only that, and
 * reading a default instead would turn its weekly bill into a monthly one.
 */
export function cycleOf(row: {
  cycle_unit: CycleUnit | null;
  cycle_count: number | null;
  billing_cycle: BillingCycle;
  anchor_day?: number | null;
}): Cycle {
  let cycle: Cycle;
  if (!row.cycle_unit) cycle = LEGACY[row.billing_cycle] ?? LEGACY.monthly;
  else {
    const count = row.cycle_count && row.cycle_count >= 1 ? Math.floor(row.cycle_count) : 1;
    cycle = { unit: row.cycle_unit, count: row.cycle_unit === 'once' ? 1 : count };
  }
  const day = row.anchor_day;
  const anchored = cycle.unit === 'month' || cycle.unit === 'year';
  if (anchored && Number.isInteger(day) && day! >= 1 && day! <= 31) {
    return { ...cycle, anchorDay: day! };
  }
  return cycle;
}

/**
 * The billing day to store when a form saves `nextDue`: the day picked, or -
 * when the date was left as it was - the one already stored, so saving an
 * edit while the date sits on a clamped 28 Feb does not lose the 31st.
 */
export function anchorFor(
  nextDue: string,
  original?: { next_due_date: string; anchor_day: number | null } | null,
): number {
  if (original && original.next_due_date === nextDue && original.anchor_day) {
    return original.anchor_day;
  }
  return Number(nextDue.slice(8, 10));
}

/** Rough length in days, only for choosing the nearest v2 cycle. */
function approxDays(cycle: Cycle): number {
  switch (cycle.unit) {
    case 'day':
      return cycle.count;
    case 'week':
      return 7 * cycle.count;
    case 'month':
      return (365.25 / 12) * cycle.count;
    case 'year':
      return 365.25 * cycle.count;
    case 'once':
      return Infinity;
  }
}

/**
 * The nearest of v2's four cycles, written alongside the real one so the v2
 * app (which reads only billing_cycle) shows something close. A one-time
 * charge becomes yearly: the smallest monthly share v2 can express.
 */
export function legacyCycleFor(cycle: Cycle): BillingCycle {
  const days = approxDays(cycle);
  if (!Number.isFinite(days)) return 'yearly';
  const candidates: [BillingCycle, number][] = [
    ['weekly', 7],
    ['monthly', 365.25 / 12],
    ['quarterly', 365.25 / 4],
    ['yearly', 365.25],
  ];
  return candidates.reduce((best, next) =>
    Math.abs(next[1] - days) < Math.abs(best[1] - days) ? next : best,
  )[0];
}

/** `iso` plus `days` calendar days, DST-safe. */
function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return toISODate(new Date(y, m - 1, d + days));
}

/** The last day of a month (`month` 0-based): day 0 of the next one. */
const lastDayOf = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

/**
 * `iso` plus `months` calendar months in ONE step, clamping the day to the
 * target month's last day. One step matters: 31 Jan + 2 months is 31 Mar,
 * whereas adding one month twice goes via 28 Feb and lands on 28 Mar.
 *
 * `anchorDay` is the day to aim for instead of `iso`'s own, which is how a
 * date already clamped to 28 Feb gets back to the 31st. Only when `iso` IS
 * the anchor day, or its clamped stand-in: a due date a pause or a resume
 * moved to the 20th charges on the 20th, and on the 20th after that. Aiming
 * for an anchor it does not match would move even the first charge (+0
 * months) off the day it is due.
 */
function addMonthsClamped(iso: string, months: number, anchorDay?: number): string {
  const [y, m, iday] = iso.split('-').map(Number);
  const onAnchor = anchorDay !== undefined && iday === Math.min(anchorDay, lastDayOf(y, m - 1));
  const d = onAnchor ? anchorDay : iday;
  const absolute = y * 12 + (m - 1) + months;
  const year = Math.floor(absolute / 12);
  const month = absolute - year * 12; // 0-based
  return toISODate(new Date(year, month, Math.min(d, lastDayOf(year, month))));
}

/** `iso` moved forward by `k` whole cycles. Null for a one-time charge. */
function stepBy(iso: string, cycle: Cycle, k: number): string | null {
  switch (cycle.unit) {
    case 'day':
      return addDays(iso, cycle.count * k);
    case 'week':
      return addDays(iso, 7 * cycle.count * k);
    case 'month':
      return addMonthsClamped(iso, cycle.count * k, cycle.anchorDay);
    case 'year':
      return addMonthsClamped(iso, 12 * cycle.count * k, cycle.anchorDay);
    case 'once':
      return k === 0 ? iso : null;
  }
}

/**
 * The due date after this one, or null for a one-time charge (it does not
 * recur). Mark paid advances from the EXISTING due date, not today, so paying
 * late never shifts the billing day.
 */
export function addCycle(iso: string, cycle: Cycle): string | null {
  return stepBy(iso, cycle, 1);
}

/**
 * Every due date from `firstDue` onward that falls within [from, to], both
 * inclusive. `firstDue` itself is always the first. Each one is measured from
 * `firstDue` (first + k cycles) rather than from the one before, so a 31st
 * clamped to the 28th in February is back on the 31st in March.
 *
 * `limit` guards a daily cycle over a long window; nothing here needs more.
 */
export function occurrences(
  firstDue: string,
  cycle: Cycle,
  from: string,
  to: string,
  limit = 400,
): string[] {
  const dates: string[] = [];
  if (firstDue > to) return dates;

  // Jump close to `from` instead of walking every cycle since a due date
  // years back (an overdue row, or one never marked paid).
  let k = 0;
  if (firstDue < from && cycle.unit !== 'once') {
    const gap = (fromISODate(from).getTime() - fromISODate(firstDue).getTime()) / 86_400_000;
    k = Math.max(0, Math.floor(gap / approxDays(cycle)) - 1);
  }

  for (let guard = 0; guard < limit + 1000 && dates.length < limit; guard++, k++) {
    const date = stepBy(firstDue, cycle, k);
    if (date === null || date > to) break;
    if (date >= from) dates.push(date);
  }
  return dates;
}

/** How many times it charges in a year. Zero for a one-time charge. */
function perYear(cycle: Cycle): number {
  switch (cycle.unit) {
    case 'day':
      return 365 / cycle.count;
    case 'week':
      return 52 / cycle.count;
    case 'month':
      return 12 / cycle.count;
    case 'year':
      return 1 / cycle.count;
    case 'once':
      return 0;
  }
}

/**
 * What one charge of `amountMinor` costs a year at this cycle, in whole minor
 * units. A one-time charge is left out of recurring cost: it does not recur.
 *
 * Weeks use 52 a year (52/12 a month), so a weekly bill reads the same as in
 * v2; days use 365, so a 28-day pack counts thirteen times, not twelve.
 */
export function perYearMinor(amountMinor: number, cycle: Cycle): number {
  return Math.round(amountMinor * perYear(cycle));
}

export function perMonthMinor(amountMinor: number, cycle: Cycle): number {
  return Math.round((amountMinor * perYear(cycle)) / 12);
}

export function perWeekMinor(amountMinor: number, cycle: Cycle): number {
  return Math.round((amountMinor * perYear(cycle)) / 52);
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** "Monthly", "Every 28 days", "One-time". */
export function cycleLabel(cycle: Cycle): string {
  const n = cycle.count;
  switch (cycle.unit) {
    case 'day':
      return n === 1 ? 'Daily' : `Every ${n} days`;
    case 'week':
      return n === 1 ? 'Weekly' : `Every ${n} weeks`;
    case 'month':
      if (n === 1) return 'Monthly';
      if (n === 3) return 'Quarterly';
      return `Every ${n} months`;
    case 'year':
      return n === 1 ? 'Yearly' : `Every ${n} years`;
    case 'once':
      return 'One-time';
  }
}

/** The short form for a price line: "₹299 / 28 days". */
export function cycleSuffix(cycle: Cycle): string {
  const n = cycle.count;
  switch (cycle.unit) {
    case 'day':
      return `/ ${n === 1 ? 'day' : `${n} days`}`;
    case 'week':
      return `/ ${n === 1 ? 'wk' : `${n} wks`}`;
    case 'month':
      if (n === 1) return '/ mo';
      if (n === 3) return '/ qtr';
      return `/ ${n} mo`;
    case 'year':
      return `/ ${n === 1 ? 'yr' : `${n} ${plural(n, 'yr', 'yrs')}`}`;
    case 'once':
      return 'once';
  }
}

export const CYCLE_UNITS: CycleUnit[] = ['day', 'week', 'month', 'year', 'once'];

export const UNIT_LABEL: Record<CycleUnit, string> = {
  day: 'Days',
  week: 'Weeks',
  month: 'Months',
  year: 'Years',
  once: 'Once',
};
