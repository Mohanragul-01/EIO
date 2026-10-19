/**
 * insights.ts - what a week, a month or a year costs, and where it goes.
 *
 * A period's total is what was actually PAID in it (from the ledger) plus
 * what is still DUE in it (projected). That is the honest figure: "this year
 * you'll pay ₹X" counts the renewals really left, not the monthly figure x 12,
 * which over-counts a yearly plan already paid in March and under-counts a
 * 28-day pack.
 *
 * The paid half only sees payments logged with a subscription link, which
 * began with v3; the screen says so.
 */
import { monthBounds, toISODate } from '../../core/date';
import { cycleOf, perYearMinor } from './cycles';
import { inrOf } from './currency';
import { countsInTotals } from './lifecycle';
import { projectedCharges } from './upcoming';
import type { Payment, Subscription } from './types';

export type Period = 'week' | 'month' | 'year';

export const PERIODS: Period[] = ['week', 'month', 'year'];

export const PERIOD_LABEL: Record<Period, string> = {
  week: 'Week',
  month: 'Month',
  year: 'Year',
};

/** The calendar week (Monday to Sunday), month or year containing `today`. */
export function periodRange(period: Period, today: string): { start: string; end: string } {
  const [y, m, d] = today.split('-').map(Number);
  if (period === 'year') return { start: `${y}-01-01`, end: `${y}-12-31` };
  if (period === 'month') return monthBounds(y, m);

  const date = new Date(y, m - 1, d);
  // getDay: Sunday 0 ... Saturday 6. Days back to Monday:
  const back = (date.getDay() + 6) % 7;
  return {
    start: toISODate(new Date(y, m - 1, d - back)),
    end: toISODate(new Date(y, m - 1, d - back + 6)),
  };
}

export type Share = { key: string; minor: number; pct: number };

/**
 * Sum by key, largest first (ties keep first-seen order), with whole
 * percentages that add up to exactly 100 - largest remainder gets the spare
 * points, so three equal thirds read 34 / 33 / 33 rather than 33 x 3 = 99.
 */
export function breakdown(entries: { key: string; minor: number }[]): Share[] {
  const sums = new Map<string, number>();
  for (const e of entries) sums.set(e.key, (sums.get(e.key) ?? 0) + e.minor);

  const rows = [...sums.entries()]
    .map(([key, minor], index) => ({ key, minor, index }))
    .filter((r) => r.minor > 0)
    .sort((a, b) => b.minor - a.minor || a.index - b.index);

  const total = rows.reduce((sum, r) => sum + r.minor, 0);
  if (total === 0) return [];

  const exact = rows.map((r) => (r.minor / total) * 100);
  const pct = exact.map(Math.floor);
  let spare = 100 - pct.reduce((sum, p) => sum + p, 0);
  const byRemainder = exact
    .map((value, i) => ({ i, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  for (const { i } of byRemainder) {
    if (spare <= 0) break;
    pct[i] += 1;
    spare -= 1;
  }

  return rows.map((r, i) => ({ key: r.key, minor: r.minor, pct: pct[i] }));
}

export type PeriodTotals = {
  range: { start: string; end: string };
  paidMinor: number;
  dueMinor: number;
  totalMinor: number;
  byCategory: Share[];
  /** Keyed by account id; '' is "no account". */
  byAccount: Share[];
};

export function periodTotals(
  subs: Subscription[],
  payments: Payment[],
  period: Period,
  today: string,
): PeriodTotals {
  const range = periodRange(period, today);
  const entries: { category: string; account: string; minor: number }[] = [];

  for (const p of payments) {
    if (p.date < range.start || p.date > range.end) continue;
    entries.push({ category: p.category, account: p.account_id ?? '', minor: p.amount_minor });
  }
  const paidMinor = entries.reduce((sum, e) => sum + e.minor, 0);

  // Still due. Projected from the period's start, not from today: a renewal
  // dated earlier in the period that is still projected was never marked
  // paid (paying advances the due date), so it is overdue, not spent.
  let dueMinor = 0;
  for (const c of projectedCharges(subs, range.start, range.end, today)) {
    if (c.kind !== 'charge' || c.inrMinor === null) continue;
    dueMinor += c.inrMinor;
    entries.push({ category: c.sub.category, account: c.sub.account_id ?? '', minor: c.inrMinor });
  }

  return {
    range,
    paidMinor,
    dueMinor,
    totalMinor: paidMinor + dueMinor,
    byCategory: breakdown(entries.map((e) => ({ key: e.category, minor: e.minor }))),
    byAccount: breakdown(entries.map((e) => ({ key: e.account, minor: e.minor }))),
  };
}

/** What each counted subscription costs a year in rupees, dearest first. */
export function perItemYearly(
  subs: Subscription[],
  today: string,
): { sub: Subscription; perYearMinor: number }[] {
  const rows: { sub: Subscription; perYearMinor: number }[] = [];
  for (const sub of subs) {
    if (!countsInTotals(sub, today)) continue;
    const inr = inrOf(sub);
    if (inr === null) continue;
    const yearly = perYearMinor(inr, cycleOf(sub));
    if (yearly > 0) rows.push({ sub, perYearMinor: yearly });
  }
  return rows.sort((a, b) => b.perYearMinor - a.perYearMinor || a.sub.name.localeCompare(b.sub.name));
}
