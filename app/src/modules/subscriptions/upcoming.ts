/**
 * upcoming.ts - what leaves your account, and when.
 *
 * The 14-day strip, the month calendar, the list's sections and the headline
 * totals all answer the same question from different distances, so they share
 * one projection: from each subscription's next due date forward, by its
 * cycle. Dates are computed, never stored, so editing a cycle or a due date
 * moves every future charge with it.
 *
 * Three kinds of thing are kept apart, because mixing them is how a total
 * goes quietly wrong:
 *   charge     a renewal that will happen; counted
 *   trial_end  a trial ending - a charge only if you keep it; shown, not counted
 *   paid       a payment already logged in Finance; counted as paid, never twice
 */
import { monthBounds, toISODate } from '../../core/date';
import { cycleOf, occurrences, perMonthMinor, perWeekMinor, perYearMinor } from './cycles';
import { inrOf } from './currency';
import {
  BUCKET_ORDER,
  bucketOf,
  countsInTotals,
  effectiveState,
  projectsCharges,
  trialEndsOn,
  type Bucket,
} from './lifecycle';
import type { Payment, Subscription } from './types';

export type Charge = {
  sub: Subscription;
  date: string;
  /** Paise, or null for a foreign price with no rate set. */
  inrMinor: number | null;
  kind: 'charge' | 'trial_end' | 'paid';
};

/** When it actually next charges: a pause's resume date if that is later. */
function firstCharge(sub: Subscription): string {
  return sub.status === 'paused' && sub.resume_on && sub.resume_on > sub.next_due_date
    ? sub.resume_on
    : sub.next_due_date;
}

const byDateThenName = (a: Charge, b: Charge) =>
  a.date.localeCompare(b.date) || a.sub.name.localeCompare(b.sub.name);

/**
 * Every renewal and trial end in [from, to], in date order. Overdue renewals
 * appear at their due date if it falls inside the window: they are still
 * owed.
 */
export function projectedCharges(
  subs: Subscription[],
  from: string,
  to: string,
  today: string,
): Charge[] {
  const charges: Charge[] = [];
  for (const sub of subs) {
    if (effectiveState(sub, today) === 'trial') {
      const ends = trialEndsOn(sub);
      if (ends >= from && ends <= to) {
        charges.push({ sub, date: ends, inrMinor: inrOf(sub), kind: 'trial_end' });
      }
      continue;
    }
    if (!projectsCharges(sub, today)) continue;
    for (const date of occurrences(firstCharge(sub), cycleOf(sub), from, to)) {
      charges.push({ sub, date, inrMinor: inrOf(sub), kind: 'charge' });
    }
  }
  return charges.sort(byDateThenName);
}

/** The rupees that will actually leave: charges with a known INR value. */
function countedMinor(charges: Charge[]): number {
  return charges.reduce(
    (total, c) => (c.kind === 'charge' && c.inrMinor !== null ? total + c.inrMinor : total),
    0,
  );
}

export type StripDay = { iso: string; charges: Charge[]; totalMinor: number };

/** `iso` plus `days`, DST-safe. */
function plusDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return toISODate(new Date(y, m - 1, d + days));
}

/**
 * The strip at the top of the list: `count` days from today, each with what
 * renews (or a trial that ends) and the rupees that leave that day.
 */
export function upcomingDays(subs: Subscription[], today: string, count = 14): StripDay[] {
  const end = plusDays(today, count - 1);
  const charges = projectedCharges(subs, today, end, today);
  const days: StripDay[] = [];
  for (let i = 0; i < count; i++) {
    const iso = plusDays(today, i);
    const onDay = charges.filter((c) => c.date === iso);
    days.push({ iso, charges: onDay, totalMinor: countedMinor(onDay) });
  }
  return days;
}

export type MonthView = {
  /** Only days with something on them. */
  days: Map<string, Charge[]>;
  /** Logged against a subscription this month. */
  paidMinor: number;
  /** Projected charges left this month, overdue ones included. */
  stillToPayMinor: number;
};

/**
 * One month for the calendar: payments already logged (past days) and the
 * charges still projected. A projection never runs backwards - before a
 * subscription's due date the calendar shows only what was actually paid.
 */
export function monthCharges(
  subs: Subscription[],
  payments: Payment[],
  year: number,
  month: number,
  today: string,
): MonthView {
  const { start, end } = monthBounds(year, month);
  const byId = new Map(subs.map((s) => [s.id, s]));
  const days = new Map<string, Charge[]>();
  const add = (charge: Charge) => {
    const list = days.get(charge.date);
    if (list) list.push(charge);
    else days.set(charge.date, [charge]);
  };

  let paidMinor = 0;
  for (const p of payments) {
    const sub = byId.get(p.subscription_id);
    // A deleted subscription's payments stay in Finance; there is no tile
    // to draw them with here.
    if (!sub || p.date < start || p.date > end) continue;
    paidMinor += p.amount_minor;
    add({ sub, date: p.date, inrMinor: p.amount_minor, kind: 'paid' });
  }

  const projected = projectedCharges(subs, start, end, today);
  projected.forEach(add);

  return { days, paidMinor, stillToPayMinor: countedMinor(projected) };
}

export type Section = {
  bucket: Bucket;
  items: Subscription[];
  count: number;
  /** The next charge of each, in rupees (unpriced foreign ones left out). */
  /**
   * What the section's items charge, in rupees. Null for the sections that are
   * not charging (trials, paused and ending), where a sum would read as spend.
   */
  totalMinor: number | null;
};

/** The date a row is ordered by within its section. */
function sortDate(sub: Subscription, today: string): string {
  const state = effectiveState(sub, today);
  if (state === 'trial' || state === 'trial_over') return trialEndsOn(sub);
  if (state === 'paused') return sub.resume_on ?? '9999-12-31';
  if (state === 'ending') return sub.ends_on ?? sub.next_due_date;
  return sub.next_due_date;
}

/**
 * The list's sections - Overdue, This week, This month, Later, Trials, Paused
 * & ending - each with a count and a total, empty ones left out. Archived and
 * ended rows come back separately, for the link at the foot of the list.
 */
export function sections(
  subs: Subscription[],
  today: string,
): { sections: Section[]; archived: Subscription[] } {
  const groups = new Map<Bucket, Subscription[]>();
  for (const sub of subs) {
    const bucket = bucketOf(sub, today);
    const list = groups.get(bucket);
    if (list) list.push(sub);
    else groups.set(bucket, [sub]);
  }

  const order = (list: Subscription[]) =>
    [...list].sort(
      (a, b) =>
        sortDate(a, today).localeCompare(sortDate(b, today)) || a.name.localeCompare(b.name),
    );

  const result: Section[] = [];
  for (const bucket of BUCKET_ORDER) {
    const items = groups.get(bucket);
    if (!items || items.length === 0) continue;
    result.push({
      bucket,
      items: order(items),
      count: items.length,
      totalMinor:
        bucket === 'trials' || bucket === 'paused'
          ? null
          : items.reduce((total, s) => total + (inrOf(s) ?? 0), 0),
    });
  }

  const archived = [...(groups.get('archive') ?? [])].sort((a, b) =>
    b.updated_at.localeCompare(a.updated_at),
  );
  return { sections: result, archived };
}

export type Totals = {
  perWeekMinor: number;
  perMonthMinor: number;
  perYearMinor: number;
  /** Subscriptions counted in the totals. */
  count: number;
  trialCount: number;
  /** Foreign subscriptions left out because they have no rate. */
  missingRate: number;
};

/**
 * What it all costs, normalised per week, month and year. Only what counts
 * (active, and cancellations still running); trials are counted apart, and a
 * foreign price with no rate is left out and reported rather than guessed.
 */
export function summaryTotals(subs: Subscription[], today: string): Totals {
  const totals: Totals = {
    perWeekMinor: 0,
    perMonthMinor: 0,
    perYearMinor: 0,
    count: 0,
    trialCount: 0,
    missingRate: 0,
  };
  for (const sub of subs) {
    const state = effectiveState(sub, today);
    if (state === 'trial' || state === 'trial_over') {
      totals.trialCount++;
      continue;
    }
    if (!countsInTotals(sub, today)) continue;
    const inr = inrOf(sub);
    if (inr === null) {
      totals.missingRate++;
      continue;
    }
    const cycle = cycleOf(sub);
    totals.perWeekMinor += perWeekMinor(inr, cycle);
    totals.perMonthMinor += perMonthMinor(inr, cycle);
    totals.perYearMinor += perYearMinor(inr, cycle);
    totals.count++;
  }
  return totals;
}
